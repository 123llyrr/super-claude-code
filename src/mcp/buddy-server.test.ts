/**
 * Simple test script to verify the buddy MCP server loads and responds.
 * Run with: bun run src/mcp/buddy-server.test.ts
 */
import { spawn } from 'child_process'
import { resolve } from 'path'

const BUDDY_SERVER_PATH = resolve(import.meta.dir, 'buddy-server.ts')

// Helper to send JSON-RPC request and get response
function mcpRequest(process: ReturnType<typeof spawn>, request: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Request timeout')), 5000)
    const dataHandler = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const response = JSON.parse(line)
          if (response.id === (request as { id?: unknown }).id) {
            clearTimeout(timeout)
            process.stdout?.off('data', dataHandler)
            resolve(response)
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
    process.stdout?.on('data', dataHandler)

    const jsonRequest = JSON.stringify(request) + '\n'
    process.stdin?.write(jsonRequest)
  })
}

async function runTest() {
  console.log('Starting buddy MCP server test...')

  const proc = spawn('bun', ['run', BUDDY_SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  let errorOutput = ''
  proc.stderr?.on('data', (data) => {
    errorOutput += data.toString()
  })

  // Wait for server to initialize
  await new Promise(r => setTimeout(r, 500))

  try {
    // Test 1: List tools
    console.log('\n--- Test: List Tools ---')
    const listResponse = await mcpRequest(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    })
    console.log('List response:', JSON.stringify(listResponse, null, 2))

    const listResult = listResponse as { result?: { tools?: { name: string }[] } }
    if (!listResult.result?.tools) {
      throw new Error('No tools returned')
    }
    const toolNames = listResult.result.tools.map(t => t.name)
    if (!toolNames.includes('buddy_show') || !toolNames.includes('buddy_pet') || !toolNames.includes('buddy_stats')) {
      throw new Error('Missing expected tools: ' + toolNames.join(', '))
    }
    console.log('✓ All expected tools found:', toolNames.join(', '))

    // Test 2: Call buddy_show
    console.log('\n--- Test: buddy_show ---')
    const showResponse = await mcpRequest(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'buddy_show',
        arguments: {},
      },
    })
    console.log('buddy_show response:', JSON.stringify(showResponse, null, 2))

    const showResult = showResponse as { result?: { content?: { text?: string }[] } }
    if (!showResult.result?.content?.[0]?.text) {
      throw new Error('No content in buddy_show response')
    }
    const showText = showResult.result.content[0].text
    if (!showText.includes('## ')) {
      throw new Error('buddy_show does not appear to have name header')
    }
    console.log('✓ buddy_show returned companion card')

    // Test 3: Call buddy_pet
    console.log('\n--- Test: buddy_pet ---')
    const petResponse = await mcpRequest(proc, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'buddy_pet',
        arguments: {},
      },
    })
    console.log('buddy_pet response:', JSON.stringify(petResponse, null, 2))

    const petResult = petResponse as { result?: { content?: { text?: string }[] } }
    if (!petResult.result?.content?.[0]?.text) {
      throw new Error('No content in buddy_pet response')
    }
    console.log('✓ buddy_pet returned reaction')

    // Test 4: Call buddy_stats
    console.log('\n--- Test: buddy_stats ---')
    const statsResponse = await mcpRequest(proc, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'buddy_stats',
        arguments: {},
      },
    })
    console.log('buddy_stats response:', JSON.stringify(statsResponse, null, 2))

    const statsResult = statsResponse as { result?: { content?: { text?: string }[] } }
    if (!statsResult.result?.content?.[0]?.text) {
      throw new Error('No content in buddy_stats response')
    }
    if (!statsResult.result.content[0].text.includes('Stats')) {
      throw new Error('buddy_stats does not contain stats')
    }
    console.log('✓ buddy_stats returned stats card')

    console.log('\n✅ All tests passed!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    console.error('Server stderr:', errorOutput)
    proc.kill()
    process.exit(1)
  }

  proc.kill()
  process.exit(0)
}

runTest().catch(console.error)
