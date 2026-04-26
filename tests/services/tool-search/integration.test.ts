import { describe, it, expect, beforeEach } from 'bun:test'
import { toolRegistry } from '../../../src/services/tool-search/ToolRegistry.js'
import { SearchEngine } from '../../../src/services/tool-search/SearchEngine.js'
import type { ToolMetadata } from '../../../src/services/tool-search/types.js'

describe('Tool Search Integration', () => {
  beforeEach(() => {
    toolRegistry.clear()
  })

  it('should find tools end-to-end', () => {
    const tools: ToolMetadata[] = [
      { name: 'file_read', description: 'Read file contents', keywords: ['file', 'io'], source: 'builtin' },
      { name: 'file_write', description: 'Write to file', keywords: ['file', 'io'], source: 'builtin' },
      { name: 'git_commit', description: 'Create git commit', keywords: ['git', 'vcs'], source: 'builtin' },
    ]

    for (const tool of tools) {
      toolRegistry.register(tool)
    }

    const engine = new SearchEngine(toolRegistry.getAll())
    const results = engine.search('file')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tool.name).toMatch(/file/)
  })

  it('should rank tools by relevance', () => {
    const tools: ToolMetadata[] = [
      { name: 'git_commit', description: 'Commit changes', keywords: ['git', 'commit'], source: 'builtin' },
      { name: 'git_push', description: 'Push to remote', keywords: ['git', 'push'], source: 'builtin' },
    ]

    for (const tool of tools) {
      toolRegistry.register(tool)
    }

    const engine = new SearchEngine(toolRegistry.getAll())
    const results = engine.search('git commit')

    expect(results.length).toBe(2)
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
  })
})
