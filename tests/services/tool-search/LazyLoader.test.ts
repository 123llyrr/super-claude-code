import { describe, it, expect } from 'bun:test'
import { LazyLoader } from 'src/services/tool-search/LazyLoader.ts'
import type { ToolMetadata, ToolHandler } from 'src/services/tool-search/types.ts'

describe('LazyLoader', () => {
  it('should not load tool until requested', async () => {
    let loadCalled = false
    const loader = new LazyLoader()

    const tool: ToolMetadata = {
      name: 'test_tool',
      description: 'Test tool',
      keywords: ['test'],
      source: 'builtin',
      load: async () => {
        loadCalled = true
        return { name: 'test_tool', description: 'Test', execute: async () => 'result' }
      },
    }

    loader.register(tool)
    expect(loadCalled).toBe(false)

    const handler = await loader.load('test_tool')
    expect(loadCalled).toBe(true)
    expect(handler).toBeDefined()
  })

  it('should cache loaded tools', async () => {
    let loadCount = 0
    const loader = new LazyLoader()

    const tool: ToolMetadata = {
      name: 'test_tool',
      description: 'Test tool',
      keywords: ['test'],
      source: 'builtin',
      load: async () => {
        loadCount++
        return { name: 'test_tool', description: 'Test', execute: async () => 'result' }
      },
    }

    loader.register(tool)
    await loader.load('test_tool')
    await loader.load('test_tool')

    expect(loadCount).toBe(1)
  })

  it('should return undefined for non-registered tool', async () => {
    const loader = new LazyLoader()
    const handler = await loader.load('nonexistent')
    expect(handler).toBeUndefined()
  })
})
