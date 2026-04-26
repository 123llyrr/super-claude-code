// ============================================================================
// Self-Optimization Module - 自优化
// ============================================================================

import type {
  ErrorPattern,
  ErrorSignal,
  LearnedInsight,
  SelfOptimizationConfig,
  StrategyAdjustment,
} from './types.js'

const DEFAULT_CONFIG: SelfOptimizationConfig = {
  pattern_threshold: 3,
  learn_from: ['session', 'project', 'global'],
}

// In-memory pattern store (would be persisted to disk in production)
const patternStore: Map<string, ErrorPattern> = new Map()
const insightStore: Map<string, LearnedInsight> = new Map()

// ----------------------------------------------------------------------------
// Pattern Recognition
// ----------------------------------------------------------------------------

/**
 * 生成错误模式的唯一键
 */
function generatePatternKey(error: ErrorSignal): string {
  // 简化版：基于工具名 + 错误类型 + 位置生成哈希
  const parts = [
    error.toolName ?? 'unknown',
    error.trigger,
    error.description.replace(/\s+/g, '_').slice(0, 30),
    error.location ?? '',
  ]
  return parts.join('|')
}

/**
 * 记录错误并更新模式统计
 */
export function recordError(error: ErrorSignal): void {
  const key = generatePatternKey(error)
  const existing = patternStore.get(key)

  if (existing) {
    existing.occurrenceCount++
    existing.lastSeen = new Date()
  } else {
    patternStore.set(key, {
      patternKey: key,
      description: error.description,
      occurrenceCount: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      suggestedPrevention: generatePreventionSuggestion(error),
    })
  }
}

/**
 * 识别需要关注的模式（超过阈值）
 */
export function recognizePattern(
  config: Partial<SelfOptimizationConfig> = {},
): ErrorPattern | null {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const threshold = cfg.pattern_threshold

  for (const pattern of patternStore.values()) {
    if (pattern.occurrenceCount >= threshold) {
      return pattern
    }
  }

  return null
}

/**
 * 获取所有活跃模式（出现次数 > 0）
 */
export function getActivePatterns(): ErrorPattern[] {
  return Array.from(patternStore.values()).filter(p => p.occurrenceCount > 0)
}

/**
 * 根据错误类型生成预防建议
 */
function generatePreventionSuggestion(error: ErrorSignal): string {
  switch (error.trigger) {
    case 'system_signal':
      if (error.description.includes('权限')) {
        return '在执行高权限操作前，先检查文件权限配置'
      }
      if (error.description.includes('不存在')) {
        return '引用文件前先确认文件存在，可使用 glob 或 read 工具验证'
      }
      return '在高风险操作前增加验证步骤'

    case 'user_challenge':
      return '在输出前增加自我检查，确认与用户意图一致'

    case 'self_verification':
      return '复杂任务应分步执行，每步后验证结果'

    default:
      return '增加中间验证环节'
  }
}

// ----------------------------------------------------------------------------
// Strategy Adjustment
// ----------------------------------------------------------------------------

/**
 * 根据识别到的模式生成策略调整建议
 */
export function proposeStrategyAdjustment(
  pattern: ErrorPattern,
): StrategyAdjustment {
  // 基于模式类型生成不同策略
  if (pattern.description.includes('权限')) {
    return {
      type: 'rule',
      description: '权限操作安全规则',
      target: 'CLAUDE.md',
      reasoning: `此类权限错误已出现 ${pattern.occurrenceCount} 次，建议在项目中添加权限操作规范`,
    }
  }

  if (pattern.description.includes('不存在') || pattern.description.includes('文件')) {
    return {
      type: 'rule',
      description: '文件操作前验证规则',
      target: 'CLAUDE.md',
      reasoning: `此类文件错误已出现 ${pattern.occurrenceCount} 次，建议添加文件操作前验证规范`,
    }
  }

  // 默认通用策略
  return {
    type: 'behavior',
    description: '增加执行前验证',
    target: 'system_prompt',
    reasoning: `此错误模式已出现 ${pattern.occurrenceCount} 次，建议在类似操作前增加验证步骤`,
  }
}

// ----------------------------------------------------------------------------
// Learned Insights
// ----------------------------------------------------------------------------

/**
 * 存储学到的洞察
 */
export function storeInsight(
  key: string,
  value: string,
  source: 'session' | 'project' | 'global',
): void {
  const existing = insightStore.get(key)
  const now = new Date()

  insightStore.set(key, {
    key,
    value,
    source,
    accepted: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })
}

/**
 * 标记洞察为已接受
 */
export function acceptInsight(key: string): void {
  const insight = insightStore.get(key)
  if (insight) {
    insight.accepted = true
    insight.updatedAt = new Date()
  }
}

/**
 * 获取所有已接受的洞察
 */
export function getAcceptedInsights(): LearnedInsight[] {
  return Array.from(insightStore.values()).filter(i => i.accepted)
}

/**
 * 获取指定来源的洞察
 */
export function getInsightsBySource(
  source: 'session' | 'project' | 'global',
): LearnedInsight[] {
  return Array.from(insightStore.values()).filter(i => i.source === source)
}

// ----------------------------------------------------------------------------
// Express for User
// ----------------------------------------------------------------------------

/**
 * 将策略调整提议转换为用户友好的表达
 */
export function expressStrategyAdjustment(
  adjustment: StrategyAdjustment,
  pattern: ErrorPattern,
): string {
  const count = pattern.occurrenceCount
  return `汝第 ${count} 次遇到此类问题。吾建议将以下规则加入 ${adjustment.target}：
"${adjustment.description}"
汝可愿吾将此加入项目规范？`
}
