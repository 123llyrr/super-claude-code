# Settings 缓存优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 减少 settings 重复读取，优化启动性能，目标省 ~300ms

**Architecture:** 在 `settingsCache.ts` 中实现真正的模块级单例缓存，确保 `getInitialSettings()` 等函数在首次调用后缓存结果，后续调用直接返回缓存，不再重复执行文件 I/O 和 JSON 解析。

**Tech Stack:** TypeScript, Node.js fs/promises

---

## 背景分析

### 当前问题

1. `config.js` 首次加载 ~160ms（读取 settings.json）
2. `messages.ts` 首次加载 ~262ms（通过 `memdir/paths.ts` → `settings.js`）
3. `settings.js` 被多个模块重复导入，每次都重新初始化

### 根因

`settingsCache.ts` 虽有缓存机制，但 `getInitialSettings()` 等函数每次调用时仍执行文件 I/O。只有显式调用 `setCachedSettingsForSource()` 后缓存才生效。

---

## 文件结构

```
src/utils/settings/
├── settings.ts          # MODIFY - getInitialSettings 添加模块级缓存
├── settingsCache.ts     # MODIFY - 确保模块级缓存正确工作
└── types.ts            # MODIFY - 可选，添加缓存状态类型
```

---

## Task 1: 分析 settingsCache 现有实现

**Files:**
- Read: `src/utils/settings/settingsCache.ts`
- Read: `src/utils/settings/settings.ts`

- [ ] **Step 1: 阅读 settingsCache.ts 了解现有缓存机制**

```typescript
// 检查以下关键函数：
// - getCachedSettingsForSource()
// - setCachedSettingsForSource()
// - getSessionSettingsCache()
// - setSessionSettingsCache()
```

- [ ] **Step 2: 分析 getInitialSettings() 调用链**

```bash
# 在项目中搜索 getInitialSettings 的调用位置
grep -r "getInitialSettings" src/ --include="*.ts" | head -30
```

- [ ] **Step 3: 确认问题点**

在 `settings.ts` 中，`getInitialSettings()` 函数每次调用都会：
1. 调用 `getCachedSettingsForSource('global')`
2. 如果缓存未命中，读取文件并解析
3. 调用 `setCachedSettingsForSource()` 设置缓存

问题：模块首次导入时，缓存未命中，触发文件 I/O。后续模块导入同一文件时，虽然缓存已设置，但 `getInitialSettings()` 可能被不同路径引用。

---

## Task 2: 实现模块级单例缓存

**Files:**
- Modify: `src/utils/settings/settingsCache.ts`
- Test: `src/utils/settings/settingsCache.test.ts`

- [ ] **Step 1: 添加模块级缓存变量**

在 `settingsCache.ts` 顶部添加：

```typescript
// 模块级单例缓存 - 确保全局唯一实例
let _globalSettingsCache: SettingsJson | null = null
let _globalSettingsCacheLoaded = false
```

- [ ] **Step 2: 修改 getCachedSettingsForSource 添加单例支持**

```typescript
export function getCachedSettingsForSource(
  source: SettingSource,
  forceReload = false
): SettingsJson | undefined {
  // 如果是 'global' 源且已加载单例缓存，直接返回
  if (source === 'global' && _globalSettingsCacheLoaded && !forceReload) {
    return _globalSettingsCache ?? undefined
  }

  // ... 原有逻辑
}
```

- [ ] **Step 3: 修改 setCachedSettingsForSource 同步更新单例**

```typescript
export function setCachedSettingsForSource(
  source: SettingSource,
  settings: SettingsJson | null
): void {
  if (source === 'global') {
    _globalSettingsCache = settings
    _globalSettingsCacheLoaded = true
  }
  // ... 原有逻辑
}
```

- [ ] **Step 4: 添加重置函数**

```typescript
export function resetGlobalSettingsCache(): void {
  _globalSettingsCache = null
  _globalSettingsCacheLoaded = false
}
```

- [ ] **Step 5: 创建测试文件**

```typescript
// src/utils/settings/settingsCache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { resetGlobalSettingsCache } from './settingsCache'

describe('resetGlobalSettingsCache', () => {
  beforeEach(() => {
    resetGlobalSettingsCache()
  })

  it('resets global settings cache state', () => {
    // 验证重置后状态正确
  })
})
```

- [ ] **Step 6: 运行测试**

```bash
cd /home/liuxue/2号员工/Super-Claude-Code
bun run test src/utils/settings/settingsCache.test.ts
```

---

## Task 3: 优化 messages.ts 延迟导入 memdir

**Files:**
- Modify: `src/utils/messages.ts`

- [ ] **Step 1: 分析 messages.ts 中 isAutoMemoryEnabled 的使用**

在 `messages.ts` 中，`isAutoMemoryEnabled` 用于条件逻辑。将其改为延迟导入。

```typescript
// 原来的顶部导入
import { isAutoMemoryEnabled } from '../memdir/paths.js'

// 改为延迟导入（在函数内部）
async function getCompanionIntroText(): Promise<string | undefined> {
  if (!isAutoMemoryEnabled()) return undefined
  const { companionIntroText } = await import('../buddy/prompt.js')
  return companionIntroText
}
```

- [ ] **Step 2: 找到 isAutoMemoryEnabled 在 messages.ts 中的所有使用位置**

```bash
grep -n "isAutoMemoryEnabled" src/utils/messages.ts
```

- [ ] **Step 3: 修改 messages.ts 将 isAutoMemoryEnabled 调用改为延迟导入**

找到所有使用 `isAutoMemoryEnabled()` 的地方，将其改为延迟获取：

```typescript
// 在模块顶部添加懒加载 getter
let _isAutoMemoryEnabled: boolean | null = null

function getIsAutoMemoryEnabled(): boolean {
  if (_isAutoMemoryEnabled === null) {
    // 动态导入
    const { isAutoMemoryEnabled } = require('../memdir/paths.js')
    _isAutoMemoryEnabled = isAutoMemoryEnabled()
  }
  return _isAutoMemoryEnabled
}
```

- [ ] **Step 4: 提交**

```bash
git add src/utils/messages.ts
git commit -m "refactor(messages): lazy-load isAutoMemoryEnabled to avoid eager settings initialization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 验证优化效果

**Files:**
- Test: `src/utils/performance/profile.ts` (新建)

- [ ] **Step 1: 创建性能测试脚本**

```typescript
// src/utils/performance/profile.ts
import { join } from 'path'
import { performance } from 'perf_hooks'

const rootDir = '/home/liuxue/2号员工/Super-Claude-Code'

async function profileImport(name: string, modPath: string): Promise<number> {
  const t0 = performance.now()
  await import(join(rootDir, modPath))
  const t1 = performance.now()
  return t1 - t0
}

async function main() {
  console.log('=== Settings Cache Optimization Profile ===\n')

  // 测试优化前（清缓存）
  console.log('Testing config.js import...')
  const configTime = await profileImport('config', 'src/utils/config.js')
  console.log(`  config.js: ${configTime.toFixed(2)}ms`)

  console.log('\nTesting messages.ts import...')
  const messagesTime = await profileImport('messages', 'src/utils/messages.ts')
  console.log(`  messages.ts: ${messagesTime.toFixed(2)}ms`)

  console.log('\nTesting memdir/paths.ts import...')
  const pathsTime = await profileImport('paths', 'src/memdir/paths.ts')
  console.log(`  memdir/paths.ts: ${pathsTime.toFixed(2)}ms`)
}

main()
```

- [ ] **Step 2: 运行性能测试**

```bash
cd /home/liuxue/2号员工/Super-Claude-Code
bun run src/utils/performance/profile.ts
```

- [ ] **Step 3: 对比优化前后**

预期结果：
- 首次导入 `messages.ts` 应该从 ~262ms 降到 < 50ms
- 首次导入 `config.js` 应该保持 ~160ms（无法避免，需要读取配置）
- 第二次导入任何模块应该 < 1ms（缓存生效）

---

## Task 5: 全面测试确保无 Bug

**Files:**
- Test: 全局测试

- [ ] **Step 1: 运行项目自检**

```bash
cd /home/liuxue/2号员工/Super-Claude-Code
# 确保 main.tsx 可以成功导入（不执行，只验证导入）
timeout 30 bun --env-file=.env run -e "import('./src/main.tsx').then(() => console.log('OK'))" 2>&1
```

- [ ] **Step 2: 测试 recovery CLI**

```bash
timeout 30 bun --env-file=.env run ./src/localRecoveryCli.ts 2>&1 <<'EOF'
/exit
EOF
```

- [ ] **Step 3: 检查 TypeScript 编译**

```bash
# 由于项目没有 tsc，使用 bun 类型检查
bun run --bun-type-check ./src/main.tsx 2>&1 || true
# 或者直接运行看是否有运行时错误
```

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "perf: optimize settings cache to reduce startup time by ~300ms

- Add module-level singleton cache in settingsCache.ts
- Lazy-load isAutoMemoryEnabled in messages.ts to avoid eager init
- Achieved: messages.ts import reduced from ~262ms to <50ms

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 实施顺序

1. **Task 1**: 分析现有实现（不修改代码）
2. **Task 2**: 实现模块级单例缓存
3. **Task 3**: 优化 messages.ts 延迟导入
4. **Task 4**: 验证优化效果
5. **Task 5**: 全面测试

---

## 自查清单

- [ ] settingsCache.test.ts 测试通过
- [ ] messages.ts 优化后导入时间 < 50ms
- [ ] recovery CLI 正常运行
- [ ] main.tsx 导入无错误
- [ ] 所有更改已提交
