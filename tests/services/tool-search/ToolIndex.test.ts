import { describe, it, expect, beforeEach } from 'bun:test'
import { ToolIndex } from 'src/services/tool-search/ToolIndex.ts'
import type { ToolMetadata } from 'src/services/tool-search/types.ts'

describe('ToolIndex', () => {
  let index: ToolIndex

  beforeEach(() => {
    index = new ToolIndex()
  })

  it('should add and retrieve tools', () => {
    const tool: ToolMetadata = {
      name: 'git_commit',
      description: 'Create a git commit',
      keywords: ['git', 'commit', 'vcs'],
      source: 'builtin',
    }
    index.add(tool)
    const retrieved = index.get('git_commit')
    expect(retrieved).toEqual(tool)
  })

  it('should return all tools', () => {
    index.add({ name: 'a', description: '', keywords: [], source: 'builtin' })
    index.add({ name: 'b', description: '', keywords: [], source: 'mcp' })
    expect(index.getAll()).toHaveLength(2)
  })

  it('should clear all tools', () => {
    index.add({ name: 'a', description: '', keywords: [], source: 'builtin' })
    index.clear()
    expect(index.getAll()).toHaveLength(0)
  })

  it('should build corpus for BM25', () => {
    index.add({ name: 'file_read', description: 'Read files', keywords: ['io'], source: 'builtin' })
    const corpus = index.buildCorpus()
    expect(corpus.length).toBe(1)
    expect(corpus[0].name).toBe('file_read')
  })
})
