/**
 * Smoke test for code-graph MCP exposure.
 * Run with: bun run src/mcp/codeGraphTools.test.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { resolve } from 'path'

const CWD = resolve(import.meta.dir, '../..')
const MCP_TEST_ENTRY_PATH = resolve(import.meta.dir, 'codeGraphTools.test.entry.ts')

async function runTest() {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', MCP_TEST_ENTRY_PATH],
    cwd: CWD,
    stderr: 'pipe',
    env: {
      ...process.env,
    },
  })

  let errorOutput = ''
  transport.stderr?.on('data', data => {
    errorOutput += data.toString()
  })

  const client = new Client({
    name: 'code-graph-smoke-test',
    version: '1.0.0',
  })

  try {
    await client.connect(transport)

    const listResult = await client.request(
      { method: 'tools/list', params: {} },
      ListToolsResultSchema,
    )
    const toolNames = listResult.tools.map(tool => tool.name)
    for (const toolName of [
      'list_symbols',
      'find_references',
      'trace_callers',
      'trace_callees',
      'file_deps',
      'blast_radius',
      'trace_chain',
    ]) {
      if (!toolNames.includes(toolName)) {
        throw new Error(`Missing code graph tool: ${toolName}`)
      }
    }

    const listSymbolsResult = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'list_symbols',
          arguments: {
            file_path: 'src/graph/client.ts',
          },
        },
      },
      CallToolResultSchema,
    )

    const symbolsText = listSymbolsResult.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
    if (!symbolsText.includes('runSession') || !symbolsText.includes('traceChain')) {
      throw new Error(`Unexpected list_symbols response: ${symbolsText}`)
    }

    const traceChainResult = await client.request(
      {
        method: 'tools/call',
        params: {
          name: 'trace_chain',
          arguments: {
            from: 'startMCPServer',
            to: 'handleCodeGraphToolCall',
          },
        },
      },
      CallToolResultSchema,
    )

    const traceText = traceChainResult.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
    if (!traceText.includes('handleCodeGraphToolCall')) {
      throw new Error(`Unexpected trace_chain response: ${traceText}`)
    }

    console.log('code graph MCP smoke test passed')
  } catch (error) {
    console.error('code graph MCP smoke test failed:', error)
    console.error('Server stderr:', errorOutput)
    process.exit(1)
  } finally {
    await transport.close().catch(() => {})
  }
}

runTest().catch(console.error)
