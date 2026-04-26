export interface ToolMetadata {
  name: string
  description: string
  keywords: string[]
  source: 'builtin' | 'mcp'
  // 延迟加载用
  load?: () => Promise<ToolHandler>
}

export interface ToolHandler {
  name: string
  description: string
  execute: (args: unknown) => Promise<unknown>
}

export interface SearchResult {
  tool: ToolMetadata
  score: number
  rank: number
}

export interface ToolSearchConfig {
  enabled: boolean
  autoHighlight: boolean
  maxSuggestions: number
  indexCachePath: string
  bm25Params: {
    k1: number
    b: number
  }
}

export const DEFAULT_CONFIG: ToolSearchConfig = {
  enabled: true,
  autoHighlight: true,
  maxSuggestions: 3,
  indexCachePath: '.claude/tool-index.json',
  bm25Params: { k1: 1.5, b: 0.75 },
}