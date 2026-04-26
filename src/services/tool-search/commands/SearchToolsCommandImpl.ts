import type { LocalCommandCall } from '../../../types/command.js'
import { SearchEngine } from '../SearchEngine.js'
import { toolRegistry } from '../ToolRegistry.js'
import { DEFAULT_CONFIG } from '../types.js'

export const call: LocalCommandCall = async (query) => {
  const tools = toolRegistry.getAll()
  const engine = new SearchEngine(tools)
  const results = engine.search(query, { maxResults: DEFAULT_CONFIG.maxSuggestions })

  if (results.length === 0) {
    return { type: 'text', value: 'No tools found matching your query.' }
  }

  const output = [`Found ${results.length} tool(s):\n`
    , ...results.map((result) =>
      `  ${result.rank}. ${result.tool.name} (score: ${result.score.toFixed(2)})\n` +
      `     ${result.tool.description}\n` +
      `     Keywords: ${result.tool.keywords.join(', ')}\n`
    )].join('\n')

  return { type: 'text', value: output }
}