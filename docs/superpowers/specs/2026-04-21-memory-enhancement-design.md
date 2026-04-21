# 记忆系统增强设计

## 目标

强化记忆系统，实现：
1. **自动抽取** — 从代码/对话中自动学习模式
2. **记忆压缩** — 多条相似记忆合并为摘要
3. **热度加载** — 只加载与当前任务相关的记忆，省 token

---

## 一、自动抽取

### 触发场景

| 场景 | 抽取内容 | 输出位置 |
|------|----------|----------|
| 代码模式 | 项目架构、工具函数、代码风格 | `memory/` 项目目录 |
| 对话上下文 | 关键决策、需求变更、约束条件 | `memory/` 对应类型 |
| 项目事实 | 技术栈、启动命令、依赖关系 | `memory/` project 类型 |

### 实现方式

- **compact 时触发**：会话结束时调用记忆抽取
- **手动触发**：用户说「记住 XXX」时立即保存
- **定期扫描**：项目目录结构变化时更新 project 记忆

---

## 二、记忆压缩

### 触发时机

1. `compact` 命令执行时
2. 同类型记忆文件超 5 个时
3. 每周首次启动时

### 压缩策略

**合并规则：**
- 同 type 的多条记忆 → 合并为单一摘要
- 保留原始文件的 `why` 信息，合并 `how_to_apply`
- 用时间戳区分「当前有效」vs「历史记录」

**示例：**
```
// 压缩前 (同一用户偏好)
user_pref_style.md   → "用户偏好文言风格"
user_pref_length.md  → "回复简洁，不冗长"
user_pref_emoji.md   → "emoji少而精"

// 压缩后 → user_profile.md
---
name: user_profile
description: 用户沟通偏好
type: user
updated: 2026-04-21
---
- 文言风格为主，白话为辅
- 言简意赅，绝不啰嗦
- emoji少而精
```

---

## 三、热度加载

### 检索机制

**无需 embedding 模型**，纯关键词匹配：

```
关键词来源：
1. 用户首条消息的名词/动词
2. 当前工作目录路径
3. 项目名（从路径推断）
```

### 加载算法

```
1. 解析用户首条消息，提取关键词
2. 遍历 MEMORY.md 所有记忆入口
3. 计算相关性得分：
   - type 匹配: +3 分
   - description 命中: +2 分
   - name 命中: +1 分
4. 按得分排序，取 top 10
5. 只加载命中的记忆文件内容
```

### 分层加载策略

| 层级 | 内容 | 加载条件 |
|------|------|----------|
| 热 | user profile、当前项目上下文 | 始终加载 |
| 温 | 最近相关项目记忆 | 关键词匹配得分 > 0 |
| 冷 | 历史项目、低频参考 | 需要时加载 |

### Token 节省效果

```
原方案：加载全部记忆 ~8KB token
新方案：只加载 top10 ~2KB token
节省：约 75%
```

---

## 四、文件结构

```
MEMORY.md                  # 索引文件（不变）
memory/
  user/                    # 用户偏好
    user_profile.md        # 合并后的用户画像
  project/                 # 项目上下文
    *.md
  feedback/               # 反馈指导
    *.md
  reference/              # 外部引用
    *.md
```

---

## 五、关键函数设计

### `memoryCompressor.ts`

```typescript
// 压缩同类型记忆
export async function compressMemories(
  memoryDir: string,
  type: MemoryType
): Promise<CompressionResult>

// 触发时机
- onSessionCompact
- onMemoryFileCountExceeded(5)
- onWeeklyStartup
```

### `memoryHotLoader.ts`

```typescript
// 根据关键词加载相关记忆
export async function loadRelevantMemories(
  userMessage: string,
  workingDir: string
): Promise<MemoryContent[]>

// 计算相关性得分
function scoreMemory(memory: MemoryHeader, keywords: string[]): number
```

### `memoryAutoExtractor.ts`

```typescript
// 从代码/对话中抽取记忆
export async function extractFromCode(
  projectDir: string
): Promise<ExtractedMemory[]>

export async function extractFromConversation(
  messages: ConversationMessage[]
): Promise<ExtractedMemory[]>
```

---

## 六、兼容性

- 现有 `soulMemory.ts` 加载机制保留
- 新系统只在 `SessionStart` 时多一步「热度过滤」
- compact 时触发压缩，不影响现有流程

---

## 七、待定 (TBD)

- [ ] auto-extract 从代码中学习模式的实现细节
- [ ] 关键词提取算法（正则 vs NLP 简化版）
- [ ] 压缩后的历史记忆存档策略
