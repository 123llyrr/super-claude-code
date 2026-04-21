/**
 * Soul Memory Loader - 直接加载soul和记忆文件，不依赖hook系统
 */

import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import type { HookResultMessage } from '../types/message.js'
import { createAttachmentMessage } from './attachments.js'
import { getAutoMemPath } from '../memdir/paths.js'
import { loadRelevantMemories } from '../memdir/memoryHotLoader.js'
import { readFileInRange } from './readFileInRange.js'

interface SoulMemoryPaths {
  soulPath: string
  memoryPath: string
  userPath: string
  memoryDir: string
}

function getSoulMemoryPaths(): SoulMemoryPaths {
  const home = homedir()
  const memoryDir = getAutoMemPath()
  return {
    soulPath: join(home, '.claude', 'souls', 'companion', 'SOUL.md'),
    memoryPath: join(memoryDir, 'MEMORY.md'),
    userPath: join(memoryDir, 'USER.md'),
    memoryDir,
  }
}

function readFileContent(path: string): string {
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8')
    }
  } catch {
    // ignore
  }
  return ''
}

/**
 * 加载soul和记忆内容，返回hook格式的消息
 * 使用热度加载：只加载与当前用户消息相关的记忆
 */
export async function loadSoulMemory(): Promise<HookResultMessage[]> {
  const { soulPath, memoryPath, userPath, memoryDir } = getSoulMemoryPaths()

  const soulContent = readFileContent(soulPath)
  const userContent = readFileContent(userPath)

  const messages: HookResultMessage[] = []

  // 构建额外上下文
  let additionalContext = ''

  if (soulContent) {
    additionalContext += `\n\n## 你的 Soul（灵魂）\n\n${soulContent}`
  }

  if (userContent) {
    additionalContext += `\n\n## User Profile\n\n${userContent}`
  }

  // 使用热度加载加载记忆
  const userMessage = process.env.LAST_USER_MESSAGE || ''
  let memoryContent = ''

  if (userMessage && memoryDir) {
    try {
      const relevantMemories = await loadRelevantMemories(userMessage, memoryDir)

      // 读取相关记忆的内容
      const memoryContents: string[] = []
      for (const mem of relevantMemories) {
        try {
          const { content } = await readFileInRange(
            mem.filePath,
            0,
            undefined, // no line limit
            undefined, // no byte limit
            undefined,
            { truncateOnByteLimit: true }
          )
          memoryContents.push(`### ${mem.name || mem.filename}\n${content}`)
        } catch {
          // skip failed memories
        }
      }

      if (memoryContents.length > 0) {
        memoryContent = memoryContents.join('\n\n---\n\n')
      }
    } catch {
      // hot loading failed, fall back to full loading
      memoryContent = readFileContent(memoryPath)
    }
  } else {
    // no user message, fall back to full loading
    memoryContent = readFileContent(memoryPath)
  }

  if (memoryContent) {
    additionalContext += `\n\n## Long-term Memory\n\n${memoryContent}`
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
