// src/middleware/toolDiscovery.ts
import type { SearchResult } from '../services/tool-search/types.js'
import { SearchEngine } from '../services/tool-search/SearchEngine.js'
import { toolRegistry } from '../services/tool-search/ToolRegistry.js'
import { DEFAULT_CONFIG } from '../services/tool-search/types.js'

export interface ToolDiscoveryMiddleware {
  enabled: boolean
  autoHighlight: boolean
  searchEngine: SearchEngine

  processInput(input: string): SearchResult[]
}

export function createToolDiscoveryMiddleware(): ToolDiscoveryMiddleware {
  return {
    enabled: DEFAULT_CONFIG.enabled,
    autoHighlight: DEFAULT_CONFIG.autoHighlight,
    searchEngine: new SearchEngine(toolRegistry.getAll()),
  }
}

export function highlightTools(
  input: string,
  middleware: ToolDiscoveryMiddleware,
): SearchResult[] {
  if (!middleware.enabled || !middleware.autoHighlight) {
    return []
  }
  return middleware.searchEngine.search(input, {
    maxResults: DEFAULT_CONFIG.maxSuggestions,
  })
}
