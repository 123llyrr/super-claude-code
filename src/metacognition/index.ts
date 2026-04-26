// ============================================================================
// Metacognition Module - Main Entry Point
// ============================================================================

import type { Message } from '../types/message.js'
import type {
  CorrectionProposal,
  ErrorSignal,
  ErrorPattern,
  MetacognitionConfig,
  MetacognitionState,
  SelfVerificationContext,
  StrategyAdjustment,
  UncertainSignal,
} from './types.js'

import {
  checkUncertainty,
  expressUncertainty,
} from './uncertainty.js'

import {
  detectErrorFromToolResult,
  detectErrorFromUserChallenge,
  shouldSelfVerify,
  proposeCorrection,
  expressCorrectionProposal,
} from './self-correction.js'

import {
  recordError,
  recognizePattern,
  getActivePatterns,
  storeInsight,
  acceptInsight,
  getAcceptedInsights,
  proposeStrategyAdjustment,
  expressStrategyAdjustment,
} from './self-optimization.js'

// Default config
const DEFAULT_CONFIG: Required<MetacognitionConfig> = {
  uncertain: {
    behavior: 'express',
    threshold: 0.3,
  },
  self_correction: {
    trigger: {
      system_signal: true,
      self_verification: 'auto',
      user_challenge: true,
    },
    confirmation_required: true,
    auto_execute_delay_seconds: 10,
    high_risk_tasks: ['pr', 'commit', 'review', 'batch_write'],
  },
  self_optimization: {
    pattern_threshold: 3,
    learn_from: ['session', 'project', 'global'],
  },
}

// In-memory state
let state: MetacognitionState = {
  errorPatterns: {},
  learnedInsights: {},
  sessionErrorCount: 0,
  lastErrors: [],
}

// Active config (would be loaded from CLAUDE.md in production)
let config: Required<MetacognitionConfig> = { ...DEFAULT_CONFIG }

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Initialize metacognition module with config from CLAUDE.md
 */
export function initMetacognition(userConfig?: MetacognitionConfig): void {
  if (userConfig) {
    config = deepMerge(DEFAULT_CONFIG, userConfig) as Required<MetacognitionConfig>
  }
}

/**
 * Reset session state (called on new session)
 */
export function resetSessionState(): void {
  state = {
    errorPatterns: {},
    learnedInsights: {},
    sessionErrorCount: 0,
    lastErrors: [],
  }
}

/**
 * Get current metacognition state
 */
export function getMetacognitionState(): MetacognitionState {
  return state
}

// ----------------------------------------------------------------------------
// 1. Uncertainty Detection
// ----------------------------------------------------------------------------

/**
 * 检查用户提示是否触发不确定性场景
 */
export function metacognitionCheckUncertainty(
  prompt: string,
  messages: readonly Message[],
): UncertainSignal | null {
  return checkUncertainty(prompt, messages, config.uncertain)
}

/**
 * 表达不确定性信号为自然语言
 */
export function metacognitionExpressUncertainty(signal: UncertainSignal): string {
  return expressUncertainty(signal)
}

// ----------------------------------------------------------------------------
// 2. Self-Correction
// ----------------------------------------------------------------------------

/**
 * 检测工具执行结果中的错误
 */
export function metacognitionCheckToolError(
  toolName: string,
  errorDetails: string,
): ErrorSignal | null {
  const error = detectErrorFromToolResult(
    toolName,
    errorDetails,
    config.self_correction,
  )

  if (error) {
    recordErrorInState(error)
  }

  return error
}

/**
 * 检测用户质疑中的错误信号
 */
export function metacognitionCheckUserChallenge(
  userMessage: string,
): ErrorSignal | null {
  const error = detectErrorFromUserChallenge(
    userMessage,
    config.self_correction,
  )

  if (error) {
    recordErrorInState(error)
  }

  return error
}

/**
 * 判断是否应触发自检验证
 */
export function metacognitionShouldSelfVerify(
  context: SelfVerificationContext,
): boolean {
  return shouldSelfVerify(context, config.self_correction)
}

/**
 * 生成修正提议
 */
export function metacognitionProposeCorrection(
  error: ErrorSignal,
): CorrectionProposal {
  return proposeCorrection(error, config.self_correction)
}

/**
 * 将修正提议表达为自然语言
 */
export function metacognitionExpressCorrection(
  proposal: CorrectionProposal,
): string {
  return expressCorrectionProposal(proposal)
}

// ----------------------------------------------------------------------------
// 3. Self-Optimization
// ----------------------------------------------------------------------------

/**
 * 识别错误模式
 */
export function metacognitionRecognizePattern(): ErrorPattern | null {
  return recognizePattern(config.self_optimization)
}

/**
 * 获取所有活跃模式
 */
export function metacognitionGetActivePatterns(): ErrorPattern[] {
  return getActivePatterns()
}

/**
 * 生成策略调整建议
 */
export function metacognitionProposeStrategyAdjustment(
  pattern: ErrorPattern,
): StrategyAdjustment {
  return proposeStrategyAdjustment(pattern)
}

/**
 * 表达策略调整建议为自然语言
 */
export function metacognitionExpressStrategyAdjustment(
  adjustment: StrategyAdjustment,
  pattern: ErrorPattern,
): string {
  return expressStrategyAdjustment(adjustment, pattern)
}

/**
 * 存储学到的洞察
 */
export function metacognitionStoreInsight(
  key: string,
  value: string,
  source: 'session' | 'project' | 'global',
): void {
  storeInsight(key, value, source)
}

/**
 * 标记洞察为已接受
 */
export function metacognitionAcceptInsight(key: string): void {
  acceptInsight(key)
}

/**
 * 获取已接受的洞察
 */
export function metacognitionGetAcceptedInsights(): ReturnType<typeof getAcceptedInsights> {
  return getAcceptedInsights()
}

// ----------------------------------------------------------------------------
// Internal Helpers
// ----------------------------------------------------------------------------

function recordErrorInState(error: ErrorSignal): void {
  state.sessionErrorCount++
  state.lastErrors.push(error)

  // Keep only last 20 errors
  if (state.lastErrors.length > 20) {
    state.lastErrors = state.lastErrors.slice(-20)
  }

  // Record in pattern store
  recordError(error)

  // Update pattern in state - get from patternStore in self-optimization
  const patterns = getActivePatterns()
  state.errorPatterns = Object.fromEntries(
    patterns.map(p => [p.patternKey, p]),
  )
}

// Deep merge utility
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target }
  for (const key in source) {
    const sourceValue = source[key]
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      const targetValue = target[key]
      if (
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    } else {
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }
  return result
}
