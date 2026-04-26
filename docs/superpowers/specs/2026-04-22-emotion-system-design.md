# Companion 情绪系统设计

## 概述

为 Companion Sprite 增加情绪系统，使其能随 AI 回复、用户输入、系统状态动态变化表情与动画。

## 情绪定义

六种情绪，状态机仅允许相邻跳转：

```
开心 ←→ 得意 ←→ 好奇 ←→ 沉思 ←→ 累了
                  ↑
               吐槽（吐槽可打断沉思，从沉思跳转）
```

| 情绪 | 描述 | 相邻情绪 |
|------|------|---------|
| **开心** | 积极正向 | 得意 |
| **得意** | 略得意/满足 | 开心、好奇 |
| **好奇** | 有疑问/感兴趣 | 得意、沉思 |
| **沉思** | 分析/沉默 | 好奇、累了、吐槽 |
| **累了** | 疲惫/等待中 | 沉思 |
| **吐槽** | 嘲讽/傲娇 | 沉思 |

## 情绪帧动画

每个情绪物种有独立帧组（3 帧），存储于 `sprites.ts` 的 `EMOTION_BODIES`。

示例（cat/开心）:
```
[开心帧0]  [开心帧1]  [开心帧2]
 /\ /\    /\ /\    /\ /\
(=^ω^=)  (=^ω^=)~ (=^-ω-=)
```

各情绪帧由美术预设，非程序生成。

## 情绪检测规则

### AI 回复触发（关键词正则）

| 情绪 | 触发词（示例） |
|------|--------------|
| 开心 | 大善、妙哉、太棒了、完美、搞定、✅ |
| 得意 | 吾已尽知、汝当如是、不过尔尔、已知之 |
| 好奇 | 有趣、何解、且慢、如何是好、？ |
| 沉思 | （长回复 > 200 字，且无明显情感词）|
| 累了 | （静默 > 30s，或 AI 思考中）|
| 吐槽 | 此乃小患、小恙、何足挂齿、问题不大 |

### 用户输入触发

- 打字速度快（> 5 字符/秒）→ 好奇
- 打字速度慢（< 1 字符/秒）→ 平静
- 长时间无输入 → 累了

### 系统状态触发

- 工具执行中 → 好奇
- 错误/警告 → 吐槽
- 长时间无响应 → 累了

## 状态转移规则

- 状态机：仅允许**相邻情绪**跳转
- 吐槽例外：可从沉思跳转，打断分析状态
- 每 500ms 检查一次是否满足跳转条件
- 新情绪持续至少 3 秒后才会再次跳转

## 数据流

```
AI 回复 → EmotionDetector.analyze() → emotion state
用户输入 → TypingPatternDetector → emotion state
系统事件 → SystemStateMonitor → emotion state
         ↓
    EmotionStateMachine.validate() → 合法跳转
         ↓
    AppState.companionEmotion 更新
         ↓
    CompanionSprite 读取 emotion → 渲染对应帧
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/buddy/emotions.ts` | **新增** — 情绪状态机、检测规则 |
| `src/buddy/sprites.ts` | 增加 EMOTION_BODIES per species per emotion |
| `src/state/AppState.ts` | 增加 companionEmotion 字段 |
| `src/buddy/CompanionSprite.tsx` | 读取 emotion → 选帧 |
| `src/bridge/inboundMessages.ts` | AI 回复时触发 EmotionDetector |

## 情绪检测器接口

```typescript
interface EmotionDetector {
  analyzeAIReply(text: string): Emotion | null
  analyzeTypingPattern(charsPerSecond: number): Emotion | null
  analyzeSystemEvent(event: SystemEvent): Emotion | null
}

interface EmotionStateMachine {
  current(): Emotion
  tryTransition(newEmotion: Emotion): boolean // 相邻则转移
}
```
