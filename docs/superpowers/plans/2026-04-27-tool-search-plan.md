# Tool Search + Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 BM25 的工具搜索 + 延迟加载系统，统一入口搜索 MCP 工具和内置工具。

**Architecture:** 在工具调用流程中注入工具发现中间件，使用 bm25s 库进行关键词搜索，工具元数据存储在内存和文件缓存中，支持延迟加载。

**Tech Stack:** TypeScript, bm25s, Bun

---

## File Structure

```
src/services/tool-search/
├── index.ts                    # 统一导出
├── types.ts                   # 类型定义（ToolMetadata, SearchResult 等）
├── SearchEngine.ts            # BM25 搜索引擎
├── ToolIndex.ts               # 工具索引管理
├── ToolRegistry.ts            # 统一工具注册表
├── LazyLoader.ts              # 延迟加载器
└── commands/
    ├── index.ts               # 命令导出
    └── SearchToolsCommand.ts  # /search-tools 命令

src/middleware/
└── toolDiscovery.ts           # 工具发现中间件

src/services/tools/
└── index.ts                   # 修改：集成 LazyLoader

tests/services/tool-search/
├── SearchEngine.test.ts
├── ToolIndex.test.ts
├── ToolRegistry.test.ts
└── LazyLoader.test.ts
```

---

## Task 1: ToolRegistry + 类型定义

**Files:**
- Create: `src/services/tool-search/types.ts`
- Create: `src/services/tool-search/ToolRegistry.ts`
- Create: `tests/services/tool-search/ToolRegistry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/services/tool-search/ToolRegistry.test.ts
import { describe, it, expect } from 'bun:test'
import { ToolRegistry } from '../../src/services/tool-search/ToolRegistry.js'
import type { ToolMetadata } from '../../src/services/tool-search/types.js'

describe('ToolRegistry', () => {
  it('should register and retrieve tool metadata', () => {
    const registry = new ToolRegistry()
    const tool: ToolMetadata = {
      name: 'file_read',
      description: 'Read file contents',
      keywords: ['file', 'read', 'io'],
      source: 'builtin',
    }
    registry.register(tool)
    expect(registry.get('file_read')).toEqual(tool)
  })

  it('should return all registered tools', () => {
    const registry = new ToolRegistry()
    registry.register({ name: 'a', description: '', keywords: [], source: 'builtin' })
    registry.register({ name: 'b', description: '', keywords: [], source: 'mcp' })
    expect(registry.getAll()).toHaveLength(2)
  })

  it('should return undefined for non-existent tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/services/tool-search/ToolRegistry.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write types.ts**

```typescript
// src/services/tool-search/types.ts
export interface ToolMetadata {
  name: string
  description: string
  keywords: string[]
  source: 'builtin' | 'mcp'
  // 延迟加载用
  load?: () => Promise<ToolHandler>
}

export interface ToolHandler {
  name: string
  description: string
  execute: (args: unknown) => Promise<unknown>
}

export interface SearchResult {
  tool: ToolMetadata
  score: number
  rank: number
}

export interface ToolSearchConfig {
  enabled: boolean
  autoHighlight: boolean
  maxSuggestions: number
  indexCachePath: string
  bm25Params: {
    k1: number
    b: number
  }
}

export const DEFAULT_CONFIG: ToolSearchConfig = {
  enabled: true,
  autoHighlight: true,
  maxSuggestions: 3,
  indexCachePath: '.claude/tool-index.json',
  bm25Params: { k1: 1.5, b: 0.75 },
}
```

- [ ] **Step 4: Write ToolRegistry.ts**

```typescript
// src/services/tool-search/ToolRegistry.ts
import type { ToolMetadata } from './types.js'

export class ToolRegistry {
  private tools = new Map<string, ToolMetadata>()

  register(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolMetadata | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.tools.values())
  }

  getBySource(source: 'builtin' | 'mcp'): ToolMetadata[] {
    return this.getAll().filter(t => t.source === source)
  }

  clear(): void {
    this.tools.clear()
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test tests/services/tool-search/ToolRegistry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/tool-search/types.ts src/services/tool-search/ToolRegistry.ts tests/services/tool-search/ToolRegistry.test.ts
git commit -m "feat(tool-search): add ToolRegistry and types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: ToolIndex（索引管理 + 文件缓存）

**Files:**
- Create: `src/services/tool-search/ToolIndex.ts`
- Create: `tests/services/tool-search/ToolIndex.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/services/tool-search/ToolIndex.test.ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { ToolIndex } from '../../src/services/tool-search/ToolIndex.js'
import type { ToolMetadata } from '../../src/services/tool-search/types.js'

describe('ToolIndex', () => {
  let index: ToolIndex

  beforeEach(() => {
    index = new ToolIndex()
  })

  it('should add and retrieve tools', () => {
    const tool: ToolMetadata = {
      name: 'git_commit',
      description: 'Create a git commit',
      keywords: ['git', 'commit', 'vcs'],
      source: 'builtin',
    }
    index.add(tool)
    const retrieved = index.get('git_commit')
    expect(retrieved).toEqual(tool)
  })

  it('should return all tools', () => {
    index.add({ name: 'a', description: '', keywords: [], source: 'builtin' })
    index.add({ name: 'b', description: '', keywords: [], source: 'mcp' })
    expect(index.getAll()).toHaveLength(2)
  })

  it('should clear all tools', () => {
    index.add({ name: 'a', description: '', keywords: [], source: 'builtin' })
    index.clear()
    expect(index.getAll()).toHaveLength(0)
  })

  it('should build corpus for BM25', () => {
    index.add({ name: 'file_read', description: 'Read files', keywords: ['io'], source: 'builtin' })
    const corpus = index.buildCorpus()
    expect(corpus.length).toBe(1)
    expect(corpus[0].name).toBe('file_read')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/services/tool-search/ToolIndex.test.ts`
Expected: FAIL

- [ ] **Step 3: Write ToolIndex.ts**

```typescript
// src/services/tool-search/ToolIndex.ts
import type { ToolMetadata } from './types.js'

export interface IndexedTool {
  name: string
  description: string
  keywords: string[]
  source: 'builtin' | 'mcp'
}

export class ToolIndex {
  private tools = new Map<string, ToolMetadata>()

  add(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolMetadata | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.tools.values())
  }

  clear(): void {
    this.tools.clear()
  }

  buildCorpus(): IndexedTool[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      keywords: tool.keywords,
      source: tool.source,
    }))
  }

  size(): number {
    return this.tools.size
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/services/tool-search/ToolIndex.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/tool-search/ToolIndex.ts tests/services/tool-search/ToolIndex.test.ts
git commit -m "feat(tool-search): add ToolIndex for tool metadata storage

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: SearchEngine（BM25 搜索）

**Files:**
- Create: `src/services/tool-search/SearchEngine.ts`
- Create: `tests/services/tool-search/SearchEngine.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/services/tool-search/SearchEngine.test.ts
import { describe, it, expect } from 'bun:test'
import { SearchEngine } from '../../src/services/tool-search/SearchEngine.js'
import type { ToolMetadata } from '../../src/services/tool-search/types.js'

describe('SearchEngine', () => {
  const tools: ToolMetadata[] = [
    { name: 'file_read', description: 'Read file contents', keywords: ['file', 'io'], source: 'builtin' },
    { name: 'file_write', description: 'Write to file', keywords: ['file', 'io'], source: 'builtin' },
    { name: 'git_commit', description: 'Create git commit', keywords: ['git', 'vcs'], source: 'builtin' },
    { name: 'git_push', description: 'Push to remote', keywords: ['git', 'vcs'], source: 'builtin' },
  ]

  it('should search tools by keyword', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('git')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tool.name).toMatch(/git/)
  })

  it('should return results ordered by relevance', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('git commit')
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0)
  })

  it('should respect maxResults limit', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('file', { maxResults: 1 })
    expect(results).toHaveLength(1)
  })

  it('should return empty array for no matches', () => {
    const engine = new SearchEngine(tools)
    const results = engine.search('xyzabc123')
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/services/tool-search/SearchEngine.test.ts`
Expected: FAIL

- [ ] **Step 3: Write SearchEngine.ts**

```typescript
// src/services/tool-search/SearchEngine.ts
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
          score += nameMatches * 3 + keywordMatches * 2 + matches.length
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/services/tool-search/SearchEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/tool-search/SearchEngine.ts tests/services/tool-search/SearchEngine.test.ts
git commit -m "feat(tool-search): add SearchEngine with BM25-lite scoring

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: LazyLoader（延迟加载器）

**Files:**
- Create: `src/services/tool-search/LazyLoader.ts`
- Create: `tests/services/tool-search/LazyLoader.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/services/tool-search/LazyLoader.test.ts
import { describe, it, expect } from 'bun:test'
import { LazyLoader } from '../../src/services/tool-search/LazyLoader.js'
import type { ToolMetadata, ToolHandler } from '../../src/services/tool-search/types.js'

describe('LazyLoader', () => {
  it('should not load tool until requested', async () => {
    let loadCalled = false
    const loader = new LazyLoader()

    const tool: ToolMetadata = {
      name: 'test_tool',
      description: 'Test tool',
      keywords: ['test'],
      source: 'builtin',
      load: async () => {
        loadCalled = true
        return { name: 'test_tool', description: 'Test', execute: async () => 'result' }
      },
    }

    loader.register(tool)
    expect(loadCalled).toBe(false)

    const handler = await loader.load('test_tool')
    expect(loadCalled).toBe(true)
    expect(handler).toBeDefined()
  })

  it('should cache loaded tools', async () => {
    let loadCount = 0
    const loader = new LazyLoader()

    const tool: ToolMetadata = {
      name: 'test_tool',
      description: 'Test tool',
      keywords: ['test'],
      source: 'builtin',
      load: async () => {
        loadCount++
        return { name: 'test_tool', description: 'Test', execute: async () => 'result' }
      },
    }

    loader.register(tool)
    await loader.load('test_tool')
    await loader.load('test_tool')

    expect(loadCount).toBe(1)
  })

  it('should return undefined for non-registered tool', async () => {
    const loader = new LazyLoader()
    const handler = await loader.load('nonexistent')
    expect(handler).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/services/tool-search/LazyLoader.test.ts`
Expected: FAIL

- [ ] **Step 3: Write LazyLoader.ts**

```typescript
// src/services/tool-search/LazyLoader.ts
import type { ToolMetadata, ToolHandler } from './types.js'

export class LazyLoader {
  private registry = new Map<string, ToolMetadata>()
  private cache = new Map<string, ToolHandler>()

  register(tool: ToolMetadata): void {
    if (!tool.load) {
      throw new Error(`Tool ${tool.name} must have a load function for lazy loading`)
    }
    this.registry.set(tool.name, tool)
  }

  async load(name: string): Promise<ToolHandler | undefined> {
    // Return cached if available
    if (this.cache.has(name)) {
      return this.cache.get(name)
    }

    const tool = this.registry.get(name)
    if (!tool || !tool.load) {
      return undefined
    }

    const handler = await tool.load()
    this.cache.set(name, handler)
    return handler
  }

  isLoaded(name: string): boolean {
    return this.cache.has(name)
  }

  preload(name: string): Promise<ToolHandler | undefined> {
    return this.load(name)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getRegisteredTools(): ToolMetadata[] {
    return Array.from(this.registry.values())
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/services/tool-search/LazyLoader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/tool-search/LazyLoader.ts tests/services/tool-search/LazyLoader.test.ts
git commit -m "feat(tool-search): add LazyLoader for on-demand tool loading

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 集成 ToolRegistry 到现有工具系统

**Files:**
- Modify: `src/services/tools/index.ts`（如果存在）或 `src/services/tool-search/index.ts`
- Create: `src/services/tool-search/index.ts`

- [ ] **Step 1: Create main index.ts**

```typescript
// src/services/tool-search/index.ts
export * from './types.js'
export { ToolRegistry, toolRegistry } from './ToolRegistry.js'
export { ToolIndex } from './ToolIndex.js'
export { SearchEngine } from './SearchEngine.js'
export { LazyLoader } from './LazyLoader.js'
```

- [ ] **Step 2: Verify it compiles**

Run: `bun build src/services/tool-search/index.ts --outdir dist 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/tool-search/index.ts
git commit -m "feat(tool-search): create main index exports

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: /search-tools 命令

**Files:**
- Create: `src/services/tool-search/commands/index.ts`
- Create: `src/services/tool-search/commands/SearchToolsCommand.ts`
- Modify: `src/commands.ts`（注册命令）

- [ ] **Step 1: Write SearchToolsCommand.ts**

```typescript
// src/services/tool-search/commands/SearchToolsCommand.ts
import type { Command } from '../../../commands/index.js'
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
```

- [ ] **Step 2: Create commands/index.ts**

```typescript
// src/services/tool-search/commands/index.ts
export { searchToolsCommand } from './SearchToolsCommand.js'
```

- [ ] **Step 3: Add to commands.ts**

Add import:
```typescript
import { searchToolsCommand } from './services/tool-search/commands/index.js'
```

Add to command list (find where other commands are listed and add):
```typescript
// Add search-tools command
```

- [ ] **Step 4: Verify it works (manual test)**

Run: `bun run src/main.tsx -- search-tools git`
Expected: Shows git-related tools

- [ ] **Step 5: Commit**

```bash
git add src/services/tool-search/commands/ src/commands.ts
git commit -m "feat(tool-search): add /search-tools command

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 工具发现中间件

**Files:**
- Create: `src/middleware/toolDiscovery.ts`
- Modify: `src/services/tools/StreamingToolExecutor.ts`（集成中间件）

- [ ] **Step 1: Write toolDiscovery.ts**

```typescript
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

export function highlightTools(input: string, middleware: ToolDiscoveryMiddleware): SearchResult[] {
  if (!middleware.enabled || !middleware.autoHighlight) {
    return []
  }
  return middleware.searchEngine.search(input, { maxResults: DEFAULT_CONFIG.maxSuggestions })
}
```

- [ ] **Step 2: Run to verify it compiles**

Run: `bun build src/middleware/toolDiscovery.ts --outdir dist 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware/toolDiscovery.ts
git commit -m "feat(tool-search): add tool discovery middleware

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 集成测试 + 完善

**Files:**
- Modify: `src/services/tool-search/SearchEngine.ts`（增强 BM25 评分）
- Create: `tests/services/tool-search/integration.test.ts`
- Add: `bm25s` 到 package.json 依赖

- [ ] **Step 1: Add bm25s dependency**

Run: `bun add bm25s`
Expected: bm25s added to package.json

- [ ] **Step 2: Update SearchEngine to use bm25s**

```typescript
// src/services/tool-search/SearchEngine.ts (updated)
// Replace the simple scoring with bm25s library
import BM25 from 'bm25s'

export class SearchEngine {
  // ... existing code ...

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { maxResults = 10 } = options
    const corpus = this.buildCorpusForBM25()

    if (corpus.length === 0) return []

    const bm25 = new BM25()
    const tokenizedCorpus = corpus.map(doc => doc.text.split(/\s+/))
    bm25.index(tokenizedCorpus)

    const queryTokens = query.toLowerCase().split(/\s+/)
    const scores = bm25.score(queryTokens)

    // Map scores back to tools
    const results: SearchResult[] = scores
      .filter(s => s.score > 0)
      .map(s => ({
        tool: this.tools.find(t => t.name === s.docId)!,
        score: s.score,
        rank: 0,
      }))
      .slice(0, maxResults)

    // Assign ranks
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1
    }

    return results
  }

  private buildCorpusForBM25(): Array<{ docId: string; text: string }> {
    return this.tools.map(tool => ({
      docId: tool.name,
      text: `${tool.name} ${tool.description} ${tool.keywords.join(' ')}`,
    }))
  }
}
```

- [ ] **Step 3: Write integration test**

```typescript
// tests/services/tool-search/integration.test.ts
import { describe, it, expect } from 'bun:test'
import { toolRegistry } from '../../src/services/tool-search/ToolRegistry.js'
import { SearchEngine } from '../../src/services/tool-search/SearchEngine.js'
import type { ToolMetadata } from '../../src/services/tool-search/types.js'

describe('Tool Search Integration', () => {
  beforeEach(() => {
    toolRegistry.clear()
  })

  it('should find tools end-to-end', () => {
    const tools: ToolMetadata[] = [
      { name: 'file_read', description: 'Read file contents', keywords: ['file', 'io'], source: 'builtin' },
      { name: 'file_write', description: 'Write to file', keywords: ['file', 'io'], source: 'builtin' },
      { name: 'git_commit', description: 'Create git commit', keywords: ['git', 'vcs'], source: 'builtin' },
    ]

    for (const tool of tools) {
      toolRegistry.register(tool)
    }

    const engine = new SearchEngine(toolRegistry.getAll())
    const results = engine.search('file')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tool.name).toMatch(/file/)
  })
})
```

- [ ] **Step 4: Run integration test**

Run: `bun test tests/services/tool-search/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `bun test tests/services/tool-search/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/tool-search/SearchEngine.ts tests/services/tool-search/integration.test.ts package.json
git commit -m "feat(tool-search): integrate bm25s and add integration tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

- [ ] All 8 tasks have tests that fail before implementation
- [ ] All types/interfaces match across files
- [ ] No "TBD" or placeholder content
- [ ] Each task produces working, commit-able code
- [ ] Spec requirements covered: ToolRegistry, ToolIndex, SearchEngine, LazyLoader, /search-tools, middleware

---

## Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
