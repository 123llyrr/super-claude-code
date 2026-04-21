import { readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { parseFrontmatter } from '../utils/frontmatterParser.js'
import type { MemoryType } from './memoryTypes.js'

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
  const mdFiles = entries.filter(
    f => f.endsWith('.md') && f !== 'MEMORY.md'
  )

  // 读取每个文件的头部信息
  const memories: Array<{
    path: string
    name: string | null
    description: string | null
    content: string
  }> = []

  for (const file of mdFiles) {
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
  const mdFiles = entries.filter(
    f => f.endsWith('.md') && f !== 'MEMORY.md'
  )
  let count = 0

  for (const file of mdFiles) {
    const filePath = join(memoryDir, file)
    const content = await readFile(filePath, 'utf-8')
    const { frontmatter } = parseFrontmatter(content, filePath)
    if (frontmatter.type === type) {
      count++
    }
  }

  return count > threshold
}
