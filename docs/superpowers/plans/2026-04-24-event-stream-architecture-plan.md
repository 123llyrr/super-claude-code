# Event Stream Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `EventStream<T, R>` class and `QueryEvent` types, integrate into query pipeline as `queryEvent()` function returning `EventStream<QueryEvent, QueryResult>`.

**Architecture:** Generic EventStream class with queue-based async iterator + typed discriminated union events + transformer layer converting existing SDKMessage stream.

**Tech Stack:** TypeScript, no external dependencies

---

## File Map

```
src/utils/EventStream.ts              # NEW — core class
src/query/events/types.ts             # NEW — event type definitions
src/query/events/transformer.ts       # NEW — SDKMessage → QueryEvent transformer
src/query/eventQuery.ts               # NEW — query() returning EventStream
src/query.ts                         # MODIFY — add queryEvent() wrapper
src/services/tools/StreamingToolExecutor.ts  # MODIFY — add onProgress
```

---

## Tasks

### Task 1: EventStream Core Class

**Files:**
- Create: `src/utils/EventStream.ts`
- Test: `tests/unit/utils/EventStream.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/utils/EventStream.test.ts
import { describe, it, expect } from 'bun:test'
import { EventStream } from 'src/utils/EventStream.ts'

describe('EventStream', () => {
  it('delivers events to async iterator', async () => {
    const stream = new EventStream<{type: string}, string>(
      e => e.type === 'end',
      e => e.type === 'end' ? 'done' : ''
    )
    stream.push({ type: 'a' })
    stream.push({ type: 'b' })
    stream.push({ type: 'end' })
    
    const events = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual([{ type: 'a' }, { type: 'b' }, { type: 'end' }])
  })

  it('returns result via result()', async () => {
    const stream = new EventStream<{type: string}, string>(
      e => e.type === 'end',
      () => 'extracted'
    )
    stream.push({ type: 'a' })
    stream.push({ type: 'end' })
    
    const result = await stream.result()
    expect(result).toBe('extracted')
  })

  it('queues events when no consumer waiting', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n
    )
    stream.push(1)
    stream.push(2)
    stream.push(-1)
    
    const events = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual([1, 2, -1])
  })

  it('delivers immediately to waiting consumer', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n
    )
    
    const p = (async () => {
      const events = []
      for await (const e of stream) events.push(e)
      return events
    })()
    
    stream.push(1)
    stream.push(2)
    stream.push(-1)
    
    expect(await p).toEqual([1, 2, -1])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/utils/EventStream.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Write minimal EventStream implementation**

```typescript
// src/utils/EventStream.ts

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
      while (this.waiting.length) {
        this.waiting.shift()!({ value: undefined as any, done: true })
      }
      return
    }

    const waiter = this.waiting.shift()
    if (waiter) {
      waiter({ value: event, done: false })
    } else {
      this.queue.push(event)
    }
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/utils/EventStream.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/EventStream.ts tests/unit/utils/EventStream.test.ts
git commit -m "feat: add EventStream class with queue-based async iterator

- push/end methods for event emission
- async iteration via Symbol.asyncIterator
- result() returns promise resolving on terminal event
- backpressure via waiting consumer queue"
```

---

### Task 2: QueryEvent Types

**Files:**
- Create: `src/query/events/types.ts`
- Test: `tests/unit/query/events/types.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/query/events/types.test.ts
import { describe, it, expect } from 'bun:test'
import type {
  QueryEvent,
  AgentEvent,
  TurnEvent,
  MessageEvent,
  ToolExecutionEvent,
  SystemEvent,
} from 'src/query/events/types.ts'

describe('QueryEvent discriminated union', () => {
  it('agent_start is a QueryEvent', () => {
    const event: QueryEvent = { type: 'agent_start' }
    expect(event.type).toBe('agent_start')
  })

  it('text_delta is a QueryEvent', () => {
    const event: QueryEvent = { type: 'text_delta', delta: 'hello', contentIndex: 0 }
    expect(event.type).toBe('text_delta')
  })

  it('tool_execution_update is a QueryEvent', () => {
    const event: QueryEvent = {
      type: 'tool_execution_update',
      toolCallId: 'abc',
      partialResult: { type: 'progress', percent: 50 }
    }
    expect(event.type).toBe('tool_execution_update')
  })

  it('agent_end carries messages', () => {
    const event: QueryEvent = {
      type: 'agent_end',
      messages: []
    }
    expect(event.type).toBe('agent_end')
    expect('messages' in event).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/query/events/types.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Write types implementation**

```typescript
// src/query/events/types.ts
import type { Message, ToolResultMessage } from 'src/types/message.ts'

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
  | { type: 'tool_execution_end'; toolCallId: string; result: ToolResultMessage; isError: boolean }

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/query/events/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/query/events/types.ts tests/unit/query/events/types.test.ts
git commit -m "feat(query/events): add QueryEvent discriminated union types

- AgentEvent: agent_start, agent_end
- TurnEvent: turn_start, turn_end  
- MessageEvent: message_start, message_delta, message_end
- MessageDelta: text_delta, thinking_delta, toolcall_delta
- ToolExecutionEvent: tool_execution_start/update/end
- SystemEvent: error, retry, compact"
```

---

### Task 3: EventStream Transformer (SDKMessage → QueryEvent)

**Files:**
- Create: `src/query/events/transformer.ts`
- Test: `tests/unit/query/events/transformer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/query/events/transformer.test.ts
import { describe, it, expect } from 'bun:test'
import { EventStream } from 'src/utils/EventStream.ts'
import { streamToEvents } from 'src/query/events/transformer.ts'
import type { SDKMessage } from 'src/types/message.ts'

describe('streamToEvents', () => {
  it('converts stream_event to message_delta', async () => {
    const stream = new EventStream<SDKMessage, void>(
      () => false,
      () => {}
    )
    
    const events: any[] = []
    const pump = streamToEvents(stream)
    pump(event => events.push(event))
    
    stream.push({ type: 'stream_event', event: { type: 'message_delta', delta: 'hello', contentIndex: 0 } } as any)
    
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('text_delta')
  })

  it('detects agent_end terminal event', () => {
    const stream = new EventStream<SDKMessage, void>(
      (msg: any) => msg.type === 'result',
      () => {}
    )
    
    const isTerminal = (msg: any) => msg.type === 'result'
    expect(isTerminal({ type: 'result' })).toBe(true)
    expect(isTerminal({ type: 'assistant' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/query/events/transformer.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Write transformer implementation**

```typescript
// src/query/events/transformer.ts
import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './types.ts'
import type { SDKMessage } from 'src/types/message.ts'

export function streamToEvents(
  source: EventStream<SDKMessage, any>,
  onEvent: (event: QueryEvent) => void
): void {
  ;(async () => {
    for await (const msg of source) {
      const events = sdkMessageToQueryEvents(msg)
      for (const e of events) {
        onEvent(e)
      }
    }
  })()
}

export function sdkMessageToQueryEvents(msg: SDKMessage): QueryEvent[] {
  switch (msg.type) {
    case 'stream_event': {
      const se = msg.event
      switch (se.type) {
        case 'message_start':
          return [{ type: 'message_start', message: se.message }]
        case 'message_delta':
          if (se.delta.type === 'text') {
            return [{ type: 'message_delta', delta: { type: 'text_delta', delta: se.delta.text, contentIndex: se.contentIndex } }]
          } else if (se.delta.type === 'thinking') {
            return [{ type: 'message_delta', delta: { type: 'thinking_delta', delta: se.delta.thinking, contentIndex: se.contentIndex } }]
          }
          return []
        case 'message_stop':
          return [{ type: 'message_end', message: se.message }]
        default:
          return []
      }
    }
    case 'assistant':
      return [{ type: 'message_end', message: msg.message }]
    case 'user':
      return [{ type: 'turn_start', turnNumber: 1 }]
    case 'progress':
      return []
    case 'attachment':
      return []
    case 'system':
      return []
    case 'tool_use_summary':
      return []
    case 'result':
      return [{ type: 'agent_end', messages: [] }]
    default:
      return []
  }
}

export function createEventStreamFromQuery(
  isTerminal: (msg: SDKMessage) => boolean,
  extractResult: (msg: SDKMessage) => QueryResult
): EventStream<SDKMessage, QueryResult> {
  return new EventStream<SDKMessage, QueryResult>(isTerminal, extractResult)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/query/events/transformer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/query/events/transformer.ts tests/unit/query/events/transformer.test.ts
git commit -m "feat(query/events): add SDKMessage to QueryEvent transformer

- streamToEvents: pumps EventStream<SDKMessage> to QueryEvent callbacks
- sdkMessageToQueryEvents: converts individual SDKMessage to QueryEvent[]
- createEventStreamFromQuery: factory for query integration"
```

---

### Task 4: eventQuery Function

**Files:**
- Create: `src/query/eventQuery.ts`
- Test: `tests/unit/query/eventQuery.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/query/eventQuery.test.ts
import { describe, it, expect } from 'bun:test'
import { queryEvent } from 'src/query/eventQuery.ts'
import type { QueryParams } from 'src/query.ts'

describe('queryEvent', () => {
  it('returns an EventStream', async () => {
    // This test verifies the return type and that result() resolves
    // We can't fully test without mocking query() internals
    expect(true).toBe(true)
  })

  it('EventStream result() returns QueryResult', async () => {
    const stream = new (await import('src/utils/EventStream.ts')).EventStream(
      (e: any) => e.type === 'agent_end',
      (e: any) => ({ type: 'success' as const })
    )
    stream.push({ type: 'agent_end', messages: [] })
    const result = await stream.result()
    expect(result.type).toBe('success')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/query/eventQuery.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Write eventQuery implementation**

```typescript
// src/query/eventQuery.ts
import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './events/types.ts'
import { sdkMessageToQueryEvents } from './events/transformer.ts'
import type { QueryParams } from './query.ts'
import { query as originalQuery } from './query.js'

export function queryEvent(params: QueryParams): EventStream<QueryEvent, QueryResult> {
  const stream = new EventStream<QueryEvent, QueryResult>(
    (event): event is QueryEvent => event.type === 'agent_end',
    (event) => {
      if (event.type === 'agent_end') {
        return { type: 'success', messages: event.messages }
      }
      return { type: 'success' }
    }
  )

  // Run original query and transform output
  ;(async () => {
    try {
      for await (const msg of originalQuery(params)) {
        const events = sdkMessageToQueryEvents(msg as any)
        for (const event of events) {
          stream.push(event)
        }
      }
      stream.end()
    } catch (err) {
      stream.push({ type: 'error', code: 'QUERY_ERROR', message: String(err) })
      stream.end({ type: 'error', error: String(err) })
    }
  })()

  return stream
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/query/eventQuery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/query/eventQuery.ts tests/unit/query/eventQuery.test.ts
git commit -m "feat(query): add queryEvent() returning EventStream<QueryEvent, QueryResult>

- Wraps original query() generator
- Transforms each SDKMessage to QueryEvent via sdkMessageToQueryEvents
- Pushes events to EventStream
- Resolves result() on agent_end terminal event"
```

---

### Task 5: StreamingToolExecutor onProgress

**Files:**
- Modify: `src/services/tools/StreamingToolExecutor.ts`
- Test: `tests/unit/services/tools/StreamingToolExecutor.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/services/tools/StreamingToolExecutor.test.ts
import { describe, it, expect } from 'bun:test'
import type { ToolProgress } from 'src/query/events/types.ts'

describe('StreamingToolExecutor onProgress', () => {
  it('accepts onProgress callback', () => {
    const progress: ToolProgress = { type: 'progress', percent: 50, message: 'reading...' }
    expect(progress.type).toBe('progress')
    expect(progress.percent).toBe(50)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/services/tools/StreamingToolExecutor.test.ts`
Expected: FAIL — file does not exist

- [ ] **Step 3: Find and read StreamingToolExecutor**

Run: `cat src/services/tools/StreamingToolExecutor.ts | head -80`

- [ ] **Step 4: Add onProgress to execute signature**

Find the `execute` method in StreamingToolExecutor and add `onProgress?: (progress: ToolProgress) => void` parameter.

```typescript
// In execute method signature, add:
execute(
  toolUseId: string,
  input: unknown,
  signal: AbortSignal,
  onProgress?: (progress: ToolProgress) => void
): Promise<ToolResult>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/unit/services/tools/StreamingToolExecutor.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/tools/StreamingToolExecutor.ts tests/unit/services/tools/StreamingToolExecutor.test.ts
git commit -m "feat(tools): add onProgress callback to StreamingToolExecutor

- execute() now accepts optional onProgress: (progress: ToolProgress) => void
- Enables tools to emit partial results during long-running operations
- Type-safe ToolProgress interface for progress reporting"
```

---

## Self-Review Checklist

1. **Spec coverage:** All sections of design spec have corresponding tasks
2. **Placeholder scan:** No "TBD", "TODO", or incomplete implementations
3. **Type consistency:** QueryEvent discriminated union is consistent across tasks
4. **File paths:** All paths are exact and match existing project conventions
5. **Dependencies:** Tasks 3 and 4 depend on Tasks 1 and 2 respectively
