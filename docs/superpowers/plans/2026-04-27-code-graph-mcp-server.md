# Code Graph MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add code-graph as a built-in MCP server that appears in the MCP settings UI and can be enabled/disabled like other servers.

**Architecture:** Add a new `code-graph` transport type that spawns the built-in MCP server (`claude mcp serve`) as a stdio subprocess when enabled. The MCP server already includes all code-graph tools via `handleCodeGraphToolCall`, so spawning it gives us the code-graph functionality for free.

**Tech Stack:** Bun, TypeScript, MCP SDK, existing graph/client.ts infrastructure

---

## File Structure

- **Modify:** `src/services/mcp/types.ts` — Add `code-graph` transport type and config schema
- **Modify:** `src/services/mcp/config.ts` — Inject code-graph config into `getClaudeCodeMcpConfigs()`
- **Modify:** `src/services/mcp/client.ts` — Handle `code-graph` type by spawning MCP server
- **Test:** `src/mcp/codeGraphTools.test.ts` — Existing test validates the graph tools work

---

## Task 1: Add code-graph transport type to types.ts

**Files:**
- Modify: `src/services/mcp/types.ts:23-26` — Add `code-graph` to TransportSchema
- Modify: `src/services/mcp/types.ts:108-113` — Add McpCodeGraphServerConfigSchema
- Modify: `src/services/mcp/types.ts:124-135` — Add to McpServerConfigSchema union

### Steps

- [ ] **Step 1: Add `code-graph` to TransportSchema**

Locate line 23-26 in types.ts:
```typescript
export const TransportSchema = lazySchema(() =>
  z.enum(['stdio', 'sse', 'sse-ide', 'http', 'ws', 'sdk', 'code-graph']),
)
```

- [ ] **Step 2: Add McpCodeGraphServerConfigSchema**

Add after McpSdkServerConfigSchema (around line 108):
```typescript
// Internal server type for built-in code graph
export const McpCodeGraphServerConfigSchema = lazySchema(() =>
  z.object({
    type: z.literal('code-graph'),
  }),
)
```

- [ ] **Step 3: Add to McpServerConfigSchema union**

Locate the union at lines 124-135:
```typescript
export const McpServerConfigSchema = lazySchema(() =>
  z.union([
    McpStdioServerConfigSchema(),
    McpSSEServerConfigSchema(),
    McpSSEIDEServerConfigSchema(),
    McpWebSocketIDEServerConfigSchema(),
    McpHTTPServerConfigSchema(),
    McpWebSocketServerConfigSchema(),
    McpSdkServerConfigSchema(),
    McpClaudeAIProxyServerConfigSchema(),
    McpCodeGraphServerConfigSchema(), // ADD THIS
  ]),
)
```

- [ ] **Step 4: Add exported type**

Add after line ~148:
```typescript
export type McpCodeGraphServerConfig = z.infer<
  ReturnType<typeof McpCodeGraphServerConfigSchema>
>
```

- [ ] **Step 5: Add McpCodeGraphServerConfig to ScopedMcpServerConfig union**

Find where ScopedMcpServerConfig is defined and add the new type.

---

## Task 2: Add code-graph config injection to config.ts

**Files:**
- Modify: `src/services/mcp/config.ts` — Inject code-graph config into getClaudeCodeMcpConfigs()

### Steps

- [ ] **Step 1: Add code-graph config injection**

Find `getClaudeCodeMcpConfigs()` function. After building the `pluginMcpServers` object and before the dedup logic, add:

```typescript
// Add built-in code-graph server if not disabled
const isCodeGraphDisabled = isMcpServerDisabled('code-graph')
if (!mcpLocked && !isCodeGraphDisabled) {
  servers['code-graph'] = { type: 'code-graph' } as unknown as ScopedMcpServerConfig
}
```

This should be added around line 1180 (after plugin servers processing, before dedup).

---

## Task 3: Handle code-graph type in client.ts

**Files:**
- Modify: `src/services/mcp/client.ts` — Add code-graph connection handling

### Steps

- [ ] **Step 1: Find where server types are handled**

Look for the section that handles `sse-ide` and `ws-ide` types around line 679-750.

- [ ] **Step 2: Add code-graph handling**

Add a new section for `code-graph` type. The code-graph server is spawned as a stdio MCP server by running the CLI with `mcp serve` command:

```typescript
} else if (serverRef.type === 'code-graph') {
  // Spawn the built-in MCP server as a stdio process
  const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../entrypoints/mcp.js')
  const serverProcess = Bun.spawn(['bun', serverPath, 'mcp', 'serve'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  
  transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout,
    stderr: serverProcess.stderr,
  })
}
```

- [ ] **Step 2: Import StdioClientTransport if not already imported**

Check imports at top of client.ts. You may need to add:
```typescript
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
```

---

## Task 4: Add config.ts location helper for code-graph

**Files:**
- Modify: `src/services/mcp/config.ts` — Add config file path display for code-graph

### Steps

- [ ] **Step 1: Check describeMcpConfigFilePath function**

This function returns the config file path for display in UI. Find where it handles built-in server types and ensure code-graph is handled (it won't have a config file path since it's built-in).

---

## Task 5: Add disable handling

**Files:**
- Modify: `src/services/mcp/config.ts` — Ensure code-graph can be disabled

### Steps

- [ ] **Step 1: Verify isMcpServerDisabled works for code-graph**

The `isMcpServerDisabled` function checks if a server is in the disabled list. Ensure `code-graph` can be added to the disabled list via the normal mechanism.

---

## Task 6: Test the implementation

**Files:**
- Test manually via Claude Code MCP settings UI

### Steps

- [ ] **Step 1: Start Claude Code**

Run: `bun --env-file=.env --preload=./preload.ts ./src/entrypoints/cli.tsx`

- [ ] **Step 2: Open MCP settings**

Type `/mcp` in Claude Code to open MCP settings

- [ ] **Step 3: Verify code-graph appears in list**

You should see "code-graph" in the MCP servers list

- [ ] **Step 4: Enable and test**

Click on code-graph and enable it. Then try using a code-graph tool like `list_symbols` on a file.

---

## Verification Commands

```bash
# Run existing code-graph smoke test
bun run src/mcp/codeGraphTools.test.ts

# Verify types compile
bun run --cwd /home/liuxue/2号员工/Super-Claude-Code tsc --noEmit 2>&1 | head -50
```

---

## Dependencies

- Task 1 must be completed before Task 3 (types needed)
- Task 2 depends on Task 1 (needs the type to exist)
- Task 3 depends on Task 1 (needs the type to exist)
