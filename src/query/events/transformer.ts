import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './types.ts'
import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js'
import type { StreamEvent, Message, RequestStartEvent, TombstoneMessage, ToolUseSummaryMessage } from '../../types/message.js'

// ── Input type: the union of all types yielded by query() generator ──
type QueryGeneratorOutput =
  | StreamEvent
  | RequestStartEvent
  | Message
  | TombstoneMessage
  | ToolUseSummaryMessage

// Turn tracking state for the transformer
const turnTracking = { currentTurn: 0 }

/** Reset turn counter (call at start of each top-level query) */
export function resetTurnTracking(): void {
  turnTracking.currentTurn = 0
}

/**
 * Transform query() generator output to QueryEvent array.
 * This handles the actual types from the internal query() generator,
 * NOT the SDK types.
 */
export function queryOutputToQueryEvents(msg: QueryGeneratorOutput): QueryEvent[] {
  switch (msg.type) {
    // ── Stream events ──
    case 'stream_event': {
      const se = msg.event
      switch (se.type) {
        case 'message_start':
          return [{ type: 'message_start', message: se.message as Message }]
        case 'message_delta': {
          const delta = se.delta as { type: string; text?: string; thinking?: string; input_json_delta?: { partial_json: string }; contentIndex?: number }
          if (delta.type === 'text_delta' || delta.type === 'text') {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'text_delta' as const,
                delta: delta.text ?? '',
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          if (delta.type === 'thinking_delta' || delta.type === 'thinking') {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'thinking_delta' as const,
                delta: delta.thinking ?? '',
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          if (delta.type === 'input_json_delta' && delta.input_json_delta) {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'toolcall_delta' as const,
                delta: delta.input_json_delta.partial_json,
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          return []
        }
        case 'content_block_delta':
          // Stream-level tool call delta
          if (se.delta && typeof se.delta === 'object') {
            const cd = se.delta as { type: string; text?: string; input_json_delta?: { partial_json: string } }
            if (cd.type === 'input_json_delta' && cd.input_json_delta) {
              return [{
                type: 'message_delta' as const,
                delta: {
                  type: 'toolcall_delta' as const,
                  delta: cd.input_json_delta.partial_json,
                  contentIndex: se.index as number ?? 0,
                },
              }]
            }
          }
          return []
        case 'message_stop':
          return [{ type: 'message_end', message: se.message as Message }]
        default:
          return []
      }
    }
    // ── Request start ──
    case 'stream_request_start':
      return []

    // ── Tombstone ──
    case 'tombstone':
      return []

    // ── Messages ──
    case 'assistant': {
      const events: QueryEvent[] = []
      // Emit tool_execution_start for any tool_use blocks in this message
      const content = (msg as { message: { content: Array<{ type: string; id?: string; name?: string; input?: unknown }> } }).message.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            events.push({
              type: 'tool_execution_start',
              toolCallId: block.id ?? '',
              toolName: block.name ?? '',
              args: block.input ?? {},
            })
          }
        }
      }
      return events
    }
    case 'user': {
      const userMsg = msg as { message: { content: unknown; role: string }; toolUseResult?: unknown; isMeta?: boolean }
      const isToolResult = !!userMsg.toolUseResult
      if (isToolResult) {
        // Detect tool_execution_end from tool_result blocks
        const events: QueryEvent[] = []
        const content = userMsg.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
              const tr = block as { tool_use_id?: string; content?: unknown; is_error?: boolean }
              events.push({
                type: 'tool_execution_end',
                toolCallId: tr.tool_use_id ?? '',
                result: tr.content,
                isError: tr.is_error ?? false,
              })
            }
          }
        }
        return events
      }
      // Real user input — increment turn
      if (!userMsg.isMeta) {
        turnTracking.currentTurn++
      }
      return [{
        type: 'turn_start',
        turnNumber: turnTracking.currentTurn,
      }]
    }
    case 'progress':
      return []
    case 'attachment':
      return []
    case 'system': {
      const sys = msg as { subtype?: string; content?: unknown; retryAttempt?: number; retryInMs?: number; compactMetadata?: { tokensSaved?: number } }
      if (sys.subtype === 'api_error' || sys.subtype === 'api_retry') {
        return [{
          type: 'retry',
          attempt: (sys.retryAttempt as number) ?? 0,
          delayMs: (sys.retryInMs as number) ?? 0,
        }]
      }
      if (sys.subtype === 'compact_boundary') {
        return [{
          type: 'compact',
          tokensSaved: sys.compactMetadata?.tokensSaved ?? 0,
        }]
      }
      return []
    }
    case 'tool_use_summary':
      return []

    default:
      return []
  }
}

// ── SDK path: transforms SDKMessage (from QueryEngine) to QueryEvent ──

/**
 * Transform an SDKMessage (from QueryEngine.submitMessage()) to QueryEvent array.
 * Used by SDK consumers that use the QueryEngine API.
 */
export function sdkMessageToQueryEvents(msg: SDKMessage): QueryEvent[] {
  switch (msg.type) {
    case 'stream_event': {
      const se = msg.event as { type: string; [key: string]: unknown }
      switch (se.type) {
        case 'message_start':
          return [{
            type: 'message_start',
            message: (se as { message: unknown }).message as Message,
          }]
        case 'message_delta': {
          const delta = (se as { delta: { type: string; text?: string; thinking?: string; input_json_delta?: { partial_json: string } }; contentIndex?: number }).delta
          if (delta.type === 'text_delta' || delta.type === 'text') {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'text_delta' as const,
                delta: delta.text ?? '',
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          if (delta.type === 'thinking_delta' || delta.type === 'thinking') {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'thinking_delta' as const,
                delta: delta.thinking ?? '',
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          if (delta.type === 'input_json_delta' && delta.input_json_delta) {
            return [{
              type: 'message_delta' as const,
              delta: {
                type: 'toolcall_delta' as const,
                delta: delta.input_json_delta.partial_json,
                contentIndex: se.contentIndex as number ?? 0,
              },
            }]
          }
          return []
        }
        case 'message_stop':
          return [{ type: 'message_end', message: (se as { message: unknown }).message as Message }]
        default:
          return []
      }
    }
    case 'assistant': {
      const events: QueryEvent[] = []
      const content = (msg as { message?: { content?: Array<{ type: string; id?: string; name?: string; input?: unknown }> } }).message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            events.push({
              type: 'tool_execution_start' as const,
              toolCallId: block.id ?? '',
              toolName: block.name ?? '',
              args: block.input ?? {},
            })
          }
        }
      }
      return events
    }
    case 'user':
      return [{
        type: 'turn_end' as const,
        turnNumber: turnTracking.currentTurn,
        message: (msg as { message: unknown }).message as Message,
        toolResults: [],
      }]
    case 'progress': {
      const p = msg as unknown as { toolUseID?: string; tool_use_id?: string; data?: { type: string; [key: string]: unknown } }
      return [{
        type: 'tool_execution_update' as const,
        toolCallId: p.toolUseID ?? p.tool_use_id ?? '',
        partialResult: p.data ?? { type: 'unknown' },
      }]
    }
    case 'system': {
      const sys = msg as { subtype?: string; retryAttempt?: number; retryInMs?: number; compactMetadata?: { tokensSaved?: number } }
      if (sys.subtype === 'api_retry') {
        return [{
          type: 'retry' as const,
          attempt: sys.retryAttempt ?? 0,
          delayMs: sys.retryInMs ?? 0,
        }]
      }
      if (sys.subtype === 'compact_boundary') {
        return [{
          type: 'compact' as const,
          tokensSaved: sys.compactMetadata?.tokensSaved ?? 0,
        }]
      }
      return []
    }
    case 'attachment':
      return []
    case 'tool_use_summary':
      return []
    case 'result':
      return [{ type: 'agent_end' as const, messages: [] }]
    default:
      return []
  }
}

// ── Stream-to-stream bridge ──

export function streamToEvents(
  source: EventStream<SDKMessage, any>,
  onEvent: (event: QueryEvent) => void,
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

export function createEventStreamFromQuery(
  isTerminal: (msg: SDKMessage) => boolean,
  extractResult: (msg: SDKMessage) => QueryResult,
): EventStream<SDKMessage, QueryResult> {
  return new EventStream<SDKMessage, QueryResult>(isTerminal, extractResult)
}
