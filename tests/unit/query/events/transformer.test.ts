import { describe, it, expect } from 'bun:test'
import { EventStream } from 'src/utils/EventStream.ts'
import { streamToEvents, sdkMessageToQueryEvents, queryOutputToQueryEvents, resetTurnTracking, createEventStreamFromQuery } from 'src/query/events/transformer.ts'
import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js'

describe('queryOutputToQueryEvents', () => {
  // Reset turn tracking before each test via explicit call in each test
  it('converts stream_event message_start', () => {
    const events = queryOutputToQueryEvents({
      type: 'stream_event',
      event: { type: 'message_start', message: { id: 'msg-1', type: 'assistant', role: 'assistant' } },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_start')
  })

  it('converts stream_event text_delta', () => {
    const events = queryOutputToQueryEvents({
      type: 'stream_event',
      event: { type: 'message_delta', delta: { type: 'text', text: 'Hello!' }, contentIndex: 0 },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('text_delta')
      expect(events[0].delta.delta).toBe('Hello!')
    }
  })

  it('converts stream_event thinking_delta', () => {
    const events = queryOutputToQueryEvents({
      type: 'stream_event',
      event: { type: 'message_delta', delta: { type: 'thinking', thinking: 'Hmm...' }, contentIndex: 0 },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('thinking_delta')
    }
  })

  it('converts stream_event toolcall_delta (input_json_delta)', () => {
    const events = queryOutputToQueryEvents({
      type: 'stream_event',
      event: { type: 'message_delta', delta: { type: 'input_json_delta', input_json_delta: { partial_json: '{"file' } }, contentIndex: 1 },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('toolcall_delta')
      expect(events[0].delta.delta).toBe('{"file')
    }
  })

  it('converts stream_event message_stop to message_end', () => {
    const events = queryOutputToQueryEvents({
      type: 'stream_event',
      event: { type: 'message_stop', message: { id: 'msg-1', type: 'assistant' } },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_end')
  })

  it('converts assistant message with tool_use to tool_execution_start', () => {
    const events = queryOutputToQueryEvents({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me run a command' },
          { type: 'tool_use', id: 'tool-1', name: 'Bash', input: { command: 'ls' } },
        ],
      },
    } as any)
    const startEvents = events.filter(e => e.type === 'tool_execution_start')
    expect(startEvents.length).toBe(1)
    if (startEvents[0].type === 'tool_execution_start') {
      expect(startEvents[0].toolCallId).toBe('tool-1')
      expect(startEvents[0].toolName).toBe('Bash')
    }
  })

  it('converts user message with tool_result to tool_execution_end', () => {
    const events = queryOutputToQueryEvents({
      type: 'user',
      toolUseResult: 'some output',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'tool-1', content: 'file1.txt\nfile2.txt', is_error: false },
        ],
      },
    } as any)
    const endEvents = events.filter(e => e.type === 'tool_execution_end')
    expect(endEvents.length).toBe(1)
    if (endEvents[0].type === 'tool_execution_end') {
      expect(endEvents[0].toolCallId).toBe('tool-1')
      expect(endEvents[0].isError).toBe(false)
    }
  })

  it('converts user message with error tool_result', () => {
    const events = queryOutputToQueryEvents({
      type: 'user',
      toolUseResult: 'error',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'tool-2', content: 'Permission denied', is_error: true },
        ],
      },
    } as any)
    const endEvents = events.filter(e => e.type === 'tool_execution_end')
    expect(endEvents.length).toBe(1)
    if (endEvents[0].type === 'tool_execution_end') {
      expect(endEvents[0].isError).toBe(true)
    }
  })

  it('converts real user input (no toolUseResult) to turn_start with incrementing number', () => {
    resetTurnTracking()
    const e1 = queryOutputToQueryEvents({
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      isMeta: false,
    } as any)
    expect(e1.length).toBe(1)
    expect(e1[0].type).toBe('turn_start')
    if (e1[0].type === 'turn_start') expect(e1[0].turnNumber).toBe(1)

    const e2 = queryOutputToQueryEvents({
      type: 'user',
      message: { role: 'user', content: 'Second message' },
      isMeta: false,
    } as any)
    expect(e2[0].type).toBe('turn_start')
    if (e2[0].type === 'turn_start') expect(e2[0].turnNumber).toBe(2)
  })

  it('skips isMeta user messages for turn counting', () => {
    resetTurnTracking()
    queryOutputToQueryEvents({
      type: 'user',
      message: { role: 'user', content: 'meta' },
      isMeta: true,
    } as any)
    // Turn count should still be 0 (isMeta not counted)
    const e2 = queryOutputToQueryEvents({
      type: 'user',
      message: { role: 'user', content: 'real' },
      isMeta: false,
    } as any)
    if (e2[0].type === 'turn_start') expect(e2[0].turnNumber).toBe(1)
  })

  it('converts system api_retry to retry event', () => {
    const events = queryOutputToQueryEvents({
      type: 'system',
      subtype: 'api_error',
      retryAttempt: 2,
      retryInMs: 5000,
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('retry')
  })

  it('converts system compact_boundary to compact event', () => {
    const events = queryOutputToQueryEvents({
      type: 'system',
      subtype: 'compact_boundary',
      compactMetadata: { tokensSaved: 15000 },
    } as any)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('compact')
  })

  it('returns empty for stream_request_start', () => {
    const events = queryOutputToQueryEvents({ type: 'stream_request_start' } as any)
    expect(events.length).toBe(0)
  })

  it('returns empty for tombstone', () => {
    const events = queryOutputToQueryEvents({ type: 'tombstone', message: {} } as any)
    expect(events.length).toBe(0)
  })

  it('returns empty for attachment messages', () => {
    const events = queryOutputToQueryEvents({
      type: 'attachment',
      attachment: { type: 'file', name: 'test.txt' },
    } as any)
    expect(events.length).toBe(0)
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
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('text_delta')
      expect(events[0].delta.delta).toBe('Hello, world!')
    }
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
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('thinking_delta')
      expect(events[0].delta.delta).toBe('Hmm, let me think...')
    }
  })

  it('converts toolcall_delta (input_json_delta)', () => {
    const msg: SDKMessage = {
      type: 'stream_event',
      event: {
        type: 'message_delta',
        delta: { type: 'input_json_delta', input_json_delta: { partial_json: '{"pattern":' } },
        contentIndex: 2,
      },
      session_id: 'test',
      uuid: 'test-uuid',
      parent_tool_use_id: null,
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('message_delta')
    if (events[0].type === 'message_delta') {
      expect(events[0].delta.type).toBe('toolcall_delta')
    }
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

  it('converts user message (no tool result) to turn_end', () => {
    const msg: SDKMessage = {
      type: 'user',
      message: { role: 'user', content: 'Hello' },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('turn_end')
  })

  it('converts progress messages to tool_execution_update', () => {
    const msg: SDKMessage = {
      type: 'progress',
      toolUseID: 'tool-1',
      data: { type: 'bash_progress', percent: 50 },
      session_id: 'test',
      uuid: 'test-uuid',
      tool_use_id: 'tool-1',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    expect(events.length).toBe(1)
    expect(events[0].type).toBe('tool_execution_update')
  })

  it('converts assistant with tool_use to tool_execution_start', () => {
    const msg: SDKMessage = {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'tool-3', name: 'Read', input: { file_path: '/tmp/x' } },
        ],
      },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage

    const events = sdkMessageToQueryEvents(msg)
    const starts = events.filter(e => e.type === 'tool_execution_start')
    expect(starts.length).toBe(1)
  })

  it('returns empty for attachment messages', () => {
    const msg: SDKMessage = {
      type: 'attachment',
      attachment: { type: 'file', name: 'test.txt' },
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage
    expect(sdkMessageToQueryEvents(msg).length).toBe(0)
  })

  it('returns empty for system messages', () => {
    const msg: SDKMessage = {
      type: 'system',
      subtype: 'init',
      session_id: 'test',
      uuid: 'test-uuid',
    } as SDKMessage
    expect(sdkMessageToQueryEvents(msg).length).toBe(0)
  })
})

describe('streamToEvents', () => {
  it('converts stream_event to message_delta via callback', async () => {
    const stream = new EventStream<SDKMessage, void>(
      (msg) => msg.type === 'result',
      () => undefined,
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
})

describe('createEventStreamFromQuery', () => {
  it('factory returns a working EventStream', () => {
    const stream = createEventStreamFromQuery(
      (msg: SDKMessage) => msg.type === 'result',
      (_msg: SDKMessage) => ({ type: 'success' }),
    )
    expect(stream).toBeInstanceOf(EventStream)
  })
})
