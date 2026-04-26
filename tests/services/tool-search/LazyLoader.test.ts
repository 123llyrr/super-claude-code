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

  describe('isLoaded', () => {
    it('should return false before tool is loaded', async () => {
      const loader = new LazyLoader()
      const tool: ToolMetadata = {
        name: 'test_tool',
        description: 'Test tool',
        keywords: ['test'],
        source: 'builtin',
        load: async () => ({ name: 'test_tool', description: 'Test', execute: async () => 'result' }),
      }
      loader.register(tool)
      expect(loader.isLoaded('test_tool')).toBe(false)
    })

    it('should return true after tool is loaded', async () => {
      const loader = new LazyLoader()
      const tool: ToolMetadata = {
        name: 'test_tool',
        description: 'Test tool',
        keywords: ['test'],
        source: 'builtin',
        load: async () => ({ name: 'test_tool', description: 'Test', execute: async () => 'result' }),
      }
      loader.register(tool)
      await loader.load('test_tool')
      expect(loader.isLoaded('test_tool')).toBe(true)
    })
  })

  describe('clearCache', () => {
    it('should clear the cache after loading a tool', async () => {
      const loader = new LazyLoader()
      const tool: ToolMetadata = {
        name: 'test_tool',
        description: 'Test tool',
        keywords: ['test'],
        source: 'builtin',
        load: async () => ({ name: 'test_tool', description: 'Test', execute: async () => 'result' }),
      }
      loader.register(tool)
      await loader.load('test_tool')
      expect(loader.isLoaded('test_tool')).toBe(true)

      loader.clearCache()
      expect(loader.isLoaded('test_tool')).toBe(false)
    })
  })

  describe('getRegisteredTools', () => {
    it('should return all registered tools', () => {
      const loader = new LazyLoader()
      const tool1: ToolMetadata = {
        name: 'tool_one',
        description: 'First tool',
        keywords: ['one'],
        source: 'builtin',
        load: async () => ({ name: 'tool_one', description: 'First', execute: async () => 'result' }),
      }
      const tool2: ToolMetadata = {
        name: 'tool_two',
        description: 'Second tool',
        keywords: ['two'],
        source: 'builtin',
        load: async () => ({ name: 'tool_two', description: 'Second', execute: async () => 'result' }),
      }
      loader.register(tool1)
      loader.register(tool2)

      const tools = loader.getRegisteredTools()
      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toEqual(['tool_one', 'tool_two'])
    })

    it('should return empty array when no tools registered', () => {
      const loader = new LazyLoader()
      const tools = loader.getRegisteredTools()
      expect(tools).toHaveLength(0)
    })
  })
})
