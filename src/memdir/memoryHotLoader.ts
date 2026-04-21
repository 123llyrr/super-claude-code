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
