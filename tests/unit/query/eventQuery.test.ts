import { describe, it, expect } from 'bun:test'
import { queryEvent } from 'src/query/eventQuery.ts'
import type { QueryParams } from 'src/query.ts'

// Minimal valid params for testing type-level behavior
const mockParams: QueryParams = {
  messages: [],
  systemPrompt: { type: 'system', content: '' },
  userContext: {},
  systemContext: {},
  canUseTool: async () => ({ behavior: 'allow' } as any),
  toolUseContext: {
    options: {
      tools: [],
      mainLoopModel: 'claude-sonnet-4-6',
      isNonInteractiveSession: true,
      agentDefinitions: { activeAgents: [], allAgents: [], allowedAgentTypes: [] },
      mcpClients: [],
    },
    getAppState: () => ({
      toolPermissionContext: { mode: 'default', alwaysAllowRules: {} },
      mcp: { tools: [], clients: [] },
      fastMode: false,
      effortValue: undefined,
      advisorModel: undefined,
    }),
    setAppState: () => {},
    abortController: new AbortController(),
    addNotification: () => '',
    removeNotification: () => {},
    setHasInterruptibleToolInProgress: () => {},
    setInProgressToolUseIDs: () => {},
    readFileState: { get: () => undefined, set: () => {}, has: () => false },
  } as any,
  querySource: 'test' as any,
}

describe('queryEvent', () => {
  it('returns an EventStream with expected API surface', () => {
    const stream = queryEvent(mockParams)
    expect(typeof stream.push).toBe('function')
    expect(typeof stream.end).toBe('function')
    expect(typeof stream.result).toBe('function')
    expect(typeof stream.subscribe).toBe('function')
    expect(typeof stream[Symbol.asyncIterator]).toBe('function')
    expect(typeof stream.endWithError).toBe('function')
  })

  it('has error getter initially undefined', () => {
    const stream = queryEvent(mockParams)
    expect(stream.error).toBeUndefined()
  })

  it('result() returns a Promise', () => {
    const stream = queryEvent(mockParams)
    const resultPromise = stream.result()
    expect(resultPromise).toBeInstanceOf(Promise)
  })
})
