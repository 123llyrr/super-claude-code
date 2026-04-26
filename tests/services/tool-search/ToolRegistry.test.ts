import { describe, it, expect } from 'bun:test'
import { ToolRegistry } from 'src/services/tool-search/ToolRegistry.ts'
import type { ToolMetadata } from 'src/services/tool-search/types.ts'

describe('ToolRegistry', () => {
  it('should register and retrieve tool metadata', () => {
    const registry = new ToolRegistry()
    const tool: ToolMetadata = {
      name: 'file_read',
      description: 'Read file contents',
      keywords: ['file', 'read', 'io'],
      source: 'builtin',
    }
    registry.register(tool)
    expect(registry.get('file_read')).toEqual(tool)
  })

  it('should return all registered tools', () => {
    const registry = new ToolRegistry()
    registry.register({ name: 'a', description: '', keywords: [], source: 'builtin' })
    registry.register({ name: 'b', description: '', keywords: [], source: 'mcp' })
    expect(registry.getAll()).toHaveLength(2)
  })

  it('should return undefined for non-existent tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })
})