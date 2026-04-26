import type { Message } from '../../types/message.js'

// --- Agent lifecycle ---
export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: Message[] }

// --- Turn lifecycle ---
export type TurnEvent =
  | { type: 'turn_start'; turnNumber: number }
  | { type: 'turn_end'; turnNumber: number; message: Message; toolResults: Message[] }

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
  | { type: 'tool_execution_end'; toolCallId: string; result: unknown; isError: boolean }

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
  messages?: Message[]
  error?: string
}
