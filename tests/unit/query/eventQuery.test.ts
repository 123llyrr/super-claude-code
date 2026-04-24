import { describe, it, expect } from 'bun:test'
import { queryEvent } from 'src/query/eventQuery.ts'
import type { QueryParams } from 'src/query.ts'

// Mock QueryParams - minimal valid params for testing
const mockParams: QueryParams = {
  messages: [],
  systemPrompt: { type: 'system', content: '' },
  userContext: {},
  systemContext: {},
  canUseTool: () => true,
  toolUseContext: {
    options: { tools: [], mainLoopModel: 'test' },
    getAppState: () => ({}) as any,
  } as any,
  querySource: 'test',
}

describe('eventQuery', () => {
  it('queryEvent returns an EventStream', async () => {
    const stream = queryEvent(mockParams)
    // EventStream should have push, end, result, and async iterator methods
    expect(typeof stream.push).toBe('function')
    expect(typeof stream.end).toBe('function')
    expect(typeof stream.result).toBe('function')
    expect(typeof stream[Symbol.asyncIterator]).toBe('function')
  })
})