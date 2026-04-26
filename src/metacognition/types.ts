// ============================================================================
// Metacognition System - Core Types
// ============================================================================

import type { Message } from '../types/message.js'

// ----------------------------------------------------------------------------
// Uncertainty (幻觉防护)
// ----------------------------------------------------------------------------

export type UncertaintyType = 'out_of_context' | 'low_confidence' | 'refused'

export interface UncertainSignal {
  type: UncertaintyType
  originalPrompt: string
  reason: string
  suggestedAlternative?: string
  confidence?: number // 0-1, 模型隐式置信度
}

export interface UncertaintyConfig {
  behavior: 'refuse' | 'express' | 'silent'
  threshold: number // 0-1, 低于此值触发 uncertainty
}

// ----------------------------------------------------------------------------
// Self-Correction (自我修正)
// ----------------------------------------------------------------------------

export type CorrectionTrigger = 'system_signal' | 'self_verification' | 'user_challenge'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorSignal {
  trigger: CorrectionTrigger
  location?: string // 'file:line' 格式
  description: string
  originalCode?: string
  suggestedFix?: string
  severity: ErrorSeverity
  toolName?: string
  errorDetails?: string
}

export interface CorrectionProposal {
  error: ErrorSignal
  fixDescription: string
  originalCode: string
  fixedCode: string
  requiresConfirmation: boolean
  autoExecuteAfterSeconds: number
}

export interface SelfCorrectionConfig {
  trigger: {
    system_signal: boolean
    self_verification: 'auto' | 'always' | 'never'
    user_challenge: boolean
  }
  confirmation_required: boolean
  auto_execute_delay_seconds: number
  high_risk_tasks: string[]
}

export interface SelfVerificationContext {
  taskType?: string
  fileWriteCount?: number
  isSecuritySensitive?: boolean
  isBatchOperation?: boolean
}

// ----------------------------------------------------------------------------
// Self-Optimization (自优化)
// ----------------------------------------------------------------------------

export interface ErrorPattern {
  patternKey: string // 错误模式哈希
  description: string
  occurrenceCount: number
  firstSeen: Date
  lastSeen: Date
  suggestedPrevention?: string
}

export interface StrategyAdjustment {
  type: 'prompt' | 'rule' | 'behavior'
  description: string
  target: string // CLAUDE.md rule, system prompt, etc.
  reasoning: string
}

export interface LearnedInsight {
  key: string
  value: string
  source: 'session' | 'project' | 'global'
  accepted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SelfOptimizationConfig {
  pattern_threshold: number // 同一错误出现 N 次后提出建议
  learn_from: Array<'session' | 'project' | 'global'>
}

// ----------------------------------------------------------------------------
// Metacognition Module Interface
// ----------------------------------------------------------------------------

export interface MetacognitionModule {
  // 1. 幻觉防护
  checkUncertainty(context: {
    prompt: string
    messages: readonly Message[]
  }): UncertainSignal | null

  expressUncertainty(signal: UncertainSignal): string

  // 2. 自我修正
  checkForErrors(context: {
    outcome: 'success' | 'failure' | 'partial'
    toolName?: string
    errorDetails?: string
    messages: readonly Message[]
  }): ErrorSignal | null

  shouldSelfVerify(context: SelfVerificationContext): boolean

  proposeCorrection(error: ErrorSignal): CorrectionProposal

  // 3. 自优化
  recordError(error: ErrorSignal): void

  recognizePattern(): ErrorPattern | null

  proposeStrategyAdjustment(pattern: ErrorPattern): StrategyAdjustment
}

// ----------------------------------------------------------------------------
// AppState Extension
// ----------------------------------------------------------------------------

export interface MetacognitionState {
  errorPatterns: Record<string, ErrorPattern>
  learnedInsights: Record<string, LearnedInsight>
  sessionErrorCount: number
  lastErrors: ErrorSignal[]
}

// ----------------------------------------------------------------------------
// CLAUDE.md Config Shape
// ----------------------------------------------------------------------------

export interface MetacognitionConfig {
  uncertain?: Partial<UncertaintyConfig>
  self_correction?: Partial<SelfCorrectionConfig>
  self_optimization?: Partial<SelfOptimizationConfig>
}
