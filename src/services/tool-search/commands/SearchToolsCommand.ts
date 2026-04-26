import type { Command } from '../../../types/command.js'
import { SearchEngine } from '../SearchEngine.js'
import { toolRegistry } from '../ToolRegistry.js'
import { DEFAULT_CONFIG } from '../types.js'

export const searchToolsCommand: Command = {
  name: 'search-tools',
  description: 'Search for available tools by keyword',

  async execute(query: string): Promise<void> {
    const tools = toolRegistry.getAll()
    const engine = new SearchEngine(tools)
    const results = engine.search(query, { maxResults: DEFAULT_CONFIG.maxSuggestions })

    if (results.length === 0) {
      console.log('No tools found matching your query.')
      return
    }

    console.log(`Found ${results.length} tool(s):\n`)
    for (const result of results) {
      console.log(`  ${result.rank}. ${result.tool.name} (score: ${result.score.toFixed(2)})`)
      console.log(`     ${result.tool.description}`)
      console.log(`     Keywords: ${result.tool.keywords.join(', ')}`)
      console.log()
    }
  },
}
