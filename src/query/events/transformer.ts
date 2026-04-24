import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './types.ts'
import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js'

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

export function sdkMessageToQueryEvents(msg: SDKMessage): QueryEvent[] {
  switch (msg.type) {
    case 'stream_event': {
      const se = msg.event as { type: string; [key: string]: unknown }
      switch (se.type) {
        case 'message_start':
          return [
            {
              type: 'message_start',
              message: (se as { message: unknown }).message,
            },
          ]
        case 'message_delta': {
          const delta = (se as { delta: { type: string; text?: string; thinking?: string; contentIndex?: number }; contentIndex?: number }).delta
          if (delta.type === 'text') {
            return [
              {
                type: 'message_delta',
                delta: {
                  type: 'text_delta',
                  delta: delta.text ?? '',
                  contentIndex: se.contentIndex as number,
                },
              },
            ]
          } else if (delta.type === 'thinking') {
            return [
              {
                type: 'message_delta',
                delta: {
                  type: 'thinking_delta',
                  delta: delta.thinking ?? '',
                  contentIndex: se.contentIndex as number,
                },
              },
            ]
          }
          return []
        }
        case 'message_stop':
          return [
            {
              type: 'message_end',
              message: (se as { message: unknown }).message,
            },
          ]
        default:
          return []
      }
    }
    case 'assistant':
      return [{ type: 'message_end', message: (msg as { message: unknown }).message }]
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
  extractResult: (msg: SDKMessage) => QueryResult,
): EventStream<SDKMessage, QueryResult> {
  return new EventStream<SDKMessage, QueryResult>(isTerminal, extractResult)
}