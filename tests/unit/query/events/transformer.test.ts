import { describe, it, expect } from 'bun:test'
import { EventStream } from 'src/utils/EventStream.ts'
import { streamToEvents, sdkMessageToQueryEvents } from 'src/query/events/transformer.ts'
import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js'

describe('streamToEvents', () => {
  it('converts stream_event to message_delta', async () => {
    const stream = new EventStream<SDKMessage, void>(
      (msg) => msg.type === 'result',
      () => undefined
    )

    const events: any[] = []
    streamToEvents(stream, (event) => events.push(event))

    stream.push({
      type: 'stream_event',
      event: { type: 'message_delta', delta: { type: 'text', text: 'hello' }, contentIndex: 0 },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage)

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('message_delta')
  })

  it('detects agent_end terminal event', () => {
    const isTerminal = (msg: SDKMessage) => msg.type === 'result'
    expect(isTerminal({ type: 'result' } as SDKMessage)).toBe(true)
    expect(isTerminal({ type: 'assistant' } as SDKMessage)).toBe(false)
  })
})

describe('sdkMessageToQueryEvents', () => {
  it('converts message_start event', () => {
    const msg: SDKMessage = {
      type: 'stream_event',
      event: {
        type: 'message_start',
        message: { id: 'msg-1', type: 'assistant', role: 'assistant' },
      },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_start')
  })

  it('converts text_delta event', () => {
    const msg: SDKMessage = {
      type: 'stream_event',
      event: {
        type: 'message_delta',
        delta: { type: 'text', text: 'Hello, world!' },
        contentIndex: 0,
      },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    expect(events[0].delta.type).toBe('text_delta')
    expect(events[0].delta.delta).toBe('Hello, world!')
  })

  it('converts thinking_delta event', () => {
    const msg: SDKMessage = {
      type: 'stream_event',
      event: {
        type: 'message_delta',
        delta: { type: 'thinking', thinking: 'Hmm, let me think...' },
        contentIndex: 0,
      },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    expect(events[0].delta.type).toBe('thinking_delta')
    expect(events[0].delta.delta).toBe('Hmm, let me think...')
  })

  it('converts message_stop to message_end', () => {
    const msg: SDKMessage = {
      type: 'stream_event',
      event: {
        type: 'message_stop',
        message: { id: 'msg-1', type: 'assistant', role: 'assistant' },
      },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_end')
  })

  it('converts result to agent_end', () => {
    const msg: SDKMessage = {
      type: 'result',
      message: { content: [] },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('agent_end')
  })

  it('converts user message to turn_start', () => {
    const msg: SDKMessage = {
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('turn_start')
  })

  it('returns empty array for progress messages', () => {
    const msg: SDKMessage = {
      type: 'progress',
      session_id: 'test',
      uuid: 'test-uuid',
      tool_use_id: 'tool-1',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(0)
  })

  it('returns empty array for attachment messages', () => {
    const msg: SDKMessage = {
      type: 'attachment',
      attachment: { type: 'file', name: 'test.txt' },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(0)
  })

  it('returns empty array for system messages', () => {
    const msg: SDKMessage = {
      type: 'system',
      subtype: 'init',
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(0)
  })
})