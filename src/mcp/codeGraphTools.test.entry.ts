;(globalThis as typeof globalThis & { MACRO?: { VERSION: string } }).MACRO = {
  VERSION: 'test',
}

const { startMCPServer } = await import('../entrypoints/mcp.js')
await startMCPServer(process.cwd(), false, false)
