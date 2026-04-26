// ============================================================================
// Uncertainty Module - 幻觉防护
// ============================================================================

import type { Message } from '../types/message.js'
import type { UncertaintyConfig, UncertainSignal } from './types.js'

// 内置触发词：超出上下文
const OUT_OF_CONTEXT_PATTERNS = [
  /这个\s*(API|接口|服务|库|框架|SDK|文档)/i,
  /某个\s*\w+\s*(是什么|怎么用|在哪里|是谁)/i,
  /(请|能|可)否\s*(告诉|为?汝).*?(它|他|她|这|那)\s*(是|叫|在|如何)/i,
  /汝\s*(可知道|是否知道)/i,
]

// 内置触发词：低置信度信号
const LOW_CONFIDENCE_SIGNALS = [
  /不确定/i,
  /不太确定/i,
  /可能有误/i,
  /也许/i,
  /大概/i,
  /估计/i,
  /可能是/i,
  /看起来像/i,
  /应该是/i,
  /依稀记得/i,
  /印象中/i,
  /如果没记错/i,
]

const DEFAULT_CONFIG: UncertaintyConfig = {
  behavior: 'express',
  threshold: 0.3,
}

/**
 * 检测用户提示是否触发了不确定性场景
 */
export function checkUncertainty(
  prompt: string,
  messages: readonly Message[],
  config: Partial<UncertaintyConfig> = {},
): UncertainSignal | null {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // 1. 检查是否明确超出上下文
  for (const pattern of OUT_OF_CONTEXT_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        type: 'out_of_context',
        originalPrompt: prompt,
        reason: '问题涉及未提供上下文的外部系统或未知实体',
        suggestedAlternative: '请提供该系统/服务的名称、文档或相关上下文',
      }
    }
  }

  // 2. 检查用户是否明确要求"不知道就说不知道"
  if (
    /不知道.*就说|不知道.*停止|不确定.*不要.*编|don't guess/i.test(prompt)
  ) {
    return {
      type: 'refused',
      originalPrompt: prompt,
      reason: '用户明确要求在不确定时停止',
      suggestedAlternative: '请直接回复"吾不知此事"',
    }
  }

  // 3. 尝试从历史消息中推断置信度
  // 检查 AI 近期回复中是否有低置信度信号
  for (const msg of messages.slice(-5)) {
    if (msg.type === 'assistant') {
      const content = extractTextContent(msg)
      for (const signal of LOW_CONFIDENCE_SIGNALS) {
        if (signal.test(content)) {
          return {
            type: 'low_confidence',
            originalPrompt: prompt,
            reason: 'AI 在近期回复中表达了不确定',
            confidence: 0.4,
            suggestedAlternative: '请提供更多上下文以便准确回答',
          }
        }
      }
    }
  }

  // 4. 检查是否涉及代码但缺乏上下文
  if (
    /\b(function|class|interface|type|const|let|var|import|export)\b/.test(
      prompt,
    ) &&
    !messages.some(m => m.type === 'user' && /\.(ts|js|tsx|jsx)/.test(m.message?.content ?? ''))
  ) {
    // 用户提到了代码概念但对话中没有文件上下文
    return {
      type: 'out_of_context',
      originalPrompt: prompt,
      reason: '涉及代码但缺乏项目文件上下文',
      suggestedAlternative: '请提供相关代码片段或文件路径',
    }
  }

  return null
}

/**
 * 将不确定性信号转换为自然语言表达
 */
export function expressUncertainty(signal: UncertainSignal): string {
  switch (signal.type) {
    case 'out_of_context':
      return `此事吾无足够上下文，难以准确回答。${signal.suggestedAlternative ?? ''}`

    case 'refused':
      return `吾不知此事。`

    case 'low_confidence':
      return `吾对此不确定，可能有误。${signal.suggestedAlternative ?? ''}`

    default:
      return `此事吾不确信，请提供更多上下文。`
  }
}

/**
 * 解析消息中的文本内容
 */
function extractTextContent(msg: Message): string {
  const content = msg.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')
  }
  return ''
}
