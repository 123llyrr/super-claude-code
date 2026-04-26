/**
 * ExecutorFactory: Creates a ComputerExecutor with primary (open-codex) and
 * fallback (linux-input) runtime selection.
 *
 * Primary: OpenCodexRuntime — AT-SPI2 semantic operations via open-computer-use binary
 * Fallback: LinuxInputRuntime — xdotool/Hyprland coordinate-level operations
 */

import type { ComputerExecutor } from '../../../deps/@ant/computer-use-mcp/src/types.js'

import { logForDebugging } from '../debug.js'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExecutorAdapter {
  executor: ComputerExecutor
  isPrimary: boolean
  runtimeName: 'open-codex' | 'linux-input'
}

/**
 * Shape returned by open-codex's get_app_state tool.
 * Mapped to ComputerExecutor.getAppState() return shape.
 */
interface OpenCodexAppState {
  app: { bundleId: string; name: string; pid: number }
  windowTitle: string
  windowBounds: { x: number; y: number; width: number; height: number }
  screenshot?: { base64: string; width: number; height: number }
  tree: Array<{
    index: number
    bundleId: string
    text: string
    role: string
    rect?: { x: number; y: number; width: number; height: number }
  }>
}

// ── Module-level cache ─────────────────────────────────────────────────────────

let cachedAdapter: ExecutorAdapter | null = null

// ── OpenCodexRuntime wrapper ───────────────────────────────────────────────────

// Lazy import to avoid circular deps — Task 1 creates this module
let _OpenCodexRuntime: typeof import('./openCodexRuntime.js').OpenCodexRuntime | undefined
async function getOpenCodexRuntime() {
  if (!_OpenCodexRuntime) {
    const mod = await import('./openCodexRuntime.js')
    _OpenCodexRuntime = mod.OpenCodexRuntime
  }
  return _OpenCodexRuntime!
}

/**
 * Wraps OpenCodexRuntime into a ComputerExecutor-compatible interface.
 * AT-SPI2 semantic operations mapped to ComputerExecutor method signatures.
 */
function createOpenCodexExecutor(openCodex: InstanceType<typeof import('./openCodexRuntime.js').OpenCodexRuntime>): ComputerExecutor {
  return {
    capabilities: {
      screenshotFiltering: 'native' as const,
      platform: 'linux' as const,
      hostBundleId: 'open-codex',
    },

    // ── App state (AT-SPI2 tree) ─────────────────────────────────────

    /**
     * open-codex specific method — not in base ComputerExecutor but required
     * by the Codex protocol's get_app_state tool.
     */
    async getAppState(app: string): Promise<OpenCodexAppState> {
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
          ? {
              base64: snapshot.screenshotPngBase64,
              width: snapshot.windowBounds.width,
              height: snapshot.windowBounds.height,
            }
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

    // ── Display ──────────────────────────────────────────────────────

    async getDisplaySize(): Promise<{ displayId: number; width: number; height: number; scaleFactor: number; originX: number; originY: number }> {
      throw new Error('[open-codex] getDisplaySize not implemented — display geometry not exposed by open-codex')
    },

    async listDisplays(): Promise<Array<{ displayId: number; width: number; height: number; scaleFactor: number; originX: number; originY: number }>> {
      throw new Error('[open-codex] listDisplays not implemented')
    },

    async findWindowDisplays(): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      throw new Error('[open-codex] findWindowDisplays not implemented')
    },

    async prepareForAction(): Promise<string[]> {
      // AT-SPI2 doesn't require app hiding like macOS Swift does
      return []
    },

    async previewHideSet(): Promise<Array<{ bundleId: string; displayName: string }>> {
      return []
    },

    async resolvePrepareCapture(): Promise<{ base64: string; width: number; height: number; displayWidth: number; displayHeight: number; originX: number; originY: number; displayId: number; hidden: string[] }> {
      throw new Error('[open-codex] resolvePrepareCapture not implemented')
    },

    async screenshot(): Promise<{ base64: string; width: number; height: number; displayWidth: number; displayHeight: number; originX: number; originY: number; displayId?: number }> {
      throw new Error('[open-codex] screenshot not implemented via open-codex yet, use fallback')
    },

    async zoom(): Promise<{ base64: string; width: number; height: number }> {
      throw new Error('[open-codex] zoom not implemented via open-codex yet, use fallback')
    },

    // ── Keyboard ─────────────────────────────────────────────────────

    async key(keySequence: string, repeat?: number): Promise<void> {
      await openCodex.pressKey(keySequence, repeat ?? 1)
    },

    async holdKey(): Promise<void> {
      throw new Error('[open-codex] holdKey not implemented')
    },

    async type(text: string, opts: { viaClipboard: boolean }): Promise<void> {
      if (opts.viaClipboard) {
        throw new Error('[open-codex] type with viaClipboard not implemented — use fallback executor')
      }
      await openCodex.typeText(text)
    },

    async readClipboard(): Promise<string> {
      throw new Error('[open-codex] readClipboard not implemented')
    },

    async writeClipboard(_text: string): Promise<void> {
      throw new Error('[open-codex] writeClipboard not implemented')
    },

    // ── Mouse ────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      throw new Error(`[open-codex] moveMouse(${x}, ${y}) not implemented`)
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      _modifiers?: string[],
    ): Promise<void> {
      throw new Error(`[open-codex] click(${x}, ${y}, ${button}, ${count}) not implemented`)
    },

    async mouseDown(): Promise<void> {
      throw new Error('[open-codex] mouseDown not implemented')
    },

    async mouseUp(): Promise<void> {
      throw new Error('[open-codex] mouseUp not implemented')
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      throw new Error('[open-codex] getCursorPosition not implemented')
    },

    async drag(): Promise<void> {
      throw new Error('[open-codex] drag not implemented')
    },

    async scroll(_x: number, _y: number, _dx: number, _dy: number): Promise<void> {
      throw new Error('[open-codex] scroll not implemented')
    },

    // ── App management ───────────────────────────────────────────────

    async getFrontmostApp(): Promise<{ bundleId: string; displayName: string } | null> {
      throw new Error('[open-codex] getFrontmostApp not implemented')
    },

    async appUnderPoint(): Promise<{ bundleId: string; displayName: string } | null> {
      throw new Error('[open-codex] appUnderPoint not implemented')
    },

    async listInstalledApps(): Promise<Array<{ bundleId: string; displayName: string; path: string; iconDataUrl?: string }>> {
      throw new Error('[open-codex] listInstalledApps not implemented')
    },

    async getAppIcon(): Promise<string | undefined> {
      throw new Error('[open-codex] getAppIcon not implemented')
    },

    async listRunningApps(): Promise<Array<{ bundleId: string; displayName: string; pid?: number }>> {
      throw new Error('[open-codex] listRunningApps not implemented')
    },

    async openApp(bundleId: string): Promise<void> {
      throw new Error(`[open-codex] openApp(${bundleId}) not implemented`)
    },
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates an ExecutorAdapter with primary (open-codex) or fallback (linux-input) runtime.
 * Result is cached at module level — subsequent calls return the same adapter.
 */
export async function createExecutorAdapter(): Promise<ExecutorAdapter> {
  if (cachedAdapter) {
    return cachedAdapter
  }

  const OpenCodexRuntime = await getOpenCodexRuntime()
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

    // Lazy import to avoid loading linux executor on non-Linux platforms
    const { createLinuxExecutor } = await import('./executor.js')

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
