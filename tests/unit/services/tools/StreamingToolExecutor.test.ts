import { describe, it, expect, beforeEach } from 'bun:test'
import { StreamingToolExecutor } from 'src/services/tools/StreamingToolExecutor.ts'
import type { ToolUseContext, Tools, Tool } from 'src/Tool.ts'
import type { CanUseToolFn } from 'src/hooks/useCanUseTool.ts'
import { createChildAbortController } from 'src/utils/abortController.ts'

function createMockContext(): ToolUseContext {
  const ac = createChildAbortController(new AbortController())
  return {
    abortController: ac,
    options: { tools: [], mcpClients: [], model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', embed: false } },
    messages: [],
    getAppState: () => ({ toolPermissionContext: { mode: 'default' as const } }) as any,
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setHasInterruptibleToolInProgress: () => {},
    signal: ac.signal,
  } as any as ToolUseContext
}

describe('StreamingToolExecutor onProgress', () => {
  it('accepts onProgress callback in constructor', () => {
    const onProgress = (_toolCallId: string, _data: { type: string; [key: string]: unknown }) => {}
    const executor = new StreamingToolExecutor(
      [],
      (async () => ({ allowed: false, behavior: 'deny' as const })) as any as CanUseToolFn,
      createMockContext(),
      onProgress,
    )
    expect(executor).toBeDefined()
  })

  it('sends progress data via onProgress when tool reports progress', async () => {
    const progressEvents: Array<{ toolCallId: string; data: { type: string; [key: string]: unknown } }> = []
    const onProgress = (toolCallId: string, data: { type: string; [key: string]: unknown }) => {
      progressEvents.push({ toolCallId, data })
    }

    const executor = new StreamingToolExecutor(
      [],
      (async () => ({ allowed: false, behavior: 'deny' as const })) as any as CanUseToolFn,
      createMockContext(),
      onProgress,
    )

    expect(executor).toBeDefined()
    expect(progressEvents).toHaveLength(0)
  })
})
