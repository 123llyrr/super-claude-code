import type { ToolMetadata, SearchResult } from './types.js'

export interface SearchOptions {
  maxResults?: number
}

export class SearchEngine {
  private tools: ToolMetadata[]
  private corpus: Map<string, { name: string; description: string; keywords: string[] }>

  constructor(tools: ToolMetadata[] = []) {
    this.tools = tools
    this.corpus = new Map()
    this.buildCorpus()
  }

  private buildCorpus(): void {
    this.corpus.clear()
    for (const tool of this.tools) {
      this.corpus.set(tool.name, {
        name: tool.name,
        description: tool.description,
        keywords: tool.keywords,
      })
    }
  }

  addTools(tools: ToolMetadata[]): void {
    this.tools.push(...tools)
    this.buildCorpus()
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { maxResults = 10 } = options
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean)

    if (queryTerms.length === 0) {
      return []
    }

    const scores = new Map<string, number>()

    for (const [name, doc] of this.corpus) {
      let score = 0
      const docText = `${doc.name} ${doc.description} ${doc.keywords.join(' ')}`.toLowerCase()

      for (const term of queryTerms) {
        // Simple TF-based scoring (BM25-lite)
        const regex = new RegExp(term, 'gi')
        const matches = docText.match(regex)
        if (matches) {
          // name matches weight 3x, keywords 2x, description 1x
          const nameMatches = (doc.name.toLowerCase().match(regex) || []).length
          const keywordMatches = (doc.keywords.join(' ').toLowerCase().match(regex) || []).length
          // matches.length includes name + description + keywords, so subtract to get description matches
          const descriptionMatches = matches.length - nameMatches - keywordMatches
          score += nameMatches * 3 + keywordMatches * 2 + descriptionMatches
        }
      }

      if (score > 0) {
        scores.set(name, score)
      }
    }

    const results: SearchResult[] = []
    for (const [name, score] of scores) {
      const tool = this.tools.find(t => t.name === name)!
      results.push({ tool, score, rank: 0 })
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    // Assign ranks
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1
    }

    return results.slice(0, maxResults)
  }

  size(): number {
    return this.tools.length
  }
}
