import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import {
  blastRadius,
  fileDeps,
  findReferences,
  initGraph,
  listSymbols,
  listSymbolsFast,
  readyGraph,
  traceCallees,
  traceCallers,
  traceChain,
} from '../graph/client.js'

type ToolDefinition = Tool

const CODE_GRAPH_TOOLS: ToolDefinition[] = [
  {
    name: 'list_symbols',
    description:
      'List functions, classes, structs, and other symbols in a source file.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute or project-relative path to a source file.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'find_references',
    description:
      'Find direct and transitive callers of a symbol across the project.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to search for.',
        },
        path: {
          type: 'string',
          description:
            'Optional file path used to disambiguate symbols with the same name.',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'trace_callers',
    description: 'Trace reverse call chains for a symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to trace.',
        },
        depth: {
          type: 'integer',
          description: 'Maximum traversal depth. Defaults to 3.',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'trace_callees',
    description: 'Trace forward call chains for a symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to trace.',
        },
        depth: {
          type: 'integer',
          description: 'Maximum traversal depth. Defaults to 3.',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'blast_radius',
    description:
      'Estimate the downstream impact of changing a file using the code graph.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Absolute or project-relative path to a source file.',
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'file_deps',
    description:
      'List files that directly or indirectly depend on the given file.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Absolute or project-relative path to a source file.',
        },
        depth: {
          type: 'integer',
          description: 'Maximum traversal depth. Defaults to 3.',
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'trace_chain',
    description: 'Find the shortest call path between two symbols.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source symbol name.',
        },
        to: {
          type: 'string',
          description: 'Target symbol name.',
        },
      },
      required: ['from', 'to'],
    },
  },
]

let initPromise: Promise<void> | null = null
let initStatsPromise: Promise<{ ready: boolean; node_count: number; file_count: number }> | null = null

async function ensureGraphInitialized(cwd: string) {
  if (!initPromise || !initStatsPromise) {
    initStatsPromise = initGraph(cwd).catch(error => {
      initPromise = null
      initStatsPromise = null
      throw error
    })
    initPromise = initStatsPromise
      .then(() => {})
      .catch(error => {
        initPromise = null
        initStatsPromise = null
        throw error
      })
  }

  await initPromise
  const stats = await initStatsPromise.catch(() => null)
  if (stats?.ready) {
    return
  }

  const readyStats = await readyGraph().catch(() => null)
  if (readyStats?.ready) {
    return
  }

  throw new Error('Code graph initialization did not reach a ready state.')
}

function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
  }
}

export function getCodeGraphToolDefinitions(): ToolDefinition[] {
  return CODE_GRAPH_TOOLS
}

export async function handleCodeGraphToolCall(
  cwd: string,
  name: string,
  args: unknown,
): Promise<CallToolResult | null> {
  if (!CODE_GRAPH_TOOLS.some(tool => tool.name === name)) {
    return null
  }

  try {
    if (name === 'list_symbols') {
      const { file_path } = (args ?? {}) as { file_path?: string }
      if (!file_path) {
        throw new Error('Missing required parameter: file_path')
      }
      const result = await listSymbolsFast(file_path).catch(() => listSymbols(cwd, file_path))
      if (!result.symbols.length) {
        return textResult(`No symbols found in ${file_path}`)
      }
      const lines = result.symbols
        .map(s => `  ${s.start_line}-${s.end_line}  ${s.kind.padEnd(10)} ${s.name}`)
        .join('\n')
      return textResult(
        `Symbols in ${file_path} (${result.symbols.length}):\n\n${lines}`,
      )
    }

    await ensureGraphInitialized(cwd)

    if (name === 'find_references') {
      const { symbol, path } = (args ?? {}) as { symbol?: string; path?: string }
      if (!symbol) {
        throw new Error('Missing required parameter: symbol')
      }
      const result = await findReferences(cwd, symbol, path ?? '')
      if (!result.references.length) {
        return textResult(`No references found for '${symbol}'`)
      }
      const lines = result.references
        .map(r => `  [depth ${r.depth}] ${r.file}:${r.line}  ${r.context}`)
        .join('\n')
      return textResult(`References for '${symbol}':\n\n${lines}`)
    }

    if (name === 'trace_callers') {
      const { symbol, depth } = (args ?? {}) as { symbol?: string; depth?: number }
      if (!symbol) {
        throw new Error('Missing required parameter: symbol')
      }
      const result = await traceCallers(cwd, symbol, depth)
      if (!result.callers.length) {
        return textResult(`No callers found for '${symbol}'`)
      }
      const lines = result.callers
        .map(c => `  [depth ${c.depth}] ${c.name} (${c.kind}) - ${c.file}:${c.line}`)
        .join('\n')
      return textResult(`Callers of '${symbol}':\n\n${lines}`)
    }

    if (name === 'trace_callees') {
      const { symbol, depth } = (args ?? {}) as { symbol?: string; depth?: number }
      if (!symbol) {
        throw new Error('Missing required parameter: symbol')
      }
      const result = await traceCallees(cwd, symbol, depth)
      if (!result.callees.length) {
        return textResult(`No callees found for '${symbol}'`)
      }
      const lines = result.callees
        .map(c => `  [depth ${c.depth}] ${c.name} (${c.kind}) - ${c.file}:${c.line}`)
        .join('\n')
      return textResult(`Callees of '${symbol}':\n\n${lines}`)
    }

    if (name === 'blast_radius') {
      const { file } = (args ?? {}) as { file?: string }
      if (!file) {
        throw new Error('Missing required parameter: file')
      }
      const result = await blastRadius(cwd, file)
      return textResult(result.output)
    }

    if (name === 'file_deps') {
      const { file, depth } = (args ?? {}) as { file?: string; depth?: number }
      if (!file) {
        throw new Error('Missing required parameter: file')
      }
      const result = await fileDeps(cwd, file, depth)
      const direct = result.direct.map(dep => `  ${dep}`).join('\n')
      const indirect = result.indirect.map(dep => `  ${dep}`).join('\n')
      return textResult(
        `Direct dependents (${result.direct.length}):\n${direct || '  (none)'}\n\nIndirect dependents (${result.indirect.length}):\n${indirect || '  (none)'}\n\nTotal: ${result.total}`,
      )
    }

    if (name === 'trace_chain') {
      const { from, to } = (args ?? {}) as { from?: string; to?: string }
      if (!from || !to) {
        throw new Error('Missing required parameters: from and to')
      }
      const result = await traceChain(cwd, from, to)
      return textResult(result.output)
    }

    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${message}` }],
    }
  }
}
