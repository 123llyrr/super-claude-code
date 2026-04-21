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
