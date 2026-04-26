import type {
  ComputerUseHostAdapter,
  Logger,
} from '../../../deps/@ant/computer-use-mcp/src/types.js'
import { format } from 'util'
import { logForDebugging } from '../debug.js'
import { isBinaryInstalled } from '../binaryCheck.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'
import { createCliExecutor, createLinuxExecutor } from './executor.js'
import { createExecutorAdapter } from './executorFactory.js'
import { getChicagoEnabled, getChicagoSubGates } from './gates.js'

class DebugLogger implements Logger {
  silly(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  debug(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  info(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'info' })
  }
  warn(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'warn' })
  }
  error(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'error' })
  }
}

let cached: ComputerUseHostAdapter | undefined
const isLinux = process.platform === 'linux'

// Lazy import for macOS-only modules (throws on non-darwin)
function requireComputerUseSwift() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ant/computer-use-swift')
}

let cachedSwift: ReturnType<typeof requireComputerUseSwift> | undefined

function getComputerUseSwift() {
  if (cachedSwift) return cachedSwift
  cachedSwift = requireComputerUseSwift()
  return cachedSwift
}

/**
 * Process-lifetime singleton. Built once on first CU tool call; native modules
 * (both `@ant/computer-use-input` and `@ant/computer-use-swift`) are loaded
 * here via the executor factory, which throws on load failure — there is no
 * degraded mode.
 *
 * On Linux, uses the Linux executor (xdotool/ImageMagick/xclip) instead of
 * the macOS-specific Swift and enigo modules.
 */
export function getComputerUseHostAdapter(): ComputerUseHostAdapter {
  if (cached) return cached

  cached = {
    serverName: COMPUTER_USE_MCP_SERVER_NAME,
    logger: new DebugLogger(),
    executor: isLinux
      ? createLinuxExecutor({
          getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
          getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
        })
      : createCliExecutor({
          getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
          getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
        }),
    ensureOsPermissions: async () => {
      if (isLinux) {
        // On Linux, check for xdotool availability as a proxy for permissions
        const [hasXdotool, hasImport, hasXclip] = await Promise.all([
          isBinaryInstalled('xdotool'),
          isBinaryInstalled('import'),
          isBinaryInstalled('xclip'),
        ])
        const granted = hasXdotool && hasImport && hasXclip
        return {
          granted,
          accessibility: granted,
          screenRecording: granted,
        }
      }
      const cu = getComputerUseSwift()
      const accessibility = cu.tcc.checkAccessibility()
      const screenRecording = cu.tcc.checkScreenRecording()
      return accessibility && screenRecording
        ? { granted: true }
        : { granted: false, accessibility, screenRecording }
    },
    isDisabled: () => !getChicagoEnabled(),
    getSubGates: getChicagoSubGates,
    // cleanup.ts always unhides at turn end — no user preference to disable it.
    getAutoUnhideEnabled: () => true,

    // Pixel-validation JPEG decode+crop. MUST be synchronous (the package
    // does `patch1.equals(patch2)` directly on the return value). Cowork uses
    // Electron's `nativeImage` (sync); our `image-processor-napi` is
    // sharp-compatible and async-only. Returning null → validation skipped,
    // click proceeds — the designed fallback per `PixelCompareResult.skipped`.
    // The sub-gate defaults to false anyway.
    cropRawPatch: () => null,
  }

  // Start async detection for future callers (after first caller's adapter is returned)
  startBackgroundExecutorSwap()

  return cached
}

// Background detection flag — ensure swap only runs once
let backgroundDetectionStarted = false

/**
 * On Linux, use the factory for async detection of open-codex primary runtime.
 * If open-codex is primary, swap the executor in the background for FUTURE callers.
 * First caller always gets the initial adapter (linux-input fallback) to avoid race.
 * Also respects getChicagoEnabled() — skip detection if Computer Use is disabled.
 */
function startBackgroundExecutorSwap() {
  if (!isLinux || backgroundDetectionStarted) return
  if (!getChicagoEnabled()) return // Computer Use disabled, skip detection
  backgroundDetectionStarted = true

  createExecutorAdapter()
    .then(adapter => {
      if (adapter.isPrimary) {
        cached!.executor = adapter.executor
        logForDebugging('[host-adapter] Switched to open-codex executor')
      }
    })
    .catch(err => {
      logForDebugging('[host-adapter] executorFactory error:', err)
    })
}
