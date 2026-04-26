// ============================================================================
// Self-Correction Module - 自我修正
// ============================================================================

import type {
  CorrectionProposal,
  ErrorSeverity,
  ErrorSignal,
  SelfCorrectionConfig,
  SelfVerificationContext,
} from './types.js'

const DEFAULT_CONFIG: SelfCorrectionConfig = {
  trigger: {
    system_signal: true,
    self_verification: 'auto',
    user_challenge: true,
  },
  confirmation_required: true,
  auto_execute_delay_seconds: 10,
  high_risk_tasks: ['pr', 'commit', 'review', 'batch_write'],
}

// ----------------------------------------------------------------------------
// Error Detection
// ----------------------------------------------------------------------------

/**
 * 从工具执行结果中检测错误
 */
export function detectErrorFromToolResult(
  toolName: string,
  errorDetails: string,
  config: Partial<SelfCorrectionConfig> = {},
): ErrorSignal | null {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (!cfg.trigger.system_signal) return null

  // 权限拒绝
  if (/permission denied|权限拒绝|denied|not allowed/i.test(errorDetails)) {
    return {
      trigger: 'system_signal',
      toolName,
      errorDetails,
      description: `工具 ${toolName} 被拒绝执行：权限不足`,
      severity: 'medium',
      suggestedFix: '检查文件权限设置或使用 sudo',
    }
  }

  // 文件不存在
  if (/no such file|文件不存在|not found|enoent/i.test(errorDetails)) {
    return {
      trigger: 'system_signal',
      toolName,
      errorDetails,
      description: `工具 ${toolName} 引用了不存在的文件或路径`,
      severity: 'high',
      suggestedFix: '检查文件路径是否正确，或确认文件是否已创建',
    }
  }

  // 语法错误
  if (/syntax error|语法错误|parse error|unexpected token/i.test(errorDetails)) {
    return {
      trigger: 'system_signal',
      toolName,
      errorDetails,
      description: `检测到语法错误`,
      severity: 'high',
    }
  }

  // 工具执行失败
  if (/failed|error|错误|失败/i.test(errorDetails)) {
    return {
      trigger: 'system_signal',
      toolName,
      errorDetails,
      description: `工具 ${toolName} 执行失败`,
      severity: errorDetails.includes('critical') ? 'critical' : 'medium',
    }
  }

  return null
}

/**
 * 从用户质疑中检测错误信号
 */
export function detectErrorFromUserChallenge(
  userMessage: string,
  config: Partial<SelfCorrectionConfig> = {},
): ErrorSignal | null {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (!cfg.trigger.user_challenge) return null

  const challengePatterns = [
    { pattern: /不对(?!.*是对)/, severity: 'medium' as ErrorSeverity }, // 排除"是对的"这类
    { pattern: /不对吧|好像.*不对|似乎.*错/i, severity: 'medium' as ErrorSeverity },
    { pattern: /不是\s*(这|那)个|不对，是/i, severity: 'high' as ErrorSeverity },
    { pattern: /重写|重新.*来/i, severity: 'high' as ErrorSeverity },
    { pattern: /等等|且慢/i, severity: 'low' as ErrorSeverity },
    { pattern: /等等.*好像.*错/i, severity: 'high' as ErrorSeverity },
  ]

  for (const { pattern, severity } of challengePatterns) {
    if (pattern.test(userMessage)) {
      return {
        trigger: 'user_challenge',
        description: '用户对 AI 的回答提出质疑',
        errorDetails: userMessage,
        severity,
        suggestedFix: '请重新审视上一条回复，确认是否有误',
      }
    }
  }

  return null
}

// ----------------------------------------------------------------------------
// Self-Verification Decision
// ----------------------------------------------------------------------------

/**
 * 判断是否应触发自检验证
 */
export function shouldSelfVerify(
  context: SelfVerificationContext,
  config: Partial<SelfCorrectionConfig> = {},
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (cfg.trigger.self_verification === 'never') return false
  if (cfg.trigger.self_verification === 'always') return true

  // auto 模式：根据高风险任务配置判断
  const { taskType, fileWriteCount, isSecuritySensitive, isBatchOperation } =
    context

  // 安全敏感操作
  if (isSecuritySensitive) return true

  // 批量写入
  if (isBatchOperation) return true

  // 高风险任务类型
  if (taskType && cfg.high_risk_tasks.includes(taskType)) return true

  // 文件写入超过阈值
  if (fileWriteCount !== undefined && fileWriteCount > 3) return true

  return false
}

// ----------------------------------------------------------------------------
// Correction Proposal
// ----------------------------------------------------------------------------

/**
 * 根据错误信号生成修正提议
 */
export function proposeCorrection(
  error: ErrorSignal,
  config: Partial<SelfCorrectionConfig> = {},
): CorrectionProposal {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // 严重错误 → 无需确认（紧急豁免）
  // 用户质疑永远需要确认，因为需要用户判断 AI 哪里说错了
  const requiresConfirmation =
    cfg.confirmation_required && error.severity !== 'critical'

  const autoExecuteDelay = requiresConfirmation ? cfg.auto_execute_delay_seconds : 0

  let fixDescription = error.suggestedFix ?? '修正此错误'

  if (error.originalCode && error.suggestedFix) {
    fixDescription = `${error.description}。建议：${error.suggestedFix}`
  }

  return {
    error,
    fixDescription,
    originalCode: error.originalCode ?? '',
    fixedCode: error.suggestedFix ?? '',
    requiresConfirmation,
    autoExecuteAfterSeconds: autoExecuteDelay,
  }
}

/**
 * 将修正提议转换为用户友好的确认消息
 */
export function expressCorrectionProposal(proposal: CorrectionProposal): string {
  const { error, fixDescription, autoExecuteAfterSeconds } = proposal

  const locationHint = error.location ? `（${error.location}）` : ''
  const confirmHint =
    proposal.requiresConfirmation && autoExecuteAfterSeconds > 0
      ? ` 请确认是否执行。若 ${autoExecuteAfterSeconds}s 内无回应，将自动执行。`
      : ''

  if (error.originalCode && error.suggestedFix) {
    return `疑${locationHint}有误——原：${error.originalCode}，纠：${error.suggestedFix}。${confirmHint}`
  }

  return `${fixDescription}${confirmHint}`
}
