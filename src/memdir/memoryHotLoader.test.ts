import { extractKeywords, scoreMemory, type MemoryHeader } from './memoryHotLoader'
import { describe, it, expect } from 'vitest'

describe('extractKeywords', () => {
  it('extracts Chinese keywords', () => {
    const keywords = extractKeywords('帮我审查 Queenwin 网站的代码')
    // Chinese phrases are extracted as continuous sequences
    const chineseKw = keywords.filter(k => /[\u4e00-\u9fa5]/.test(k))
    expect(chineseKw.length).toBeGreaterThan(0)
    // "网站" should be part of one of the Chinese phrases
    expect(chineseKw.some(k => k.includes('网站'))).toBe(true)
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
