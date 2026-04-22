import type { Message } from '../types/message.js'
import { detectEmotionFromText } from './emotions.js'
import { getCompanion } from './companion.js'
import type { Emotion } from './emotions.js'

export type ReactionCallback = (reaction: string | undefined) => void

function extractReplyText(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.type !== 'assistant') return ''
  return lastMsg.content?.map(block => block.text ?? '').join('\n') ?? ''
}

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: ReactionCallback,
): Promise<void> {
  const companion = getCompanion()
  if (!companion) return

  const text = extractReplyText(messages)
  if (!text) return

  const emotion = detectEmotionFromText(text)
  if (!emotion) return

  const quips: Record<Emotion, string[]> = {
    happy: ['大善！', '妙哉！', '太棒了！'],
    proud: ['吾已知之', '不过尔尔', '汝当如是'],
    curious: ['有趣...', '何解？', '且慢！'],
    pensive: ['...', '沉思中', '吾细思之'],
    tired: ['zzZ...', '稍候...', '哈欠...'],
    snarky: ['此乃小患', '何足挂齿', '小恙耳'],
  }

  const options = quips[emotion]
  const quip = options[Math.floor(Math.random() * options.length)]!
  onReaction(quip)
}
