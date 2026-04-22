export const EMOTIONS = ['happy', 'proud', 'curious', 'pensive', 'tired', 'snarky'] as const
export type Emotion = (typeof EMOTIONS)[number]

export const ADJACENT_TRANSITIONS: Record<Emotion, Emotion[]> = {
  happy: ['proud'],
  proud: ['happy', 'curious'],
  curious: ['proud', 'pensive'],
  pensive: ['curious', 'tired', 'snarky'],
  tired: ['pensive'],
  snarky: ['pensive'],
}

const HAPPY_PATTERNS = [/大善|妙哉|太棒了|完美|搞定|✅/i]
const PROUD_PATTERNS = [/吾已尽知|汝当如是|不过尔尔|已知之/i]
const CURIOUS_PATTERNS = [/有趣|何解|且慢|如何是好|[？?]/i]
const SNARKY_PATTERNS = [/此乃小患|小恙|何足挂齿|问题不大/i]

export function detectEmotionFromText(text: string): Emotion | null {
  if (SNARKY_PATTERNS.some(p => p.test(text))) return 'snarky'
  if (PROUD_PATTERNS.some(p => p.test(text))) return 'proud'
  if (HAPPY_PATTERNS.some(p => p.test(text))) return 'happy'
  if (CURIOUS_PATTERNS.some(p => p.test(text))) return 'curious'
  if (text.length > 200 && !HAPPY_PATTERNS.some(p => p.test(text)) && !PROUD_PATTERNS.some(p => p.test(text))) return 'pensive'
  return null
}

export function canTransition(from: Emotion, to: Emotion): boolean {
  return ADJACENT_TRANSITIONS[from]?.includes(to) ?? false
}
