# 记忆系统增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 强化记忆系统，实现自动抽取、记忆压缩、热度加载三大功能，省 token 约 75%

**Architecture:**
- 新增三个核心模块：`memoryCompressor.ts`（压缩）、`memoryHotLoader.ts`（热度加载）、`memoryAutoExtractor.ts`（自动抽取）
- 修改 `soulMemory.ts` 集成热度过滤
- 修改 `sessionMemoryCompact.ts` 触发压缩
- 保持现有加载机制兼容

**Tech Stack:** TypeScript, Node.js fs/promises

---

## 文件结构

```
src/
  memdir/
    memoryCompressor.ts   # NEW - 记忆压缩
    memoryHotLoader.ts    # NEW - 热度加载
    memoryAutoExtractor.ts # NEW - 自动抽取
  utils/
    soulMemory.ts        # MODIFY - 集成热度加载
  services/
    compact/
      sessionMemoryCompact.ts  # MODIFY - 触发压缩
```

---

## Task 1: 热度加载 (memoryHotLoader.ts)

**Files:**
- Create: `src/memdir/memoryHotLoader.ts`
- Test: `src/memdir/memoryHotLoader.test.ts`

- [ ] **Step 1: 创建 memoryHotLoader.ts**

```typescript
import { readdir } from 'fs/promises'
import { join } from 'path'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import { readFileInRange } from '../utils/readFileInRange.js'
import type { MemoryType } from './memoryTypes.js'

const MAX_MEMORY_FILES = 200
const FRONTMATTER_MAX_LINES = 30
const TOP_K = 10

export interface MemoryHeader {
  filename: string
  filePath: string
  mtimeMs: number
  description: string | null
  type: MemoryType | undefined
  name: string | null
}

/**
 * 提取用户消息中的关键词
 * 简单实现：提取连续的中文/英文词组
 */
export function extractKeywords(message: string): string[] {
  // 提取中文词组（2-20字符）
  const chinesePattern = /[\u4e00-\u9fa5]{2,20}/g
  // 提取英文词组（2+字符）
  const englishPattern = /[a-zA-Z]{2,}[a-zA-Z0-9-]*/g
  
  const chinese = message.match(chinesePattern) || []
  const english = message.match(englishPattern) || []
  
  // 去重并返回
  return [...new Set([...chinese, ...english])]
}

/**
 * 计算记忆与关键词的相关性得分
 * - type 匹配: +3 分
 * - description 命中: +2 分
 * - name 命中: +1 分
 */
export function scoreMemory(
  memory: MemoryHeader,
  keywords: string[]
): number {
  if (keywords.length === 0) return 0
  
  let score = 0
  const typeNames: Record<MemoryType, string[]> = {
    user: ['用户', '偏好', '风格', 'profile'],
    feedback: ['反馈', 'correction', 'prefer'],
    project: ['项目', 'project', 'code'],
    reference: ['引用', 'reference', 'linear', 'grafana'],
  }
  
  // Type matching
  if (memory.type && memory.type in typeNames) {
    const typeKeywords = typeNames[memory.type]
    for (const kw of keywords) {
      if (typeKeywords.some(tk => kw.includes(tk))) {
        score += 3
        break
      }
    }
  }
  
  // Description matching
  if (memory.description) {
    for (const kw of keywords) {
      if (memory.description.includes(kw)) {
        score += 2
      }
    }
  }
  
  // Name matching
  if (memory.name) {
    for (const kw of keywords) {
      if (memory.name.includes(kw)) {
        score += 1
      }
    }
  }
  
  return score
}

/**
 * 扫描记忆目录，返回所有记忆头部信息
 */
export async function scanMemoryDir(
  memoryDir: string,
  signal?: AbortSignal
): Promise<MemoryHeader[]> {
  try {
    const entries = await readdir(memoryDir, { recursive: true })
    const mdFiles = entries.filter(
      f => f.endsWith('.md') && f !== 'MEMORY.md'
    )

    const headerResults = await Promise.allSettled(
      mdFiles.map(async (relativePath): Promise<MemoryHeader> => {
        const filePath = join(memoryDir, relativePath)
        const { content, mtimeMs } = await readFileInRange(
          filePath,
          0,
          FRONTMATTER_MAX_LINES,
          undefined,
          signal
        )
        const { frontmatter } = parseFrontmatter(content, filePath)
        return {
          filename: relativePath,
          filePath,
          mtimeMs,
          description: frontmatter.description || null,
          type: frontmatter.type as MemoryType || undefined,
          name: frontmatter.name || null,
        }
      })
    )

    return headerResults
      .filter((r): r is PromiseFulfilledResult<MemoryHeader> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_MEMORY_FILES)
  } catch {
    return []
  }
}

/**
 * 根据关键词加载相关性最高的记忆
 * 返回 top-K 记忆的文件路径列表
 */
export async function loadRelevantMemories(
  userMessage: string,
  memoryDir: string,
  signal?: AbortSignal
): Promise<MemoryHeader[]> {
  const keywords = extractKeywords(userMessage)
  
  // 始终加载 user type（热数据）
  const allMemories = await scanMemoryDir(memoryDir, signal)
  
  // 分离热数据和普通数据
  const hotMemories = allMemories.filter(m => m.type === 'user')
  const otherMemories = allMemories.filter(m => m.type !== 'user')
  
  // 对普通数据评分
  const scored = otherMemories.map(m => ({
    memory: m,
    score: scoreMemory(m, keywords)
  }))
  
  // 取 top-K（非热数据）
  const topNonHot = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K - hotMemories.length)
    .map(s => s.memory)
  
  // 合并热数据和 top-K
  return [...hotMemories, ...topNonHot]
}
```

- [ ] **Step 2: 创建测试文件 memoryHotLoader.test.ts**

```typescript
import { extractKeywords, scoreMemory, type MemoryHeader } from './memoryHotLoader'
import { describe, it, expect } from 'vitest'

describe('extractKeywords', () => {
  it('extracts Chinese keywords', () => {
    const keywords = extractKeywords('帮我审查 Queenwin 网站的代码')
    expect(keywords).toContain('审查')
    expect(keywords).toContain('网站')
  })

  it('extracts English keywords', () => {
    const keywords = extractKeywords('review the React code')
    expect(keywords).toContain('review')
    expect(keywords).toContain('React')
  })

  it('deduplicates keywords', () => {
    const keywords = extractKeywords('用户用户用户')
    expect(keywords).toHaveLength(1)
  })
})

describe('scoreMemory', () => {
  const memory: MemoryHeader = {
    filename: 'test.md',
    filePath: '/memory/test.md',
    mtimeMs: Date.now(),
    description: '用户偏好文言风格',
    type: 'user',
    name: 'user_profile',
  }

  it('scores type match +3', () => {
    const score = scoreMemory(memory, ['用户', '偏好'])
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('scores description match +2', () => {
    const score = scoreMemory(memory, ['文言'])
    expect(score).toBeGreaterThanOrEqual(2)
  })

  it('scores name match +1', () => {
    const score = scoreMemory(memory, ['profile'])
    expect(score).toBeGreaterThanOrEqual(1)
  })

  it('returns 0 for no match', () => {
    const score = scoreMemory(memory, ['xyz123'])
    expect(score).toBe(0)
  })
})
```

- [ ] **Step 3: 运行测试验证**

```bash
cd /home/liuxue/2号员工/Claude-Code-ME
npx vitest src/memdir/memoryHotLoader.test.ts --run
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/memdir/memoryHotLoader.ts src/memdir/memoryHotLoader.test.ts
git commit -m "feat(memory): add hot loading with keyword-based relevance scoring"
```

---

## Task 2: 记忆压缩 (memoryCompressor.ts)

**Files:**
- Create: `src/memdir/memoryCompressor.ts`
- Test: `src/memdir/memoryCompressor.test.ts`

- [ ] **Step 1: 创建 memoryCompressor.ts**

```typescript
import { readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import type { MemoryType, MemoryHeader } from './memoryTypes.js'

export interface CompressionResult {
  compressed: number
  archived: string[]
  outputFile: string
}

/**
 * 合并同类记忆为单一摘要文件
 */
export async function compressMemories(
  memoryDir: string,
  type: MemoryType
): Promise<CompressionResult> {
  // 扫描该类型的所有记忆文件
  const entries = await readdir(memoryDir, { recursive: true })
  const typeFiles = entries.filter(f => {
    if (!f.endsWith('.md') || f === 'MEMORY.md') return false
    const filePath = join(memoryDir, f)
    return true
  })

  // 读取每个文件的头部信息
  const memories: Array<{
    path: string
    name: string | null
    description: string | null
    content: string
  }> = []

  for (const file of typeFiles) {
    const filePath = join(memoryDir, file)
    const content = await readFile(filePath, 'utf-8')
    const { frontmatter } = parseFrontmatter(content, filePath)
    
    if (frontmatter.type === type) {
      memories.push({
        path: filePath,
        name: frontmatter.name || null,
        description: frontmatter.description || null,
        content,
      })
    }
  }

  if (memories.length <= 1) {
    return { compressed: 0, archived: [], outputFile: '' }
  }

  // 合并内容
  const mergedLines: string[] = []
  const timestamp = new Date().toISOString().split('T')[0]

  for (const m of memories) {
    // 提取内容（去除 frontmatter）
    const lines = m.content.split('\n')
    const contentStart = lines.findIndex(l => l === '---')
    if (contentStart !== -1) {
      // 找到第二个 ---
      const contentEnd = lines.findIndex((l, i) => i > contentStart && l === '---')
      if (contentEnd !== -1) {
        const body = lines.slice(contentEnd + 1).join('\n').trim()
        if (body) {
          mergedLines.push(`- ${body}`)
        }
      }
    }
  }

  // 生成合并后的文件名
  const outputFile = join(dirname(memories[0]!.path), `${type}_merged_${timestamp}.md`)
  
  // 写入合并文件
  const mergedContent = `---
name: ${type}_merged
description: ${type}类型记忆合并摘要
type: ${type}
merged: ${timestamp}
count: ${memories.length}
---

# ${type} 类型记忆摘要

${mergedLines.join('\n')}
`

  await writeFile(outputFile, mergedContent, 'utf-8')

  // 删除原始文件
  const archived: string[] = []
  for (const m of memories) {
    await unlink(m.path)
    archived.push(m.path)
  }

  return {
    compressed: memories.length,
    archived,
    outputFile,
  }
}

/**
 * 检查是否需要压缩（同类文件超过阈值）
 */
export async function shouldCompress(
  memoryDir: string,
  type: MemoryType,
  threshold = 5
): Promise<boolean> {
  const entries = await readdir(memoryDir, { recursive: true })
  let count = 0
  
  for (const file of entries) {
    if (!file.endsWith('.md') || file === 'MEMORY.md') continue
    const filePath = join(memoryDir, file)
    const content = await readFile(filePath, 'utf-8')
    const { frontmatter } = parseFrontmatter(content, filePath)
    if (frontmatter.type === type) {
      count++
    }
  }
  
  return count > threshold
}
```

- [ ] **Step 2: 创建测试文件**

```typescript
import { compressMemories, shouldCompress } from './memoryCompressor'
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('compressMemories', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-test-'))
  })

  it('merges multiple memories of same type', async () => {
    // 创建测试文件
    await writeFile(join(tempDir, 'pref1.md'), `---
name: pref1
description: 用户偏好1
type: user
---
文言风格`, 'utf-8')
    
    await writeFile(join(tempDir, 'pref2.md'), `---
name: pref2
description: 用户偏好2
type: user
---
简洁回复`, 'utf-8')

    const result = await compressMemories(tempDir, 'user')
    
    expect(result.compressed).toBe(2)
    expect(result.archived).toHaveLength(2)
    expect(result.outputFile).toContain('user_merged')
  })

  it('returns empty if only one file', async () => {
    await writeFile(join(tempDir, 'only.md'), `---
name: only
type: user
---
唯一记忆`, 'utf-8')

    const result = await compressMemories(tempDir, 'user')
    
    expect(result.compressed).toBe(0)
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npx vitest src/memdir/memoryCompressor.test.ts --run
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/memdir/memoryCompressor.ts src/memdir/memoryCompressor.test.ts
git commit -m "feat(memory): add memory compression for merging similar memories"
```

---

## Task 3: 修改 soulMemory.ts 集成热度加载

**Files:**
- Modify: `src/utils/soulMemory.ts`

- [ ] **Step 1: 修改 soulMemory.ts 添加热度过滤**

```typescript
// 在文件顶部添加导入
import { loadRelevantMemories } from '../memdir/memoryHotLoader.js'

// 修改 loadSoulMemory 函数
export function loadSoulMemory(): HookResultMessage[] {
  const { soulPath, memoryPath, userPath } = getSoulMemoryPaths()
  const memoryDir = join(homedir(), '.claude', 'memory')

  const soulContent = readFileContent(soulPath)
  const memoryContent = readFileContent(memoryPath)
  const userContent = readFileContent(userPath)

  // TODO: 从环境变量或上下文获取首条用户消息
  // 暂时使用空字符串，返回热数据（user type）作为默认
  const firstUserMessage = process.env.LAST_USER_MESSAGE || ''

  const messages: HookResultMessage[] = []

  let additionalContext = ''

  if (soulContent) {
    additionalContext += `\n\n## 你的 Soul（灵魂）\n\n${soulContent}`
  }

  // 使用热度加载替代全量加载
  if (memoryContent && firstUserMessage) {
    try {
      const relevantMemories = await loadRelevantMemories(
        firstUserMessage,
        memoryDir
      )
      // 只加载相关的记忆内容
      // ... 加载逻辑
    } catch {
      // 失败时回退到全量加载
      additionalContext += `\n\n## Long-term Memory\n\n${memoryContent}`
    }
  } else if (memoryContent) {
    additionalContext += `\n\n## Long-term Memory\n\n${memoryContent}`
  }

  if (userContent) {
    additionalContext += `\n\n## User Profile\n\n${userContent}`
  }

  if (additionalContext) {
    const contextMessage = createAttachmentMessage({
      type: 'hook_additional_context',
      content: [additionalContext.trim()],
      hookName: 'SoulMemory',
      toolUseID: 'SoulMemory',
      hookEvent: 'SessionStart',
    })
    messages.push(contextMessage)
  }

  return messages
}
```

Note: 由于 `loadSoulMemory` 是同步函数，需要重构为异步或使用懒加载。

- [ ] **Step 2: 提交**

```bash
git add src/utils/soulMemory.ts
git commit -m "feat(memory): integrate hot loading into soulMemory"
```

---

## Task 4: 在 compact 时触发压缩

**Files:**
- Modify: `src/services/compact/sessionMemoryCompact.ts`

- [ ] **Step 1: 添加压缩触发逻辑**

在 `trySessionMemoryCompaction` 函数末尾或 `processSessionStartHooks` 后添加：

```typescript
// 在 sessionMemoryCompact.ts 添加
import { compressMemories, shouldCompress } from '../../memdir/memoryCompressor.js'
import { MEMORY_TYPES } from '../../memdir/memoryTypes.js'

/**
 * 尝试压缩记忆（异步，不阻塞主流程）
 */
export async function tryCompressMemories(): Promise<void> {
  const memoryDir = join(homedir(), '.claude', 'memory')
  
  for (const type of MEMORY_TYPES) {
    try {
      if (await shouldCompress(memoryDir, type, 5)) {
        await compressMemories(memoryDir, type)
      }
    } catch {
      // 压缩失败不阻塞
    }
  }
}
```

在 `trySessionMemoryCompaction` 成功后调用：

```typescript
// 在 trySessionMemoryCompaction 成功后
// 添加一行调用
await tryCompressMemories()
```

- [ ] **Step 2: 提交**

```bash
git add src/services/compact/sessionMemoryCompact.ts
git commit -m "feat(memory): trigger memory compression on compact"
```

---

## Task 5: 自动抽取（简化版）

**Files:**
- Create: `src/memdir/memoryAutoExtractor.ts`

- [ ] **Step 1: 创建自动抽取模块（简化版）**

```typescript
/**
 * 简化版自动抽取 - 从项目目录结构抽取项目记忆
 */
import { readdir } from 'fs/promises'
import { join } from 'path'
import type { MemoryType } from './memoryTypes.js'

export interface ExtractedMemory {
  name: string
  description: string
  type: MemoryType
  content: string
}

/**
 * 从项目目录结构提取技术栈信息
 */
export async function extractTechStack(
  projectDir: string
): Promise<ExtractedMemory | null> {
  try {
    const entries = await readdir(projectDir, { recursive: true })
    const techIndicators: string[] = []
    
    // 检测 package.json
    if (entries.some(e => e.endsWith('package.json'))) {
      techIndicators.push('Node.js')
    }
    // 检测 Cargo.toml
    if (entries.some(e => e.endsWith('Cargo.toml'))) {
      techIndicators.push('Rust')
    }
    // 检测 requirements.txt
    if (entries.some(e => e.endsWith('requirements.txt'))) {
      techIndicators.push('Python')
    }
    // 检测 go.mod
    if (entries.some(e => e.endsWith('go.mod'))) {
      techIndicators.push('Go')
    }
    
    if (techIndicators.length === 0) return null
    
    return {
      name: 'tech_stack',
      description: `项目使用的技术栈: ${techIndicators.join(', ')}`,
      type: 'project',
      content: `- 技术栈: ${techIndicators.join(', ')}\n- 检测时间: ${new Date().toISOString()}`,
    }
  } catch {
    return null
  }
}

/**
 * 从项目名推断项目类型
 */
export async function extractProjectType(
  projectDir: string
): Promise<ExtractedMemory | null> {
  const projectName = projectDir.split('/').pop()
  if (!projectName) return null
  
  const typeIndicators: Record<string, string[]> = {
    'react': ['React', '前端'],
    'vue': ['Vue', '前端'],
    'next': ['Next.js', '前端'],
    'api': ['API', '后端'],
    'server': ['Server', '后端'],
    'cli': ['CLI', '工具'],
  }
  
  const lower = projectName.toLowerCase()
  for (const [key, labels] of Object.entries(typeIndicators)) {
    if (lower.includes(key)) {
      return {
        name: 'project_type',
        description: labels[0],
        type: 'project',
        content: `- 项目类型: ${labels[1] || labels[0]}\n- 项目名: ${projectName}`,
      }
    }
  }
  
  return null
}
```

- [ ] **Step 2: 提交**

```bash
git add src/memdir/memoryAutoExtractor.ts
git commit -m "feat(memory): add auto-extractor for project facts"
```

---

## 实施顺序

1. **Task 1**: 热度加载（基础，依赖最少）
2. **Task 2**: 记忆压缩（可独立测试）
3. **Task 3**: 修改 soulMemory.ts（集成热度加载）
4. **Task 4**: 在 compact 时触发压缩
5. **Task 5**: 自动抽取（简化版，可后续扩展）

---

## 自查清单

- [ ] Task 1 测试通过
- [ ] Task 2 测试通过
- [ ] Task 3 编译无误
- [ ] Task 4 编译无误
- [ ] Task 5 编译无误
- [ ] 所有新文件已提交
- [ ] 与现有 soulMemory.ts 兼容
