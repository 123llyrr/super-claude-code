# Agent 元认知系统设计

## 概述

为 Super-Claude-Code 引入元认知能力：自我检测错误、确认后修正、从过往行为中学习并优化策略。

## 目标

1. **解决幻觉问题** — AI 不知道时明确说"不知道"，而非 hallucinate
2. **建立自我修正机制** — 发现错误后主动提出修正，经用户确认后执行
3. **实现自优化能力** — 从错误模式中学习，动态调整推理策略

---

## 一、幻觉防护（Knows-what-it-doesn't-know）

### 触发条件

当 AI 满足以下任一条件时，应主动声明不确定性：

- 被要求回答超出 CLAUDE.md 明确范围的问题
- 涉及汝未提供上下文的外部系统（如："这个 API 是什么"）
- 汝明确要求其不知道时停止，而非编造
- 置信度低于阈值（模型隐式判断）

### 行为模式

**场景 A：汝主动问 AI 不知道的事**
```
汝：某个第三方服务是什么？
AI：吾不知此服务。汝可告吾其名称或提供文档，吾当为汝察之。
```

**场景 B：AI 尝试回答但不确定**
```
汝：帮我优化这个算法
AI：此算法吾初看以为 O(n²)，然细察后发现亦可能为 O(n log n)。为免误导汝，吾先跑个测试确认复杂度，可好？
```

**场景 C：汝要求 AI 主动拒绝**
（汝在 CLAUDE.md 中配置 `metacognition: uncertain: refuse`）
```
AI：[沉默，或回复] 此事吾无足够上下文，不敢妄言。请汝提供更多信息。
```

---

## 二、自我修正机制（Self-Correction）

### 修正行为模式

**主模式：确认修正（Option C）**

```
AI 发现错误 → 告知汝 → 等待确认 → 执行修正 → 报告结果
```

**说明层级：简洁（Option B）**

```
AI：疑第三行有误——原：x = y + 1，纠：正确应为 x = y - 1。可否修正？
汝：可
AI：[执行修正] 已修正。
```

### 触发分层机制

| 层级 | 机制 | 触发条件 | 成本 |
|------|------|---------|------|
| **L1 系统信号** | 工具失败、lint 报错、权限拒绝 | 外部错误码 | 极低 |
| **L2 自检验证 | 任务后主动跑测试/比对文件 | 高风险任务配置 | 中等 |
| **L3 用户质疑 |汝说"不对" |汝触发 | 零 |

#### L1 系统信号触发
```
场景：工具执行返回错误
AI：[检测到错误] 此操作失败，原因是文件权限不足。吾将尝试以只读模式重查原文件，可好？
```

#### L2 自检验证触发
配置化，非硬编码：
```
当满足任一：
- 任务涉及文件写入 > 3 处
- 任务类型为 /pr, /commit, /review
- 任务涉及安全/权限操作
→ 自动触发 L2 自检验证
```

### 紧急豁免

若 AI 判断为"可能导致数据丢失/安全风险"之错误：
→ 静默修正 + 结果告知（不等待确认，但事后报告）

```
AI：[检测到紧急危险操作] 此删除操作将移除 .git 目录，吾已自动中止并恢复。
```

### 响应时限

汝沉默 > 10 秒 → 视为默认同意，自动执行

---

## 三、自优化能力（Self-Optimization）

### 错误模式识别

当同一类错误出现 ≥ 3 次时，AI 应能识别并提出策略调整：

```
汝：[第3次] 同样类型的 SQL 注入漏洞
AI：[识别到模式] 汝第三次遇到此类问题。吾建议在 CLAUDE.md 中加入：
  "所有用户输入须经严格校验后方可拼接 SQL。"
  汝可愿吾将此加入项目规范？
```

### 策略切换

汝可配置任务类型对应的推理策略：

```javascript
// CLAUDE.md 示例
metacognition: {
  strategy: {
    quick: "简单查询、文件操作，少量思考",
    standard: "常规开发任务",
    deep: "复杂 bug、架构决策，先分析再执行",
    // AI 自动判断场景并选择
  }
}
```

### 学习闭环

- **会话级**：汝对 AI 修正之认可/否定 → 影响同 session 后续行为
- **项目级**：汝接受之建议 → 存入项目 CLAUDE.md → 后续会话继承
- **全局级**：汝接受之建议 → 存入 ~/.claude/memory → 所有项目受益

---

## 四、实现接口

### 核心接口

```typescript
interface MetacognitionModule {
  // 1. 幻觉防护
  checkUncertainty(context: UserPrompt): UncertainSignal | null
  expressUncertainty(signal: UncertainSignal): string

  // 2. 自我修正
  detectError(outcome: TaskOutcome): ErrorSignal | null
  proposeCorrection(error: ErrorSignal): CorrectionProposal
  executeCorrection(proposal: CorrectionProposal): Promise<void>

  // 3. 自优化
  recognizePattern(errors: ErrorSignal[]): PatternInsight | null
  proposeStrategyAdjustment(insight: PatternInsight): StrategyProposal
}
```

### 关键类型

```typescript
type UncertaintyType = 'out_of_context' | 'low_confidence' | 'refused'

interface UncertainSignal {
  type: UncertaintyType
  originalPrompt: string
  reason: string
  suggestedAlternative?: string
}

type CorrectionTrigger = 'system_signal' | 'self_verification' | 'user_challenge'

interface ErrorSignal {
  trigger: CorrectionTrigger
  location?: string      // 文件:行号
  description: string
  originalCode?: string
  suggestedFix?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface CorrectionProposal {
  error: ErrorSignal
  fixDescription: string
  originalCode: string
  fixedCode: string
  requiresConfirmation: boolean  // critical=true 时为 false
  autoExecuteAfterSeconds: number  // 10
}
```

---

## 五、文件变更

| 文件 | 变更 |
|------|------|
| `src/metacognition/` | **新增目录** |
| `src/metacognition/index.ts` | 导出主模块 |
| `src/metacognition/uncertainty.ts` | 幻觉防护：检测与表达不确定性 |
| `src/metacognition/self-correction.ts` | 自我修正：检测、提议、执行修正 |
| `src/metacognition/self-optimization.ts` | 自优化：模式识别、策略调整、学习闭环 |
| `src/metacognition/types.ts` | 核心类型定义 |
| `src/query.ts` | 集成 metacognition 模块 |
| `src/bridge/inboundMessages.ts` | AI 回复时触发 metacognition 检查 |

---

## 六、CLAUDE.md 配置项

```yaml
# 元认知配置
metacognition:
  # 幻觉防护
  uncertain:
    behavior: refuse | express | silent  # 不知道时的行为
    threshold: 0.3                        # 置信度阈值

  # 自我修正
  self_correction:
    trigger:
      system_signal: true
      self_verification: auto  # auto | always | never
      user_challenge: true
    confirmation_required: true
    auto_execute_delay_seconds: 10
    high_risk_tasks:
      - pr
      - commit
      - batch_write (>3 files)

  # 自优化
  self_optimization:
    pattern_threshold: 3  # 同一错误出现 N 次后提出建议
    learn_from: [session, project, global]
```

---

## 七、设计原则

1. **透明优先** — 用户应始终知道 AI 在想什么、怀疑什么、将要改什么
2. **确认而非静默** — 高风险操作必须确认，紧急情况才豁免
3. **可配置性** — 汝可通过 CLAUDE.md 控制行为层级
4. **学习闭环** — 从错误中学习，知识跨会话持久化
5. **成本意识** — 自检验证仅在高风险场景触发，非每次任务
