# Companion 情绪系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Companion Sprite 增加情绪系统，六种情绪、帧动画、关键词检测、状态机跳转。

**Architecture:** 新增 `emotions.ts`（情绪类型+状态机+检测器）、`observer.ts`（`fireCompanionObserver`）、`AppState.companionEmotion` 字段；`sprites.ts` 增加每物种每情绪 3 帧；`CompanionSprite.tsx` 读取情绪选帧。

**Tech Stack:** TypeScript, React hooks, regex-based keyword detection, existing ASCII sprite system.

---

## 文件变更总览

| 操作 | 文件 |
|------|------|
| 新建 | `src/buddy/emotions.ts` — 情绪类型、状态机、检测器 |
| 新建 | `src/buddy/observer.ts` — `fireCompanionObserver` 函数 |
| 修改 | `src/state/AppStateStore.ts` — 增加 `companionEmotion` |
| 修改 | `src/buddy/sprites.ts` — 增加 EMOTION_BODIES |
| 修改 | `src/buddy/CompanionSprite.tsx` — 情绪→选帧 |
| 修改 | `src/components/PromptInput/PromptInput.tsx` — 打字速度检测 |
| 修改 | `src/screens/REPL.tsx` — 导入 `fireCompanionObserver` |

---

## Task 1: 情绪类型与状态机

**文件:**
- 创建: `src/buddy/emotions.ts`

- [ ] **Step 1: 写入类型定义与状态机**

```typescript
// src/buddy/emotions.ts

export const EMOTIONS = ['happy', 'proud', 'curious', 'pensive', 'tired', 'snarky'] as const
export type Emotion = (typeof EMOTIONS)[number]

// 状态机相邻跳转表
export const ADJACENT_TRANSITIONS: Record<Emotion, Emotion[]> = {
  happy: ['proud'],
  proud: ['happy', 'curious'],
  curious: ['proud', 'pensive'],
  pensive: ['curious', 'tired', 'snarky'],
  tired: ['pensive'],
  snarky: ['pensive'],
}

// 关键词正则（示例）
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

// 状态机：验证跳转是否合法
export function canTransition(from: Emotion, to: Emotion): boolean {
  return ADJACENT_TRANSITIONS[from]?.includes(to) ?? false
}
```

- [ ] **Step 2: 运行验证**

确认 `npx tsc src/buddy/emotions.ts --noEmit` 无错误。

- [ ] **Step 3: 提交**

```bash
git add src/buddy/emotions.ts
git commit -m "feat(buddy): add emotion types and state machine"
```

---

## Task 2: AppState 增加 companionEmotion

**文件:**
- 修改: `src/state/AppStateStore.ts`（约 line 169 附近，在 `companionReaction` 后）

- [ ] **Step 1: 添加 companionEmotion 字段**

在 `companionReaction?: string` 下方添加:

```typescript
companionEmotion?: import('../buddy/emotions.js').Emotion
```

- [ ] **Step 2: 验证 TypeScript 无错误**

```bash
npx tsc src/state/AppStateStore.ts --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/state/AppStateStore.ts
git commit -m "feat(buddy): add companionEmotion to AppState"
```

---

## Task 3: 实现 fireCompanionObserver

**文件:**
- 创建: `src/buddy/observer.ts`

- [ ] **Step 1: 写入 fireCompanionObserver 函数**

```typescript
// src/buddy/observer.ts
import type { Message } from '../types/message.js'
import { detectEmotionFromText } from './emotions.js'
import { getCompanion } from './companion.js'
import type { Emotion } from './emotions.js'

export type ReactionCallback = (reaction: string | undefined) => void

// 从 AI 回复中提取文本内容
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

  // 生成对应的 quip 文字（复用 companionReaction 气泡）
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
```

- [ ] **Step 2: 验证 TypeScript 无错误**

```bash
npx tsc src/buddy/observer.ts --noEmit
```

- [ ] **Step 3: 提交**

```bash
git add src/buddy/observer.ts
git commit -m "feat(buddy): implement fireCompanionObserver"
```

---

## Task 4: CompanionSprite 读取情绪选帧

**文件:**
- 修改: `src/buddy/CompanionSprite.tsx`（约 line 176 `CompanionSprite` 函数内）
- 修改: `src/buddy/sprites.ts`（增加 EMOTION_BODIES）

- [ ] **Step 1: 在 CompanionSprite 中读取 companionEmotion**

在 `CompanionSprite()` 函数开头（useAppState 调用处）添加:

```typescript
const emotion = useAppState(s => s.companionEmotion)
```

- [ ] **Step 2: 根据 emotion 决定渲染哪组帧**

在 CompanionSprite.tsx 中，当 emotion 存在时，从 `EMOTION_BODIES[species][emotion]` 取帧而非默认 `BODIES[species]`。

> **注意**：EMOTION_BODIES 尚未定义（Task 5 创建），此处先做条件分支：
> - 若 `emotion` 存在且有对应帧 → 渲染情绪帧
> - 否则 → 渲染默认 idle 帧

```typescript
// CompanionSprite.tsx 约 line 242-260（帧选择逻辑处）
const frameCount = spriteFrameCount(companion.species)
let spriteFrame: number
let blink = false

if (emotion && EMOTION_BODIES[bones.species]?.[emotion]) {
  // 情绪帧
  const emotionFrames = EMOTION_BODIES[bones.species][emotion]!
  spriteFrame = tick % emotionFrames.length
} else if (reaction || petting) {
  // 兴奋：快速循环
  spriteFrame = tick % frameCount
} else {
  // 默认 idle
  const step = IDLE_SEQUENCE[tick % IDLE_SEQUENCE.length]!
  if (step === -1) { spriteFrame = 0; blink = true }
  else { spriteFrame = step % frameCount }
}
```

- [ ] **Step 3: 修改 renderSprite 调用以支持情绪帧**

```typescript
// 约 line 258
let body: string[]
if (emotion && EMOTION_BODIES[bones.species]?.[emotion]) {
  const emotionFrames = EMOTION_BODIES[bones.species][emotion]!
  body = emotionFrames[spriteFrame % emotionFrames.length]!.map(line =>
    blink ? line.replaceAll(bones.eye, '-') : line
  )
} else {
  body = renderSprite(companion, spriteFrame).map(line =>
    blink ? line.replaceAll(companion.eye, '-') : line
  )
}
```

- [ ] **Step 4: 验证**

```bash
npx tsc src/buddy/CompanionSprite.tsx --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/buddy/CompanionSprite.tsx
git commit -m "feat(buddy): read companionEmotion and select emotion frames"
```

---

## Task 5: 为所有物种创建情绪帧

**文件:**
- 修改: `src/buddy/sprites.ts`

**重大工程**：20 物种 × 6 情绪 × 3 帧 = 360 个 ASCII 块。

以下为 cat/happy 的示例帧（其余物种请遵循相同模式）：

```typescript
// sprites.ts 末尾添加

type EmotionFrames = Record<Emotion, string[][]>

// cat 开心帧（3帧）
const cat_happy: string[][] = [
  [
    '            ',
    '   /\\  /\\   ',
    '  (=^ω^=)  ',  // 原本 cat 帧0
    '  (  ω  )   ',
    '  (")_(")   ',
  ],
  [
    '            ',
    '   /\\  /\\   ',
    '  (=^ω^=)~ ',  // 摇尾
    '  (  ω  )   ',
    '  (")_(")   ',
  ],
  [
    '            ',
    '   /\\  /\\   ',
    '  (=^ω^=)  ',  // 眨眼
    '  (  -  )   ',
    '  (")_(")   ',
  ],
]

// EMOTION_BODIES 导出（其他物种同法添加）
export const EMOTION_BODIES: Record<Species, EmotionFrames> = {
  [cat]: {
    happy: cat_happy,
    proud: [/* proud 帧 */],
    curious: [/* curious 帧 */],
    pensive: [/* pensive 帧 */],
    tired: [/* tired 帧 */],
    snarky: [/* snarky 帧 */],
  },
  // duck, goose, blob... 其他 19 物种同理
} as const
```

**各情绪帧设计指引：**

| 情绪 | 帧设计方向 |
|------|-----------|
| **happy** | 尾巴摇、耳朵竖、眼神亮 |
| **proud** | 抬头、眯眼、微仰 |
| **curious** | 歪头、一耳竖、一耳低 |
| **pensive** | 半闭眼、静止、略低头 |
| **tired** | 眼缝、耳朵垂、尾巴拖 |
| **snarky** | 眯眼、嘴角翘、尾巴尖翘 |

- [ ] **Step 1: 添加 cat 的 6 种情绪帧**

- [ ] **Step 2: 批量添加其余 19 物种情绪帧**（可并行）

- [ ] **Step 3: 验证 TypeScript 无错误**

```bash
npx tsc src/buddy/sprites.ts --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/buddy/sprites.ts
git commit -m "feat(buddy): add emotion frames for all 20 species"
```

---

## Task 6: REPL.tsx 导入 fireCompanionObserver

**文件:**
- 修改: `src/screens/REPL.tsx`

- [ ] **Step 1: 添加 import**

在 REPL.tsx 顶部 import 区域（约 line 276）添加：

```typescript
import { fireCompanionObserver } from '../buddy/observer.js'
```

- [ ] **Step 2: 验证无构建错误**

```bash
npx tsc src/screens/REPL.tsx --noEmit 2>&1 | head -20
```

- [ ] **Step 3: 提交**

```bash
git add src/screens/REPL.tsx
git commit -m "feat(buddy): hook fireCompanionObserver into REPL query flow"
```

---

## Task 7: 打字速度检测（情绪触发）

**文件:**
- 修改: `src/components/PromptInput/PromptInput.tsx`

- [ ] **Step 1: 添加 useTypingSpeed hook 逻辑**

在 PromptInput.tsx 的 `onChange` 处理处（用户每次按键时）记录 `timestamp` 与 `charCount`，计算滚动平均速度。

示例（在 onChange 内）：

```typescript
const typingRef = useRef({ lastTime: Date.now(), chars: 0, speed: 0 })
// onChange 内:
const now = Date.now()
const dt = now - typingRef.current.lastTime
const dchars = input.length - typingRef.current.chars
if (dt > 0) {
  typingRef.current.speed = (dchars / dt) * 1000 // chars/sec
}
typingRef.current.lastTime = now
typingRef.current.chars = input.length

// speed > 5 → curious, speed < 1 → pensive
if (typingRef.current.speed > 5) {
  setAppState(prev => ({ ...prev, companionEmotion: 'curious' }))
} else if (typingRef.current.speed < 1 && input.length > 20) {
  setAppState(prev => ({ ...prev, companionEmotion: 'pensive' }))
}
```

- [ ] **Step 2: 验证无错误**

```bash
npx tsc src/components/PromptInput/PromptInput.tsx --noEmit 2>&1 | head -20
```

- [ ] **Step 3: 提交**

```bash
git add src/components/PromptInput/PromptInput.tsx
git commit -m "feat(buddy): detect typing speed for emotion triggers"
```

---

## Task 8: 集成测试

- [ ] **Step 1: 启动应用**

```bash
cd /home/liuxue/2号员工/Super-Claude-Code
bun run ./bin/super-claude-code
```

- [ ] **Step 2: 验证 Companion 显示正常**

- [ ] **Step 3: 测试情绪触发** — 说"大善！"，观察是否出现开心帧
- [ ] **Step 4: 测试状态机** — 确保情绪只能相邻跳转

---

## 实施顺序

1. Task 1（emotions.ts）→ Task 2（AppState）→ Task 3（observer.ts）→ Task 4（CompanionSprite 读取情绪）→ Task 5（帧资源）→ Task 6（REPL hook）→ Task 7（打字检测）→ Task 8（测试）
