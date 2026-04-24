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