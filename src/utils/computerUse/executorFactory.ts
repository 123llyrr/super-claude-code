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
      // TODO: open-codex may not expose display geometry directly
      // Use screenshot dimensions as fallback
      return { displayId: 0, width: 1920, height: 1080, scaleFactor: 1, originX: 0, originY: 0 }
    },

    async listDisplays(): Promise<Array<{ displayId: number; width: number; height: number; scaleFactor: number; originX: number; originY: number }>> {
      return [await this.getDisplaySize()]
    },

    async findWindowDisplays(): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      // TODO: Implement via open-codex window tracking
      return []
    },

    async prepareForAction(): Promise<string[]> {
      // AT-SPI2 doesn't require app hiding like macOS Swift does
      return []
    },

    async previewHideSet(): Promise<Array<{ bundleId: string; displayName: string }>> {
      return []
    },

    async resolvePrepareCapture(): Promise<{ base64: string; width: number; height: number; displayWidth: number; displayHeight: number; originX: number; originY: number; displayId: number; hidden: string[] }> {
      // TODO: Implement via open-codex screenshot + prepare
      return {
        base64: '',
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
        originX: 0,
        originY: 0,
        displayId: 0,
        hidden: [],
      }
    },

    async screenshot(): Promise<{ base64: string; width: number; height: number; displayWidth: number; displayHeight: number; originX: number; originY: number; displayId?: number }> {
      // TODO: open-codex screenshot integration
      return {
        base64: '',
        width: 1920,
        height: 1080,
        displayWidth: 1920,
        displayHeight: 1080,
        originX: 0,
        originY: 0,
        displayId: 0,
      }
    },

    async zoom(): Promise<{ base64: string; width: number; height: number }> {
      // TODO: Implement via open-codex region capture
      return { base64: '', width: 0, height: 0 }
    },

    // ── Keyboard ─────────────────────────────────────────────────────

    async key(keySequence: string, repeat?: number): Promise<void> {
      await openCodex.pressKey(keySequence, repeat ?? 1)
    },

    async holdKey(): Promise<void> {
      // TODO: Implement via open-codex key hold
      logForDebugging('[open-codex] holdKey not yet implemented')
    },

    async type(text: string, _opts: { viaClipboard: boolean }): Promise<void> {
      // TODO: open-codex type_text integration (clipboard param ignored for now)
      await openCodex.typeText(text)
    },

    async readClipboard(): Promise<string> {
      // TODO: open-codex clipboard read
      logForDebugging('[open-codex] readClipboard not yet implemented')
      return ''
    },

    async writeClipboard(text: string): Promise<void> {
      // TODO: open-codex clipboard write
      logForDebugging('[open-codex] writeClipboard not yet implemented')
    },

    // ── Mouse ────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      // TODO: open-codex move_mouse integration
      logForDebugging(`[open-codex] moveMouse(${x}, ${y}) not yet implemented`)
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      _modifiers?: string[],
    ): Promise<void> {
      // TODO: open-codex click with element index (coordinate click as fallback)
      logForDebugging(`[open-codex] click(${x}, ${y}, ${button}, ${count}) not yet implemented`)
    },

    async mouseDown(): Promise<void> {
      logForDebugging('[open-codex] mouseDown not yet implemented')
    },

    async mouseUp(): Promise<void> {
      logForDebugging('[open-codex] mouseUp not yet implemented')
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      // TODO: open-codex cursor position
      return { x: 0, y: 0 }
    },

    async drag(): Promise<void> {
      // TODO: open-codex drag integration
      logForDebugging('[open-codex] drag not yet implemented')
    },

    async scroll(x: number, y: number, dx: number, dy: number): Promise<void> {
      // TODO: open-codex scroll integration (Page_Up/Down keys as fallback)
      logForDebugging(`[open-codex] scroll(${x}, ${y}, ${dx}, ${dy}) not yet implemented`)
    },

    // ── App management ───────────────────────────────────────────────

    async getFrontmostApp(): Promise<{ bundleId: string; displayName: string } | null> {
      // TODO: open-codex frontmost app detection
      logForDebugging('[open-codex] getFrontmostApp not yet implemented')
      return null
    },

    async appUnderPoint(): Promise<{ bundleId: string; displayName: string } | null> {
      // TODO: open-codex app under point
      logForDebugging('[open-codex] appUnderPoint not yet implemented')
      return null
    },

    async listInstalledApps(): Promise<Array<{ bundleId: string; displayName: string; path: string; iconDataUrl?: string }>> {
      // TODO: open-codex list_apps integration
      logForDebugging('[open-codex] listInstalledApps not yet implemented')
      return []
    },

    async getAppIcon(): Promise<string | undefined> {
      // TODO: open-codex icon lookup
      return undefined
    },

    async listRunningApps(): Promise<Array<{ bundleId: string; displayName: string; pid?: number }>> {
      // TODO: open-codex list running apps
      logForDebugging('[open-codex] listRunningApps not yet implemented')
      return []
    },

    async openApp(bundleId: string): Promise<void> {
      // TODO: open-codex open_app integration
      logForDebugging(`[open-codex] openApp(${bundleId}) not yet implemented`)
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
