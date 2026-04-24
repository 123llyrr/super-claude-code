# Event Stream Architecture Design

> **Goal:** Replace `AsyncGenerator<SDKMessage>` with `EventStream<QueryEvent, QueryResult>` for unified async iteration, multi-subscriber support, and fine-grained UI rendering.

**Architecture:** A generic `EventStream<T, R>` class wrapping a queue-based async iterator that supports multiple subscribers and terminal-event detection. All query output flows through this stream as typed `QueryEvent` discriminated unions. UI renders with a simple `switch(event.type)`.

**Tech Stack:** TypeScript, no external dependencies (pure implementation)

---

## 1. EventStream Core

### File: `src/utils/EventStream.ts`

```typescript
export class EventStream<T, R = T> {
  private queue: T[] = []
  private waiting: Array<(value: IteratorResult<T>) => void> = []
  private done = false
  private finalResult: R | undefined
  private resolveResult!: (r: R) => void
  private resultPromise: Promise<R>

  constructor(
    private isTerminal: (event: T) => boolean,
    private extractResult: (event: T) => R,
  ) {
    this.resultPromise = new Promise(resolve => { this.resolveResult = resolve })
  }

  push(event: T): void {
    if (this.done) return
    if (this.isTerminal(event)) {
      this.done = true
      this.finalResult = this.extractResult(event)
      this.resolveResult(this.finalResult)
      // Drain remaining queue to waiting consumers
      while (this.waiting.length) {
        this.waiting.shift()!({ value: undefined as any, done: true })
      }
      return
    }
    const waiter = this.waiting.shift()
    if (waiter) waiter({ value: event, done: false })
    else this.queue.push(event)
  }

  end(result?: R): void {
    this.done = true
    if (result !== undefined) {
      this.finalResult = result
      this.resolveResult(result)
    }
    while (this.waiting.length) {
      this.waiting.shift()!({ value: undefined as any, done: true })
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let index = 0
    while (true) {
      if (index < this.queue.length) {
        yield this.queue[index++]!
      } else if (this.done) {
        return
      } else {
        const result = await new Promise<IteratorResult<T>>(resolve =>
          this.waiting.push(resolve as any)
        )
        if (result.done) return
        yield result.value as T
        index++
      }
    }
  }

  result(): Promise<R> {
    return this.resultPromise
  }

  subscribe(listener: (event: T) => void): () => void {
    const wrapped = (event: T) => { listener(event) }
    // Inline subscription: iterate in background
    const it = this[Symbol.asyncIterator]()
    const run = async () => {
      for await (const event of { [Symbol.asyncIterator]: () => it }) {
        wrapped(event)
      }
    }
    run()
    return () => { /* unsub logic via generator return */ }
  }
}
```

---

## 2. QueryEvent Types

### File: `src/query/events/types.ts`

```typescript
// --- Agent lifecycle ---
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: Message[] }

// --- Turn lifecycle ---
export type TurnEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'turn_end'; turnNumber: number; message: Message; toolResults: ToolResultMessage[] }

// --- Message streaming events ---
export type MessageDelta =
  | { type: 'text_delta'; delta: string; contentIndex: number }
  | { type: 'thinking_delta'; delta: string; contentIndex: number }
  | { type: 'toolcall_delta'; delta: string; contentIndex: number }

export type MessageEvent =
  | { type: 'message_start'; message: Message }
  | { type: 'message_delta'; delta: MessageDelta }
  | { type: 'message_end'; message: Message }

// --- Tool execution events ---
export interface ToolProgress {
  type: string
  [key: string]: unknown
}

export type ToolExecutionEvent =
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_execution_update'; toolCallId: string; partialResult: ToolProgress }
  | { type: 'tool_execution_end'; toolCallId: string; result: ToolResult; isError: boolean }

// --- System events ---
export type SystemEvent =
  | { type: 'error'; code: string; message: string }
  | { type: 'retry'; attempt: number; delayMs: number }
  | { type: 'compact'; tokensSaved: number }

// --- Unified event type ---
export type QueryEvent = AgentEvent | TurnEvent | MessageEvent | ToolExecutionEvent | SystemEvent

// --- Result type ---
export interface QueryResult {
  type: 'success' | 'error'
  message?: Message
  error?: string
}
```

---

## 3. Integration Points

### File: `src/query/events/transformer.ts`

Transforms existing `SDKMessage` stream output into `QueryEvent` stream:

- `message_delta` → `text_delta` / `thinking_delta` / `toolcall_delta`
- `message_stop` → `message_end`
- Tool execution hooks → `tool_execution_start/update/end`
- Turn boundary detection → `turn_start` / `turn_end`

### File: `src/query/eventQuery.ts`

New `query()` function returning `EventStream<QueryEvent, QueryResult>`:

```typescript
export function query(params: QueryParams): EventStream<QueryEvent, QueryResult> {
  const stream = new EventStream<QueryEvent, QueryResult>(
    (e): e is QueryEvent => e.type === 'agent_end',
    (e) => e.type === 'agent_end' ? { type: 'success', messages: e.messages } : { type: 'success' }
  )
  // ... integration with existing query.ts logic
  return stream
}
```

---

## 4. Tool Streaming (Phase 2)

### File: `src/services/tools/StreamingToolExecutor.ts`

Add `onProgress?: (progress: ToolProgress) => void` to `StreamingToolExecutor.execute()`.

### Tool Definitions

No interface changes required — `StreamingToolExecutor` wraps existing tools and calls `onProgress` when tools emit partial results.

---

## Key Design Decisions

1. **No external deps** — pure TypeScript EventStream
2. **Backpressure** — queue-based, consumers block when empty
3. **Multi-subscriber** — each subscriber gets own async iterator instance
4. **Terminal event detection** — via constructor predicates, not a fixed list
5. **Tool streaming optional** — Phase 2, backward compatible
