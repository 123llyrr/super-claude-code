import { describe, it, expect } from 'bun:test'
import { SearchEngine } from 'src/services/tool-search/SearchEngine.ts'
import type { ToolMetadata } from '../../src/services/tool-search/types.js'

describe('SearchEngine', () => {
  const tools: ToolMetadata[] = [
    { name: 'file_read', description: 'Read file contents', keywords: ['file', 'io'], source: 'builtin' },
    { name: 'file_write', description: 'Write to file', keywords: ['file', 'io'], source: 'builtin' },
    { name: 'git_commit', description: 'Create git commit', keywords: ['git', 'vcs'], source: 'builtin' },
    { name: 'git_push', description: 'Push to remote', keywords: ['git', 'vcs'], source: 'builtin' },
  ]

  it('should search tools by keyword', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('git')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tool.name).toMatch(/git/)
  })

  it('should return results ordered by relevance', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('git commit')
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0)
  })

  it('should respect maxResults limit', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('file', { maxResults: 1 })
    expect(results).toHaveLength(1)
  })

  it('should return empty array for no matches', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('xyzabc123')
    expect(results).toHaveLength(0)
  })
})
