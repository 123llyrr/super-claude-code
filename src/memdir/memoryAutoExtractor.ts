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