# Linux Computer Use 完美实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集成 open-codex runtime 作为 Primary，保留现有 Linux 输入层作 Fallback，实现完美的 Linux Computer Use

**Architecture:** 
- 新建 `openCodexRuntime.ts` 封装 open-codex binary subprocess 调用
- 新建 `executorFactory.ts` 实现 primary/fallback 检测与选择
- 修改 `hostAdapter.ts` 使用新的 factory
- 保留 `linuxInputLoader.ts` 和 `executor.ts` 中的 `createLinuxExecutor` 作为 fallback

**Tech Stack:** TypeScript, subprocess IPC, AT-SPI2 (via open-codex), xdotool/ydotool (fallback)

---

## 文件结构

```
src/utils/computerUse/
├── openCodexRuntime.ts     # NEW: 封装 open-codex binary subprocess
├── executorFactory.ts      # NEW: primary/fallback 检测与选择
├── hostAdapter.ts          # MODIFY: 使用新 factory
├── executor.ts             # MODIFY: 导出 Linux executor 给 factory 用
├── mcpServer.ts           # NO CHANGE (复用)
└── linuxInputLoader.ts    # KEEP: fallback 输入层
```

---

## Task 1: 创建 openCodexRuntime.ts

**Files:**
- Create: `src/utils/computerUse/openCodexRuntime.ts`

- [ ] **Step 1: 创建文件骨架**

```typescript
import { execFileNoThrow } from '../execFileNoThrow.js'
import { logForDebugging } from '../debug.js'

export interface OpenCodexSnapshot {
  app: { name: string; bundleIdentifier: string; pid: number }
  windowTitle: string
  windowBounds: { x: number; y: number; width: number; height: number }
  screenshotPngBase64?: string
  treeLines: string[]
  elements: OpenCodexElement[]
}

export interface OpenCodexElement {
  index: number
  runtimeId?: number[]
  automationId?: string
  name?: string
  controlType?: string
  value?: string
  frame?: { x: number; y: number; width: number; height: number }
  actions?: string[]
}

export class OpenCodexRuntime {
  private binaryPath: string | null = null
  private available = false

  async checkAvailability(): Promise<boolean> {
    // 1. 检查 open-computer-use binary
    // 2. 调用 doctor 检测
    // 3. 设置 this.available
  }

  async listApps(): Promise<string> {
    // 调用 open-computer-use call list_apps
  }

  async getAppState(app: string): Promise<OpenCodexSnapshot> {
    // 调用 open-computer-use call get_app_state
  }

  async click(app: string, element?: OpenCodexElement, x?: number, y?: number): Promise<void> {
    // 调用 open-computer-use call click
  }

  // ... 其他工具方法
}
```

- [ ] **Step 2: 实现 checkAvailability**

```typescript
async checkAvailability(): Promise<boolean> {
  // 检查 binary 是否存在
  const { code: whichCode } = await execFileNoThrow('which', ['open-computer-use'], { useCwd: false })
  if (whichCode !== 0) {
    logForDebugging('[open-codex] open-computer-use not found in PATH')
    this.available = false
    return false
  }

  // 调用 doctor 检测
  const { stdout, code } = await execFileNoThrow('open-computer-use', ['doctor'], { useCwd: false })
  if (code !== 0) {
    logForDebugging('[open-codex] doctor failed:', stdout)
    this.available = false
    return false
  }

  this.available = true
  logForDebugging('[open-codex] available')
  return true
}
```

- [ ] **Step 3: 实现 callTool 通用方法**

```typescript
private async callTool(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { stdout, code } = await execFileNoThrow(
    'open-computer-use', 
    ['call', tool, '--args', JSON.stringify(args)],
    { useCwd: false }
  )
  if (code !== 0) {
    throw new Error(`open-computer-use call ${tool} failed: ${stdout}`)
  }
  return JSON.parse(stdout)
}
```

- [ ] **Step 4: 实现 listApps / getAppState / click**

```typescript
async listApps(): Promise<string> {
  const result = await this.callTool('list_apps') as { text: string }
  return result.text
}

async getAppState(app: string): Promise<OpenCodexSnapshot> {
  const result = await this.callTool('get_app_state', { app }) as { snapshot: OpenCodexSnapshot }
  return result.snapshot
}

async click(app: string, element?: OpenCodexElement, x?: number, y?: number): Promise<void> {
  const args: Record<string, unknown> = { app }
  if (element) args.element = element
  if (x !== undefined) args.x = x
  if (y !== undefined) args.y = y
  await this.callTool('click', args)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/computerUse/openCodexRuntime.ts
git commit -m "feat(computer-use): add OpenCodexRuntime class"
```

---

## Task 2: 创建 executorFactory.ts

**Files:**
- Create: `src/utils/computerUse/executorFactory.ts`

- [ ] **Step 1: 创建 executor adapter 接口**

```typescript
import type { ComputerExecutor } from '../../../deps/@ant/computer-use-mcp/src/types.js'
import { OpenCodexRuntime } from './openCodexRuntime.js'
import { createLinuxExecutor } from './executor.js'
import { logForDebugging } from '../debug.js'

export interface ExecutorAdapter {
  executor: ComputerExecutor
  isPrimary: boolean
  runtimeName: 'open-codex' | 'linux-input'
}
```

- [ ] **Step 2: 创建 factory 函数**

```typescript
let cachedAdapter: ExecutorAdapter | null = null

export async function createExecutorAdapter(): Promise<ExecutorAdapter> {
  if (cachedAdapter) return cachedAdapter

  const openCodex = new OpenCodexRuntime()
  const isAvailable = await openCodex.checkAvailability()

  if (isAvailable) {
    logForDebugging('[executor-factory] Using open-codex runtime (primary)')
    cachedAdapter = {
      executor: createOpenCodexExecutor(openCodex),
      isPrimary: true,
      runtimeName: 'open-codex',
    }
  } else {
    logForDebugging('[executor-factory] open-codex unavailable, using linux-input (fallback)')
    cachedAdapter = {
      executor: createLinuxExecutor({
        getMouseAnimationEnabled: () => true,
        getHideBeforeActionEnabled: () => false,
      }),
      isPrimary: false,
      runtimeName: 'linux-input',
    }
  }

  return cachedAdapter
}
```

- [ ] **Step 3: 实现 createOpenCodexExecutor 包装**

```typescript
function createOpenCodexExecutor(openCodex: OpenCodexRuntime): ComputerExecutor {
  return {
    capabilities: {
      screenshotFiltering: 'native' as const,
      platform: 'linux' as const,
    },

    async getAppState(app: string) {
      const snapshot = await openCodex.getAppState(app)
      return {
        app: {
          bundleId: snapshot.app.bundleIdentifier,
          name: snapshot.app.name,
          pid: snapshot.app.pid,
        },
        windowTitle: snapshot.windowTitle,
        windowBounds: snapshot.windowBounds,
        screenshot: snapshot.screenshotPngBase64
          ? { base64: snapshot.screenshotPngBase64, width: snapshot.windowBounds.width, height: snapshot.windowBounds.height }
          : undefined,
        tree: snapshot.elements.map(el => ({
          index: el.index,
          bundleId: el.automationId || el.name || '',
          text: el.name || el.value || '',
          role: el.controlType || '',
          rect: el.frame,
        })),
      }
    },

    async listInstalledApps() { /* ... */ },
    async listRunningApps() { /* ... */ },
    async getFrontmostApp() { /* ... */ },
    async click(x, y, button, count) { /* ... */ },
    async moveMouse(x, y) { /* ... */ },
    async type(text, opts) { /* ... */ },
    // ... 其他方法
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/computerUse/executorFactory.ts
git commit -m "feat(computer-use): add executorFactory with primary/fallback selection"
```

---

## Task 3: 修改 hostAdapter.ts

**Files:**
- Modify: `src/utils/computerUse/hostAdapter.ts:55-108` (getComputerUseHostAdapter function)

- [ ] **Step 1: 修改 getComputerUseHostAdapter 使用 factory**

```typescript
export function getComputerUseHostAdapter(): ComputerUseHostAdapter {
  if (cached) return cached

  const isLinux = process.platform === 'linux'

  // Linux: 使用 factory 创建 adapter
  if (isLinux) {
    // Factory 是异步的，但 adapter 需要同步返回
    // 使用 cached 模式，首次调用时同步返回临时 executor，后续替换
    const executor = createLinuxExecutor({
      getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
      getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
    })

    cached = {
      serverName: COMPUTER_USE_MCP_SERVER_NAME,
      logger: new DebugLogger(),
      executor,
      // ... 其余不变
    }

    // 后台检测 open-codex 并替换
    createExecutorAdapter().then(adapter => {
      if (adapter.isPrimary) {
        cached!.executor = adapter.executor
        logForDebugging('[host-adapter] Switched to open-codex executor')
      }
    }).catch(() => {})

    return cached
  }

  // macOS: 使用原有逻辑
  cached = {
    // ... 原有的 macOS 逻辑
  }
  return cached
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/computerUse/hostAdapter.ts
git commit -m "feat(computer-use): integrate executorFactory in hostAdapter"
```

---

## Task 4: 测试与验证

**Files:**
- Modify: `src/utils/computerUse/executorFactory.ts` (添加测试桩)

- [ ] **Step 1: 验证 open-computer-use 可用性检测**

```bash
# 在 Linux 上运行
which open-computer-use && open-computer-use doctor
```

- [ ] **Step 2: 测试 list_apps**

```bash
open-computer-use call list_apps
```

- [ ] **Step 3: 测试 get_app_state**

```bash
open-computer-use call get_app_state --args '{"app":"firefox"}'
```

- [ ] **Step 4: 测试 fallback 降级**

模拟 open-codex 不可用时，确保 linux-input executor 正常工作

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(computer-use): verify open-codex integration"
```

---

## 验证清单

- [ ] `open-computer-use doctor` 返回成功
- [ ] `open-computer-use call list_apps` 返回应用列表
- [ ] `open-computer-use call get_app_state --args '{"app":"firefox"}'` 返回 snapshot
- [ ] 降级到 linux-input 时日志有提示
- [ ] 现有 Computer Use 功能（screenshot/move/click/type）在两种 runtime 下皆可用
