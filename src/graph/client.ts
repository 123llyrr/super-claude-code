import { dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'
import type {
  BlastRadiusResult,
  FileDepsResult,
  FindReferencesResult,
  GraphStats,
  ListSymbolsResult,
  TraceCalleesResult,
  TraceCallersResult,
  TraceChainResult,
} from './types'

const DAEMON_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../vendor/code-graph/target/release/code-graph-daemon',
)

type CommandPayload =
  | { cmd: 'init'; project_dir: string; id: number }
  | { cmd: 'ready'; id: number }
  | { cmd: 'query'; method: string; params: Record<string, unknown>; id: number }

type ResponsePayload = {
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

let nextId = 1
let lastInitStats: GraphStats | null = null

function normalizeProjectPath(projectDir: string, filePath: string) {
  return isAbsolute(filePath) ? filePath : resolve(projectDir, filePath)
}

async function runSession(commands: CommandPayload[], timeoutMs = 30000) {
  const stdin = commands.map(command => JSON.stringify(command)).join('\n') + '\n'
  const proc = Bun.spawn([DAEMON_PATH], {
    stdin: new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill()
      reject(new Error('Timeout waiting for code-graph daemon'))
    }, timeoutMs)
  })

  const result = await Promise.race([
    (async () => {
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])

      if (stderr.trim()) {
        const nonLogLines = stderr
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('[code-graph]'))
        if (nonLogLines.length > 0) {
          throw new Error(nonLogLines.join('\n'))
        }
      }

      return stdout
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line) as ResponsePayload)
    })(),
    timeout,
  ])

  return result as ResponsePayload[]
}

async function runQuery<T>(
  projectDir: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 120000,
): Promise<T> {
  const initId = nextId++
  const queryId = nextId++
  const responses = await runSession(
    [
      { cmd: 'init', project_dir: projectDir, id: initId },
      { cmd: 'query', method, params, id: queryId },
    ],
    timeoutMs,
  )

  const queryResponse = responses.find(response => response.id === queryId)
  if (!queryResponse) {
    throw new Error(`Missing response for query ${method}`)
  }
  if (!queryResponse.ok) {
    throw new Error(queryResponse.error ?? `Query failed: ${method}`)
  }

  return queryResponse.result as T
}

export async function initGraph(projectDir: string): Promise<GraphStats> {
  const initId = nextId++
  const responses = await runSession([{ cmd: 'init', project_dir: projectDir, id: initId }], 120000)
  const response = responses.find(item => item.id === initId)
  if (!response) {
    throw new Error('Missing init response')
  }
  if (!response.ok) {
    throw new Error(response.error ?? 'Init failed')
  }
  const stats = response.result as GraphStats
  lastInitStats = stats
  return stats
}

export async function readyGraph(): Promise<GraphStats> {
  if (!lastInitStats) {
    return { ready: false, node_count: 0, file_count: 0 }
  }
  return lastInitStats
}

export async function listSymbols(projectDir: string, filePath: string): Promise<ListSymbolsResult> {
  return runQuery<ListSymbolsResult>(projectDir, 'list_symbols', {
    file_path: normalizeProjectPath(projectDir, filePath),
  })
}

export async function listSymbolsFast(filePath: string): Promise<ListSymbolsResult> {
  const cwd = process.cwd()
  const queryId = nextId++
  const responses = await runSession(
    [{
      cmd: 'query',
      method: 'list_symbols_fast',
      params: { file_path: normalizeProjectPath(cwd, filePath) },
      id: queryId,
    }],
    30000,
  )
  const response = responses.find(item => item.id === queryId)
  if (!response) {
    throw new Error('Missing list_symbols_fast response')
  }
  if (!response.ok) {
    throw new Error(response.error ?? 'list_symbols_fast failed')
  }
  return response.result as ListSymbolsResult
}

export async function findReferences(
  projectDir: string,
  symbol: string,
  filePath: string,
): Promise<FindReferencesResult> {
  return runQuery<FindReferencesResult>(projectDir, 'find_references', {
    name: symbol,
    file_path: filePath ? normalizeProjectPath(projectDir, filePath) : '',
  })
}

export async function traceCallers(
  projectDir: string,
  symbol: string,
  depth?: number,
): Promise<TraceCallersResult> {
  return runQuery<TraceCallersResult>(projectDir, 'trace_callers', {
    name: symbol,
    depth: depth ?? 3,
  })
}

export async function traceCallees(
  projectDir: string,
  symbol: string,
  depth?: number,
): Promise<TraceCalleesResult> {
  return runQuery<TraceCalleesResult>(projectDir, 'trace_callees', {
    name: symbol,
    depth: depth ?? 3,
  })
}

export async function fileDeps(
  projectDir: string,
  filePath: string,
  depth?: number,
): Promise<FileDepsResult> {
  return runQuery<FileDepsResult>(projectDir, 'file_deps', {
    file_path: normalizeProjectPath(projectDir, filePath),
    depth: depth ?? 3,
  })
}

export async function blastRadius(
  projectDir: string,
  filePath: string,
): Promise<BlastRadiusResult> {
  return runQuery<BlastRadiusResult>(projectDir, 'blast_radius', {
    file_path: normalizeProjectPath(projectDir, filePath),
  })
}

export async function traceChain(
  projectDir: string,
  from: string,
  to: string,
): Promise<TraceChainResult> {
  return runQuery<TraceChainResult>(projectDir, 'trace_chain', {
    name: from,
    to,
  })
}

export function killGraph() {}
