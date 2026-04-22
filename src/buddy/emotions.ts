type Emotion = 'happy' | 'proud' | 'curious' | 'pensive' | 'tired' | 'snarky'

export const ADJACENT_TRANSITIONS: Record<Emotion, Emotion[]> = {
  happy: ['proud'],
  proud: ['happy', 'curious'],
  curious: ['proud', 'pensive'],
  pensive: ['curious', 'tired', 'snarky'],
  tired: ['pensive'],
  snarky: ['pensive'],
}

export const EMOTIONS: readonly Emotion[] = Object.keys(ADJACENT_TRANSITIONS) as Emotion[]
export type { Emotion }

const HAPPY_PATTERNS = [/大善|妙哉|太棒了|完美|搞定|✅/i]
const PROUD_PATTERNS = [/吾已尽知|汝当如是|不过尔尔|已知之/i]
const CURIOUS_PATTERNS = [/有趣|何解|且慢|如何是好|[？?]/i]
const SNARKY_PATTERNS = [/此乃小患|小恙|何足挂齿|问题不大/i]

const EMOTION_PATTERNS: Array<{ patterns: RegExp[], emotion: Emotion }> = [
  { patterns: SNARKY_PATTERNS, emotion: 'snarky' },
  { patterns: PROUD_PATTERNS, emotion: 'proud' },
  { patterns: HAPPY_PATTERNS, emotion: 'happy' },
  { patterns: CURIOUS_PATTERNS, emotion: 'curious' },
]

export function detectEmotionFromText(text: string): Emotion | null {
  for (const { patterns, emotion } of EMOTION_PATTERNS) {
    if (patterns.some(p => p.test(text))) return emotion
  }
  if (text.length > 200) return 'pensive'
  return null
}

export function canTransition(from: Emotion, to: Emotion): boolean {
  return ADJACENT_TRANSITIONS[from]?.includes(to) ?? false
}
