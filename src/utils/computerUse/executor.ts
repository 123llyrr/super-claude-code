/**
 * CLI `ComputerExecutor` implementation. Wraps two native modules:
 *   - `@ant/computer-use-input` (Rust/enigo) — mouse, keyboard, frontmost app
 *   - `@ant/computer-use-swift` — SCContentFilter screenshots, NSWorkspace apps, TCC
 *
 * Contract: `packages/desktop/computer-use-mcp/src/executor.ts` in the apps
 * repo. The reference impl is Cowork's `apps/desktop/src/main/nest-only/
 * computer-use/executor.ts` — see notable deviations under "CLI deltas" below.
 *
 * ── CLI deltas from Cowork ─────────────────────────────────────────────────
 *
 * No `withClickThrough`. Cowork wraps every mouse op in
 *   `BrowserWindow.setIgnoreMouseEvents(true)` so clicks fall through the
 *   overlay. We're a terminal — no window — so the click-through bracket is
 *   a no-op. The sentinel `CLI_HOST_BUNDLE_ID` never matches frontmost.
 *
 * Terminal as surrogate host. `getTerminalBundleId()` detects the emulator
 *   we're running inside. It's passed as `hostBundleId` to `prepareDisplay`/
 *   `resolvePrepareCapture` so the Swift side exempts it from hide AND skips
 *   it in the activate z-order walk (so the terminal being frontmost doesn't
 *   eat clicks meant for the target app). Also stripped from `allowedBundleIds`
 *   via `withoutTerminal()` so screenshots don't capture it (Swift 0.2.1's
 *   captureExcluding takes an allow-list despite the name — apps#30355).
 *   `capabilities.hostBundleId` stays as the sentinel — the package's
 *   frontmost gate uses that, and the terminal being frontmost is fine.
 *
 * Clipboard via `pbcopy`/`pbpaste`. No Electron `clipboard` module.
 */

import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from '../../../deps/@ant/computer-use-mcp/src/types.js'

import { API_RESIZE_PARAMS, targetImageSize } from './imageResize.js'
import { execFileSync } from 'child_process'
import { logForDebugging } from '../debug.js'
import { errorMessage } from '../errors.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { sleep } from '../sleep.js'
import {
  CLI_CU_CAPABILITIES,
  CLI_HOST_BUNDLE_ID,
  getTerminalBundleId,
} from './common.js'

// ── Lazy macOS-only module getters (avoid loading on Linux) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getSwiftModule = () => require('@ant/computer-use-swift') as any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getInputModule = () => require('@ant/computer-use-input') as any

function requireComputerUseSwift() {
  return getSwiftModule()
}
function requireComputerUseInput() {
  return getInputModule()
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
let _drainRunLoop: typeof import('./drainRunLoop.js').drainRunLoop | undefined
// eslint-disable-next-line @typescript-eslint/no-require-imports
let _notifyExpectedEscape: typeof import('./escHotkey.js').notifyExpectedEscape | undefined

async function drainRunLoop<T>(fn: () => Promise<T>): Promise<T> {
  if (!_drainRunLoop) {
    const mod = await import('./drainRunLoop.js')
    _drainRunLoop = mod.drainRunLoop
  }
  return _drainRunLoop!(fn)
}

function notifyExpectedEscape() {
  if (!_notifyExpectedEscape) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./escHotkey.js') as any
    _notifyExpectedEscape = mod.notifyExpectedEscape
  }
  return _notifyExpectedEscape!()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCREENSHOT_JPEG_QUALITY = 0.75

/** Logical → physical → API target dims. See `targetImageSize` + COORDINATES.md. */
function computeTargetDims(
  logicalW: number,
  logicalH: number,
  scaleFactor: number,
): [number, number] {
  const physW = Math.round(logicalW * scaleFactor)
  const physH = Math.round(logicalH * scaleFactor)
  return targetImageSize(physW, physH, API_RESIZE_PARAMS)
}

async function readClipboardViaPbpaste(): Promise<string> {
  const { stdout, code } = await execFileNoThrow('pbpaste', [], {
    useCwd: false,
  })
  if (code !== 0) {
    throw new Error(`pbpaste exited with code ${code}`)
  }
  return stdout
}

async function writeClipboardViaPbcopy(text: string): Promise<void> {
  const { code } = await execFileNoThrow('pbcopy', [], {
    input: text,
    useCwd: false,
  })
  if (code !== 0) {
    throw new Error(`pbcopy exited with code ${code}`)
  }
}

type Input = ReturnType<typeof requireComputerUseInput>

/**
 * Single-element key sequence matching "escape" or "esc" (case-insensitive).
 * Used to hole-punch the CGEventTap abort for model-synthesized Escape — enigo
 * accepts both spellings, so the tap must too.
 */
function isBareEscape(parts: readonly string[]): boolean {
  if (parts.length !== 1) return false
  const lower = parts[0]!.toLowerCase()
  return lower === 'escape' || lower === 'esc'
}

/**
 * Instant move, then 50ms — an input→HID→AppKit→NSEvent round-trip before the
 * caller reads `NSEvent.mouseLocation` or dispatches a click. Used for click,
 * scroll, and drag-from; `animatedMove` is reserved for drag-to only. The
 * intermediate animation frames were triggering hover states and, on the
 * decomposed mouseDown/moveMouse path, emitting stray `.leftMouseDragged`
 * events (toolCalls.ts handleScroll's mouse_full workaround).
 */
const MOVE_SETTLE_MS = 50

async function moveAndSettle(
  input: Input,
  x: number,
  y: number,
): Promise<void> {
  await input.moveMouse(x, y, false)
  await sleep(MOVE_SETTLE_MS)
}

/**
 * Release `pressed` in reverse (last pressed = first released). Errors are
 * swallowed so a release failure never masks the real error.
 *
 * Drains via pop() rather than snapshotting length: if a drainRunLoop-
 * orphaned press lambda resolves an in-flight input.key() AFTER finally
 * calls us, that late push is still released on the next iteration. The
 * orphaned flag stops the lambda at its NEXT check, not the current await.
 */
async function releasePressed(input: Input, pressed: string[]): Promise<void> {
  let k: string | undefined
  while ((k = pressed.pop()) !== undefined) {
    try {
      await input.key(k, 'release')
    } catch {
      // Swallow — best-effort release.
    }
  }
}

/**
 * Bracket `fn()` with modifier press/release. `pressed` tracks which presses
 * actually landed, so a mid-press throw only releases what was pressed — no
 * stuck modifiers. The finally covers both press-phase and fn() throws.
 *
 * Caller must already be inside drainRunLoop() — key() dispatches to the
 * main queue and needs the pump to resolve.
 */
async function withModifiers<T>(
  input: Input,
  mods: string[],
  fn: () => Promise<T>,
): Promise<T> {
  const pressed: string[] = []
  try {
    for (const m of mods) {
      await input.key(m, 'press')
      pressed.push(m)
    }
    return await fn()
  } finally {
    await releasePressed(input, pressed)
  }
}

/**
 * Port of Cowork's `typeViaClipboard`. Sequence:
 *   1. Save the user's clipboard.
 *   2. Write our text.
 *   3. READ-BACK VERIFY — clipboard writes can silently fail. If the
 *      read-back doesn't match, never press Cmd+V (would paste junk).
 *   4. Cmd+V via keys().
 *   5. Sleep 100ms — battle-tested threshold for the paste-effect vs
 *      clipboard-restore race. Restoring too soon means the target app
 *      pastes the RESTORED content.
 *   6. Restore — in a `finally`, so a throw between 2-5 never leaves the
 *      user's clipboard clobbered. Restore failures are swallowed.
 */
async function typeViaClipboard(input: Input, text: string): Promise<void> {
  let saved: string | undefined
  try {
    saved = await readClipboardViaPbpaste()
  } catch {
    logForDebugging(
      '[computer-use] pbpaste before paste failed; proceeding without restore',
    )
  }

  try {
    await writeClipboardViaPbcopy(text)
    if ((await readClipboardViaPbpaste()) !== text) {
      throw new Error('Clipboard write did not round-trip.')
    }
    await input.keys(['command', 'v'])
    await sleep(100)
  } finally {
    if (typeof saved === 'string') {
      try {
        await writeClipboardViaPbcopy(saved)
      } catch {
        logForDebugging('[computer-use] clipboard restore after paste failed')
      }
    }
  }
}

/**
 * Port of Cowork's `animateMouseMovement` + `animatedMove`. Ease-out-cubic at
 * 60fps; distance-proportional duration at 2000 px/sec, capped at 0.5s. When
 * the sub-gate is off (or distance < ~2 frames), falls through to
 * `moveAndSettle`. Called only from `drag` for the press→to motion — target
 * apps may watch for `.leftMouseDragged` specifically (not just "button down +
 * position changed") and the slow motion gives them time to process
 * intermediate positions (scrollbars, window resizes).
 */
async function animatedMove(
  input: Input,
  targetX: number,
  targetY: number,
  mouseAnimationEnabled: boolean,
): Promise<void> {
  if (!mouseAnimationEnabled) {
    await moveAndSettle(input, targetX, targetY)
    return
  }
  const start = await input.mouseLocation()
  const deltaX = targetX - start.x
  const deltaY = targetY - start.y
  const distance = Math.hypot(deltaX, deltaY)
  if (distance < 1) return
  const durationSec = Math.min(distance / 2000, 0.5)
  if (durationSec < 0.03) {
    await moveAndSettle(input, targetX, targetY)
    return
  }
  const frameRate = 60
  const frameIntervalMs = 1000 / frameRate
  const totalFrames = Math.floor(durationSec * frameRate)
  for (let frame = 1; frame <= totalFrames; frame++) {
    const t = frame / totalFrames
    const eased = 1 - Math.pow(1 - t, 3)
    await input.moveMouse(
      Math.round(start.x + deltaX * eased),
      Math.round(start.y + deltaY * eased),
      false,
    )
    if (frame < totalFrames) {
      await sleep(frameIntervalMs)
    }
  }
  // Last frame has no trailing sleep — same HID round-trip before the
  // caller's mouseButton reads NSEvent.mouseLocation.
  await sleep(MOVE_SETTLE_MS)
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createCliExecutor(opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  if (process.platform !== 'darwin') {
    throw new Error(
      `createCliExecutor called on ${process.platform}. Computer control is macOS-only.`,
    )
  }

  // Swift loaded once at factory time — every executor method needs it.
  // Input loaded lazily via requireComputerUseInput() on first mouse/keyboard
  // call — it caches internally, so screenshot-only flows never pull the
  // enigo .node.
  const cu = requireComputerUseSwift()

  const { getMouseAnimationEnabled, getHideBeforeActionEnabled } = opts
  const terminalBundleId = getTerminalBundleId()
  const surrogateHost = terminalBundleId ?? CLI_HOST_BUNDLE_ID
  // Swift 0.2.1's captureExcluding/captureRegion take an ALLOW list despite the
  // name (apps#30355 — complement computed Swift-side against running apps).
  // The terminal isn't in the user's grants so it's naturally excluded, but if
  // the package ever passes it through we strip it here so the terminal never
  // photobombs a screenshot.
  const withoutTerminal = (allowed: readonly string[]): string[] =>
    terminalBundleId === null
      ? [...allowed]
      : allowed.filter(id => id !== terminalBundleId)

  logForDebugging(
    terminalBundleId
      ? `[computer-use] terminal ${terminalBundleId} → surrogate host (hide-exempt, activate-skip, screenshot-excluded)`
      : '[computer-use] terminal not detected; falling back to sentinel host',
  )

  return {
    capabilities: {
      ...CLI_CU_CAPABILITIES,
      hostBundleId: CLI_HOST_BUNDLE_ID,
    },

    // ── Pre-action sequence (hide + defocus) ────────────────────────────

    async prepareForAction(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<string[]> {
      if (!getHideBeforeActionEnabled()) {
        return []
      }
      // prepareDisplay isn't @MainActor (plain Task{}), but its .hide() calls
      // trigger window-manager events that queue on CFRunLoop. Without the
      // pump, those pile up during Swift's ~1s of usleeps and flush all at
      // once when the next pumped call runs — visible window flashing.
      // Electron drains CFRunLoop continuously so Cowork doesn't see this.
      // Worst-case 100ms + 5×200ms safety-net ≈ 1.1s, well under the 30s
      // drainRunLoop ceiling.
      //
      // "Continue with action execution even if switching fails" — the
      // frontmost gate in toolCalls.ts catches any actual unsafe state.
      return drainRunLoop(async () => {
        try {
          const result = await cu.apps.prepareDisplay(
            allowlistBundleIds,
            surrogateHost,
            displayId,
          )
          if (result.activated) {
            logForDebugging(
              `[computer-use] prepareForAction: activated ${result.activated}`,
            )
          }
          return result.hidden
        } catch (err) {
          logForDebugging(
            `[computer-use] prepareForAction failed; continuing to action: ${errorMessage(err)}`,
            { level: 'warn' },
          )
          return []
        }
      })
    },

    async previewHideSet(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<Array<{ bundleId: string; displayName: string }>> {
      return cu.apps.previewHideSet(
        [...allowlistBundleIds, surrogateHost],
        displayId,
      )
    },

    // ── Display ──────────────────────────────────────────────────────────

    async getDisplaySize(displayId?: number): Promise<DisplayGeometry> {
      return cu.display.getSize(displayId)
    },

    async listDisplays(): Promise<DisplayGeometry[]> {
      return cu.display.listAll()
    },

    async findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      return cu.apps.findWindowDisplays(bundleIds)
    },

    async resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult> {
      const d = cu.display.getSize(opts.preferredDisplayId)
      const [targetW, targetH] = computeTargetDims(
        d.width,
        d.height,
        d.scaleFactor,
      )
      return drainRunLoop(() =>
        cu.resolvePrepareCapture(
          withoutTerminal(opts.allowedBundleIds),
          surrogateHost,
          SCREENSHOT_JPEG_QUALITY,
          targetW,
          targetH,
          opts.preferredDisplayId,
          opts.autoResolve,
          opts.doHide,
        ),
      )
    },

    /**
     * Pre-size to `targetImageSize` output so the API transcoder's early-return
     * fires — no server-side resize, `scaleCoord` stays coherent. See
     * packages/desktop/computer-use-mcp/COORDINATES.md.
     */
    async screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult> {
      const d = cu.display.getSize(opts.displayId)
      const [targetW, targetH] = computeTargetDims(
        d.width,
        d.height,
        d.scaleFactor,
      )
      return drainRunLoop(() =>
        cu.screenshot.captureExcluding(
          withoutTerminal(opts.allowedBundleIds),
          SCREENSHOT_JPEG_QUALITY,
          targetW,
          targetH,
          opts.displayId,
        ),
      )
    },

    async zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      allowedBundleIds: string[],
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }> {
      const d = cu.display.getSize(displayId)
      const [outW, outH] = computeTargetDims(
        regionLogical.w,
        regionLogical.h,
        d.scaleFactor,
      )
      return drainRunLoop(() =>
        cu.screenshot.captureRegion(
          withoutTerminal(allowedBundleIds),
          regionLogical.x,
          regionLogical.y,
          regionLogical.w,
          regionLogical.h,
          outW,
          outH,
          SCREENSHOT_JPEG_QUALITY,
          displayId,
        ),
      )
    },

    // ── Keyboard ─────────────────────────────────────────────────────────

    /**
     * xdotool-style sequence e.g. "ctrl+shift+a" → split on '+' and pass to
     * keys(). keys() dispatches to DispatchQueue.main — drainRunLoop pumps
     * CFRunLoop so it resolves. Rust's error-path cleanup (enigo_wrap.rs)
     * releases modifiers on each invocation, so a mid-loop throw leaves
     * nothing stuck. 8ms between iterations — 125Hz USB polling cadence.
     */
    async key(keySequence: string, repeat?: number): Promise<void> {
      const input = requireComputerUseInput()
      const parts = keySequence.split('+').filter(p => p.length > 0)
      // Bare-only: the CGEventTap checks event.flags.isEmpty so ctrl+escape
      // etc. pass through without aborting.
      const isEsc = isBareEscape(parts)
      const n = repeat ?? 1
      await drainRunLoop(async () => {
        for (let i = 0; i < n; i++) {
          if (i > 0) {
            await sleep(8)
          }
          if (isEsc) {
            notifyExpectedEscape()
          }
          await input.keys(parts)
        }
      })
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      const input = requireComputerUseInput()
      // Press/release each wrapped in drainRunLoop; the sleep sits outside so
      // durationMs isn't bounded by drainRunLoop's 30s timeout. `pressed`
      // tracks which presses landed so a mid-press throw still releases
      // everything that was actually pressed.
      //
      // `orphaned` guards against a timeout-orphan race: if the press-phase
      // drainRunLoop times out while the esc-hotkey pump-retain keeps the
      // pump running, the orphaned lambda would continue pushing to `pressed`
      // after finally's releasePressed snapshotted the length — leaving keys
      // stuck. The flag stops the lambda at the next iteration.
      const pressed: string[] = []
      let orphaned = false
      try {
        await drainRunLoop(async () => {
          for (const k of keyNames) {
            if (orphaned) return
            // Bare Escape: notify the CGEventTap so it doesn't fire the
            // abort callback for a model-synthesized press. Same as key().
            if (isBareEscape([k])) {
              notifyExpectedEscape()
            }
            await input.key(k, 'press')
            pressed.push(k)
          }
        })
        await sleep(durationMs)
      } finally {
        orphaned = true
        await drainRunLoop(() => releasePressed(input, pressed))
      }
    },

    async type(text: string, opts: { viaClipboard: boolean }): Promise<void> {
      const input = requireComputerUseInput()
      if (opts.viaClipboard) {
        // keys(['command','v']) inside needs the pump.
        await drainRunLoop(() => typeViaClipboard(input, text))
        return
      }
      // `toolCalls.ts` handles the grapheme loop + 8ms sleeps and calls this
      // once per grapheme. typeText doesn't dispatch to the main queue.
      await input.typeText(text)
    },

    readClipboard: readClipboardLinux,

    writeClipboard: writeClipboardLinux,

    // ── Mouse ────────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      await moveAndSettle(requireComputerUseInput(), x, y)
    },

    /**
     * Move, then click. Modifiers are press/release bracketed via withModifiers
     * — same pattern as Cowork. AppKit computes NSEvent.clickCount from timing
     * + position proximity, so double/triple click work without setting the
     * CGEvent clickState field. key() inside withModifiers needs the pump;
     * the modifier-less path doesn't.
     */
    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      const input = requireComputerUseInput()
      await moveAndSettle(input, x, y)
      if (modifiers && modifiers.length > 0) {
        await drainRunLoop(() =>
          withModifiers(input, modifiers, () =>
            input.mouseButton(button, 'click', count),
          ),
        )
      } else {
        await input.mouseButton(button, 'click', count)
      }
    },

    async mouseDown(): Promise<void> {
      await requireComputerUseInput().mouseButton('left', 'press')
    },

    async mouseUp(): Promise<void> {
      await requireComputerUseInput().mouseButton('left', 'release')
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      return requireComputerUseInput().mouseLocation()
    },

    /**
     * `from === undefined` → drag from current cursor (training's
     * left_click_drag with start_coordinate omitted). Inner `finally`: the
     * button is ALWAYS released even if the move throws — otherwise the
     * user's left button is stuck-pressed until they physically click.
     * 50ms sleep after press: enigo's move_mouse reads NSEvent.pressedMouseButtons
     * to decide .leftMouseDragged vs .mouseMoved; the synthetic leftMouseDown
     * needs a HID-tap round-trip to show up there.
     */
    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      const input = requireComputerUseInput()
      if (from !== undefined) {
        await moveAndSettle(input, from.x, from.y)
      }
      await input.mouseButton('left', 'press')
      await sleep(MOVE_SETTLE_MS)
      try {
        await animatedMove(input, to.x, to.y, getMouseAnimationEnabled())
      } finally {
        await input.mouseButton('left', 'release')
      }
    },

    /**
     * Move first, then scroll each axis. Vertical-first — it's the common
     * axis; a horizontal failure shouldn't lose the vertical.
     */
    async scroll(x: number, y: number, dx: number, dy: number): Promise<void> {
      const input = requireComputerUseInput()
      await moveAndSettle(input, x, y)
      if (dy !== 0) {
        await input.mouseScroll(dy, 'vertical')
      }
      if (dx !== 0) {
        await input.mouseScroll(dx, 'horizontal')
      }
    },

    // ── App management ───────────────────────────────────────────────────

    async getFrontmostApp(): Promise<FrontmostApp | null> {
      const info = requireComputerUseInput().getFrontmostAppInfo()
      if (!info || !info.bundleId) return null
      return { bundleId: info.bundleId, displayName: info.appName }
    },

    async appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null> {
      return cu.apps.appUnderPoint(x, y)
    },

    async listInstalledApps(): Promise<InstalledApp[]> {
      // `ComputerUseInstalledApp` is `{bundleId, displayName, path}`.
      // `InstalledApp` adds optional `iconDataUrl` — left unpopulated;
      // the approval dialog fetches lazily via getAppIcon() below.
      return drainRunLoop(() => cu.apps.listInstalled())
    },

    async getAppIcon(path: string): Promise<string | undefined> {
      return cu.apps.iconDataUrl(path) ?? undefined
    },

    async listRunningApps(): Promise<RunningApp[]> {
      return cu.apps.listRunning()
    },

    async openApp(bundleId: string): Promise<void> {
      await cu.apps.open(bundleId)
    },
  }
}

/**
 * Module-level export (not on the executor object) — called at turn-end from
 * `stopHooks.ts` / `query.ts`, outside the executor lifecycle. Fire-and-forget
 * at the call site; the caller `.catch()`es.
 */
export async function unhideComputerUseApps(
  bundleIds: readonly string[],
): Promise<void> {
  if (bundleIds.length === 0) return
  // On Linux, no apps are hidden (prepareForAction returns []), so this is a no-op
  if (process.platform === 'linux') return
  const cu = requireComputerUseSwift()
  await cu.apps.unhide([...bundleIds])
}

// ── Linux Executor ───────────────────────────────────────────────────────────

import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from '../../../deps/@ant/computer-use-mcp/src/types.js'

import { homedir } from 'os'
import { API_RESIZE_PARAMS, targetImageSize } from './imageResize.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { sleep } from '../sleep.js'
import {
  CLI_LINUX_CAPABILITIES,
  getLinuxTerminalBundleId,
} from './common.js'
import { requireLinuxInput, isWaylandSession } from './linuxInputLoader.js'

const LINUX_SCREENSHOT_QUALITY = 75

type LinuxInput = ReturnType<typeof requireLinuxInput>

// ── Desktop file parsing for listInstalledApps / getAppIcon ───────────────────

interface ParsedDesktopEntry {
  name: string
  exec: string
  icon?: string
  noDisplay?: boolean
}

async function parseDesktopFile(filePath: string): Promise<ParsedDesktopEntry | null> {
  try {
    // Use head to read only first 2KB (enough for most headers)
    const { stdout, code } = await execFileNoThrow('head', ['-c', '2048', filePath], { useCwd: false })
    if (code !== 0) return null

    const lines = stdout.split('\n')
    let name = ''
    let exec = ''
    let icon: string | undefined
    let noDisplay = false

    for (const line of lines) {
      if (line.startsWith('Name=')) name = line.slice(5)
      else if (line.startsWith('Exec=')) exec = line.slice(5).split(' ')[0].split('%')[0]
      else if (line.startsWith('Icon=')) icon = line.slice(5)
      else if (line.startsWith('NoDisplay=true') || line.startsWith('Hidden=true')) noDisplay = true
      else if (line.startsWith('[')) {
        // Entering a new section, stop parsing
        if (name && exec) break
      }
    }

    if (!name || !exec || noDisplay) return null

    return { name, exec, icon, noDisplay }
  } catch {
    return null
  }
}

async function findDesktopFileByExec(execPath: string): Promise<string | undefined> {
  // Extract base executable name
  const baseName = execPath.split('/').pop() ?? execPath

  const desktopDirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    homedir() + '/.local/share/applications',
  ]

  for (const dir of desktopDirs) {
    try {
      const { stdout, code } = await execFileNoThrow('grep', ['-l', `-E`, `^Exec=.*${baseName}( |$)`, dir], { useCwd: false })
      if (code === 0 && stdout.trim()) {
        return stdout.trim().split('\n')[0]
      }
    } catch {
      // grep failed, continue
    }
  }
  return undefined
}

async function getIconFromDesktopFile(desktopPath: string): Promise<string | undefined> {
  try {
    const { stdout, code } = await execFileNoThrow('grep', ['-m1', '^Icon=', desktopPath], { useCwd: false })
    if (code === 0 && stdout.startsWith('Icon=')) {
      return stdout.slice(5).trim()
    }
  } catch {
    // Not found
  }
  return undefined
}

function resolveIconPath(iconRef: string): string | undefined {
  // Absolute path
  if (iconRef.startsWith('/')) {
    return iconRef
  }

  // Check common icon directories
  const iconDirs = [
    '/usr/share/pixmaps',
    '/usr/share/icons/hicolor/48x48/apps',
    '/usr/share/icons/gnome/48x48/apps',
    homedir() + '/.local/share/icons',
  ]

  // Try as filename in pixmaps
  for (const dir of iconDirs) {
    const fullPath = `${dir}/${iconRef}`
    const { code } = execFileSync('test', ['-f', fullPath])
    if (code === 0) return fullPath
  }

  // Try with .png/.svg extensions
  for (const ext of ['', '.png', '.svg', '.xpm']) {
    for (const dir of iconDirs) {
      const fullPath = `${dir}/${iconRef}${ext}`
      const { code } = execFileSync('test', ['-f', fullPath])
      if (code === 0) return fullPath
    }
  }

  return undefined
}

function encodeIconToBase64(iconPath: string): string | undefined {
  try {
    // Check file exists and is not too large (max 256KB for an icon)
    const { stdout: sizeOut, code: sizeCode } = execFileSync('stat', ['-c', '%s', iconPath])
    if (sizeCode === 0) {
      const size = parseInt(sizeOut.trim(), 10)
      if (size > 262144) return undefined // Too large
    }

    const { stdout, code } = execFileSync('base64', ['-w', '0', iconPath])
    if (code === 0) {
      return stdout.trim()
    }
  } catch {
    // Failed to encode
  }
  return undefined
}

/**
 * Get display geometry for X11 using xdpyinfo or xrandr.
 */
async function getX11DisplayGeometry(displayId?: number): Promise<DisplayGeometry> {
  const displayArg = displayId !== undefined ? `:${displayId}` : ':0'

  const { stdout: xdpyOut, code: xdpyCode } = await execFileNoThrow(
    'xdpyinfo', ['-display', displayArg], { useCwd: false },
  )

  if (xdpyCode === 0) {
    const dimensionsMatch = xdpyOut.match(/dimensions:\s+(\d+)x(\d+) pixels/)
    const dpiMatch = xdpyOut.match(/resolution:\s+(\d+)x(\d+) dots per inch/)
    if (dimensionsMatch) {
      const width = parseInt(dimensionsMatch[1], 10)
      const height = parseInt(dimensionsMatch[2], 10)
      const dpiX = dpiMatch ? parseInt(dpiMatch[1], 10) : 96
      return { displayId: displayId ?? 0, width, height, scaleFactor: dpiX / 96, originX: 0, originY: 0 }
    }
  }

  const { stdout: xrOut, code: xrCode } = await execFileNoThrow(
    'xrandr', ['--display', displayArg, '--current'], { useCwd: false },
  )

  if (xrCode === 0) {
    const match = xrOut.match(/(\d+)x(\d+)\+?\d+\+?\d+/)
    if (match) {
      return { displayId: displayId ?? 0, width: parseInt(match[1], 10), height: parseInt(match[2], 10), scaleFactor: 1, originX: 0, originY: 0 }
    }
  }

  return { displayId: displayId ?? 0, width: 1920, height: 1080, scaleFactor: 1, originX: 0, originY: 0 }
}

/**
 * Get display geometry for Wayland using compositor-specific tools.
 * Supports: Sway (wlr-randr), KDE (kwinctl), GNOME (gdbus), and generic fallback.
 */
async function getWaylandDisplayGeometry(): Promise<DisplayGeometry> {
  // Try compositor-specific tools in order
  const compositor = await detectWaylandCompositor()

  // Sway and other wlroots compositors
  if (compositor === 'sway' || compositor === 'wlroots') {
    const { stdout, code } = await execFileNoThrow('wlr-randr', [], { useCwd: false })
    if (code === 0) {
      // Parse wlr-randr output: "DP-1 1920x1080 @0,0"
      const lines = stdout.split('\n')
      for (const line of lines) {
        const match = line.match(/(\d+)x(\d+)\s+@\d+,(\d+)/)
        if (match) {
          const width = parseInt(match[1], 10)
          const height = parseInt(match[2], 10)
          const originX = 0
          const originY = parseInt(match[3], 10)
          return { displayId: 0, width, height, scaleFactor: 1, originX, originY }
        }
        // Alternative format: "1920x1080+0+0"
        const altMatch = line.match(/(\d+)x(\d+)\+(\d+)\+(\d+)/)
        if (altMatch) {
          return {
            displayId: 0,
            width: parseInt(altMatch[1], 10),
            height: parseInt(altMatch[2], 10),
            scaleFactor: 1,
            originX: parseInt(altMatch[3], 10),
            originY: parseInt(altMatch[4], 10),
          }
        }
      }
    }
  }

  // KDE Plasma Wayland
  if (compositor === 'kde') {
    // Try kscreen-doctor (KDE's equivalent to xrandr)
    const { stdout, code } = await execFileNoThrow('kscreen-doctor', ['-o'], { useCwd: false })
    if (code === 0) {
      const match = stdout.match(/(\d+)x(\d+)\+\d+\+\d+/)
      if (match) {
        return {
          displayId: 0,
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
          scaleFactor: 1,
          originX: 0,
          originY: 0,
        }
      }
    }
    // Fallback: query KWin directly via dbus
    const { stdout: dbusOut, code: dbusCode } = await execFileNoThrow(
      'qdbus', ['org.kde.KWin', '/KWin', 'org.kde.KWin.currentDesktop'], { useCwd: false },
    )
    if (dbusCode === 0) {
      // At least KWin is running, try to get screen size from KWin config
      const { stdout: sizeOut, code: sizeCode } = await execFileNoThrow(
        'kreadconfig5', ['--file', 'kwinrc', '--group', 'Windows', '--key', 'OneWinMode'], { useCwd: false },
      )
      if (sizeCode === 0) {
        // Fallback to reasonable defaults for KDE
        return { displayId: 0, width: 1920, height: 1080, scaleFactor: 1, originX: 0, originY: 0 }
      }
    }
  }

  // GNOME Shell
  if (compositor === 'gnome') {
    const { stdout, code } = await execFileNoThrow(
      'busctl', ['--user', 'call', 'org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval', 's', 'global.display.get_primary_monitor().get_geometry().width'],
      { useCwd: false },
    )
    // GNOME's approach is complex, fallback to GNOME-randr or just use defaults
    const { stdout: gnomeOut, code: gnomeCode } = await execFileNoThrow(
      'busctl', ['--user', 'call', 'org.gnome.Mutter.DisplayConfig', '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig', 'GetCurrentState'],
      { useCwd: false },
    )
    if (gnomeCode === 0) {
      // Parse the mutter state if possible, for now return default
      return { displayId: 0, width: 1920, height: 1080, scaleFactor: 1, originX: 0, originY: 0 }
    }
  }

  // Generic fallback using swaymsg or wayland-info
  const { stdout: swayOut, code: swayCode } = await execFileNoThrow(
    'swaymsg', ['-t', 'get_outputs'], { useCwd: false },
  )
  if (swayCode === 0) {
    try {
      const outputs = JSON.parse(swayOut)
      if (Array.isArray(outputs) && outputs.length > 0) {
        const out = outputs[0]
        return {
          displayId: 0,
          width: out.width || out.current_mode?.width || 1920,
          height: out.height || out.current_mode?.height || 1080,
          scaleFactor: out.scale || 1,
          originX: out.rect?.x || 0,
          originY: out.rect?.y || 0,
        }
      }
    } catch {
      // JSON parse failed
    }
  }

  // Last resort: use grim to capture and identify
  const tmpFile = `/tmp/claude-code-geom-${Date.now()}.png`
  try {
    const { code: grimCode } = await execFileNoThrow('grim', [tmpFile], { useCwd: false })
    if (grimCode === 0) {
      const { stdout: idOut, code: idCode } = await execFileNoThrow('identify', ['-format', '%w %h', tmpFile], { useCwd: false })
      if (idCode === 0) {
        const [width, height] = idOut.trim().split(' ').map(Number)
        return { displayId: 0, width, height, scaleFactor: 1, originX: 0, originY: 0 }
      }
    }
  } finally {
    await execFileNoThrow('rm', ['-f', tmpFile], { useCwd: false })
  }

  // Ultimate fallback: environment variables or defaults
  const width = parseInt(process.env.WAYLAND_DISPLAY_WIDTH || '1920', 10)
  const height = parseInt(process.env.WAYLAND_DISPLAY_HEIGHT || '1080', 10)
  return { displayId: 0, width, height, scaleFactor: 1, originX: 0, originY: 0 }
}

/**
 * Detect which Wayland compositor is running.
 */
async function detectWaylandCompositor(): Promise<string> {
  // Check environment variables first
  if (process.env.SWAY_SESSION_VERSION || process.env.SWAYSOCK) return 'sway'
  if (process.env.KDE_FULL_SESSION || process.env.KDE_SESSION_VERSION) return 'kde'
  if (process.env.GNOME_DESKTOP_SESSION_ID || process.env.GNOME_SHELL_DISABLE_WORKAROUND) return 'gnome'

  // Check for wlr-randr (wlroots-based)
  const { code: wlrCode } = await execFileNoThrow('which', ['wlr-randr'], { useCwd: false })
  if (wlrCode === 0) {
    // Check if it's actually sway or another wlroots compositor
    const { code: swayCode } = await execFileNoThrow('which', ['swaymsg'], { useCwd: false })
    if (swayCode === 0) return 'sway'
    return 'wlroots'
  }

  // Check for KDE-specific tools
  const { code: kdeCode } = await execFileNoThrow('which', ['kscreen-doctor'], { useCwd: false })
  if (kdeCode === 0) return 'kde'

  // Check for GNOME
  const { code: gnomeCode } = await execFileNoThrow('which', ['gnome-shell'], { useCwd: false })
  if (gnomeCode === 0) return 'gnome'

  return 'wayland'
}

/**
 * Find which display(s) a window is on using Wayland compositor tools.
 */
async function findWindowDisplaysWayland(
  bundleIds: string[],
): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
  const compositor = await detectWaylandCompositor()

  if (compositor === 'sway') {
    const { stdout, code } = await execFileNoThrow('swaymsg', ['-t', 'get_tree', '-r'], { useCwd: false })
    if (code !== 0 || !stdout) return []

    try {
      const tree = JSON.parse(stdout)
      const results: Array<{ bundleId: string; displayIds: number[] }> = []

      // Get outputs with their rects
      const outputs: Array<{ id: string; rect: { x: number; y: number; width: number; height: number } }> = []
      const collectOutputs = (node: any) => {
        if (node.type === 'output' && node.rect) {
          outputs.push({ id: node.name || node.id, rect: node.rect })
        }
        if (node.nodes) node.nodes.forEach(collectOutputs)
        if (node.floating_nodes) node.floating_nodes.forEach(collectOutputs)
      }
      collectOutputs(tree)

      // For each requested bundleId, find windows and check which output they're on
      for (const bundleId of bundleIds) {
        const windowDisplays: number[] = []
        const findWindows = (node: any) => {
          if (node.type === 'window' && node.app_id) {
            if (node.app_id === bundleId || node.name?.includes(bundleId)) {
              // Find which output this window is on
              const winRect = node.rect
              if (winRect) {
                for (let i = 0; i < outputs.length; i++) {
                  const out = outputs[i]
                  if (
                    winRect.x >= out.rect.x &&
                    winRect.x < out.rect.x + out.rect.width &&
                    winRect.y >= out.rect.y &&
                    winRect.y < out.rect.y + out.rect.height
                  ) {
                    if (!windowDisplays.includes(i)) {
                      windowDisplays.push(i)
                    }
                  }
                }
              }
            }
          }
          if (node.nodes) node.nodes.forEach(findWindows)
          if (node.floating_nodes) node.floating_nodes.forEach(findWindows)
        }
        findWindows(tree)
        if (windowDisplays.length > 0) {
          results.push({ bundleId, displayIds: windowDisplays })
        }
      }
      return results
    } catch {
      return []
    }
  }

  // For other Wayland compositors, return empty (complex to implement)
  return []
}

/**
 * Find which display(s) a window is on using X11 tools.
 */
async function findWindowDisplaysX11(
  bundleIds: string[],
): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
  const results: Array<{ bundleId: string; displayIds: number[] }> = []

  // Get screen info from xrandr
  const { stdout: xrOut, code: xrCode } = await execFileNoThrow('xrandr', ['--listactivemonitors'], { useCwd: false })
  if (xrCode !== 0) return []

  // Parse xrandr output to get monitor rects
  // Format: "  0: +*DP-0 1920x1080+0+0  ..."
  const monitors: Array<{ id: number; x: number; y: number; width: number; height: number }> = []
  const lines = xrOut.split('\n')
  let monitorId = 0
  for (const line of lines) {
    const match = line.match(/\+\d+\+(\d+)\s+\[(\d+)x(\d+)\]/)
    if (match) {
      monitors.push({
        id: monitorId++,
        x: parseInt(match[1], 10),
        y: parseInt(match[2], 10),
        width: parseInt(match[3], 10),
        height: parseInt(match[4], 10),
      })
    }
  }

  // For each bundleId, search for windows and check which monitor they're on
  for (const bundleId of bundleIds) {
    const windowDisplays: number[] = []

    // Search for windows by class name
    const { stdout: searchOut, code: searchCode } = await execFileNoThrow(
      'xdotool', ['search', '--class', bundleId], { useCwd: false },
    )
    if (searchCode !== 0) continue

    const windowIds = searchOut.trim().split('\n').filter(id => id.length > 0)
    for (const windowId of windowIds) {
      // Get window geometry
      const { stdout: geomOut, code: geomCode } = await execFileNoThrow(
        'xdotool', ['getwindowgeometry', '--shell', windowId], { useCwd: false },
      )
      if (geomCode !== 0) continue

      // Parse geometry output
      let winX = 0, winY = 0
      for (const line of geomOut.split('\n')) {
        if (line.startsWith('X=')) winX = parseInt(line.slice(2), 10)
        if (line.startsWith('Y=')) winY = parseInt(line.slice(2), 10)
      }

      // Find which monitor contains this window's top-left corner
      for (const monitor of monitors) {
        if (
          winX >= monitor.x &&
          winX < monitor.x + monitor.width &&
          winY >= monitor.y &&
          winY < monitor.y + monitor.height
        ) {
          if (!windowDisplays.includes(monitor.id)) {
            windowDisplays.push(monitor.id)
          }
        }
      }
    }

    if (windowDisplays.length > 0) {
      results.push({ bundleId, displayIds: windowDisplays })
    }
  }

  return results
}

/**
 * Animated mouse movement for Linux using ease-out-cubic at 60fps.
 * Mirrors the macOS animatedMove implementation.
 */
async function animatedMoveLinux(
  input: LinuxInput,
  targetX: number,
  targetY: number,
  mouseAnimationEnabled: boolean,
): Promise<void> {
  if (!mouseAnimationEnabled) {
    await moveAndSettleLinux(input, targetX, targetY)
    return
  }
  const start = await input.mouseLocation()
  const deltaX = targetX - start.x
  const deltaY = targetY - start.y
  const distance = Math.hypot(deltaX, deltaY)
  if (distance < 1) return
  const durationSec = Math.min(distance / 2000, 0.5)
  if (durationSec < 0.03) {
    await moveAndSettleLinux(input, targetX, targetY)
    return
  }
  const frameRate = 60
  const frameIntervalMs = 1000 / frameRate
  const totalFrames = Math.floor(durationSec * frameRate)
  for (let frame = 1; frame <= totalFrames; frame++) {
    const t = frame / totalFrames
    const eased = 1 - Math.pow(1 - t, 3)
    await input.moveMouse(
      Math.round(start.x + deltaX * eased),
      Math.round(start.y + deltaY * eased),
      false,
    )
    if (frame < totalFrames) {
      await sleep(frameIntervalMs)
    }
  }
  // Last frame has no trailing sleep
  await sleep(LINUX_MOVE_SETTLE_MS)
}

/**
 * Get display geometry using appropriate method for session type.
 */
async function getLinuxDisplayGeometry(displayId?: number): Promise<DisplayGeometry> {
  if (isWaylandSession()) {
    return getWaylandDisplayGeometry()
  }
  return getX11DisplayGeometry(displayId)
}

/**
 * Capture screenshot on X11 using import or scrot.
 */
async function captureX11Screenshot(targetWidth?: number, targetHeight?: number): Promise<{ base64: string; width: number; height: number }> {
  const tmpFile = `/tmp/claude-code-screenshot-${Date.now()}.png`

  try {
    // Try import first (ImageMagick)
    const { code: importCode } = await execFileNoThrow(
      'import', ['-window', 'root', '-quality', String(LINUX_SCREENSHOT_QUALITY), tmpFile], { useCwd: false },
    )

    if (importCode !== 0) {
      // Fallback to scrot
      const { code: scrotCode } = await execFileNoThrow('scrot', [tmpFile], { useCwd: false })
      if (scrotCode !== 0) {
        throw new Error('Both import and scrot failed to capture screenshot')
      }
    }

    const { stdout: imgData, code: imgCode } = await execFileNoThrow('base64', ['-w', '0', tmpFile], { useCwd: false })
    if (imgCode !== 0) throw new Error('Failed to base64 encode screenshot')

    const { stdout: idOut } = await execFileNoThrow('identify', ['-format', '%w %h', tmpFile], { useCwd: false })
    const [width, height] = idOut.trim().split(' ').map(Number)

    return { base64: imgData.trim(), width: targetWidth ?? width ?? 1920, height: targetHeight ?? height ?? 1080 }
  } finally {
    await execFileNoThrow('rm', ['-f', tmpFile], { useCwd: false })
  }
}

/**
 * Capture screenshot on Wayland using grim.
 */
async function captureWaylandScreenshot(targetWidth?: number, targetHeight?: number): Promise<{ base64: string; width: number; height: number }> {
  const tmpFile = `/tmp/claude-code-screenshot-${Date.now()}.png`

  try {
    // grim captures the screen
    const { code: grimCode } = await execFileNoThrow('grim', [tmpFile], { useCwd: false })
    if (grimCode !== 0) {
      throw new Error('grim failed to capture screenshot')
    }

    const { stdout: imgData, code: imgCode } = await execFileNoThrow('base64', ['-w', '0', tmpFile], { useCwd: false })
    if (imgCode !== 0) throw new Error('Failed to base64 encode screenshot')

    const { stdout: idOut } = await execFileNoThrow('identify', ['-format', '%w %h', tmpFile], { useCwd: false })
    const [width, height] = idOut.trim().split(' ').map(Number)

    return { base64: imgData.trim(), width: targetWidth ?? width ?? 1920, height: targetHeight ?? height ?? 1080 }
  } finally {
    await execFileNoThrow('rm', ['-f', tmpFile], { useCwd: false })
  }
}

/**
 * Capture screenshot using appropriate method for session type.
 */
async function captureLinuxScreenshot(targetWidth?: number, targetHeight?: number): Promise<{ base64: string; width: number; height: number }> {
  if (isWaylandSession()) {
    return captureWaylandScreenshot(targetWidth, targetHeight)
  }
  return captureX11Screenshot(targetWidth, targetHeight)
}

/**
 * Read clipboard via xclip (X11) or wl-paste (Wayland).
 */
async function readClipboardLinux(): Promise<string> {
  if (isWaylandSession()) {
    const { stdout, code } = await execFileNoThrow('wl-paste', [], { useCwd: false })
    if (code !== 0) throw new Error(`wl-paste failed with code ${code}`)
    return stdout
  } else {
    const { stdout, code } = await execFileNoThrow('xclip', ['-selection', 'clipboard', '-o'], { useCwd: false })
    if (code !== 0) throw new Error(`xclip failed with code ${code}`)
    return stdout
  }
}

/**
 * Write to clipboard via xclip (X11) or wl-copy (Wayland).
 */
async function writeClipboardLinux(text: string): Promise<void> {
  if (isWaylandSession()) {
    const { code } = await execFileNoThrow('wl-copy', [], { input: text, useCwd: false })
    if (code !== 0) throw new Error(`wl-copy failed with code ${code}`)
  } else {
    const { code } = await execFileNoThrow('xclip', ['-selection', 'clipboard', '-i'], { input: text, useCwd: false })
    if (code !== 0) throw new Error(`xclip failed with code ${code}`)
  }
}

/**
 * Type text via clipboard method.
 */
async function typeViaClipboardLinux(input: LinuxInput, text: string): Promise<void> {
  let saved: string | undefined
  try {
    saved = await readClipboardLinux()
  } catch {
    logForDebugging('[computer-use-linux] clipboard before paste failed; proceeding without restore')
  }

  try {
    await writeClipboardLinux(text)
    if ((await readClipboardLinux()) !== text) {
      throw new Error('Clipboard write did not round-trip.')
    }
    await input.keys(['ctrl', 'v'])
    await sleep(100)
  } finally {
    if (typeof saved === 'string') {
      try {
        await writeClipboardLinux(saved)
      } catch {
        logForDebugging('[computer-use-linux] clipboard restore after paste failed')
      }
    }
  }
}

const LINUX_MOVE_SETTLE_MS = 50

async function moveAndSettleLinux(
  input: LinuxInput,
  x: number,
  y: number,
): Promise<void> {
  await input.moveMouse(x, y, false)
  await sleep(LINUX_MOVE_SETTLE_MS)
}

/**
 * Create a Linux ComputerExecutor using xdotool, ImageMagick/import, and xclip.
 */
export function createLinuxExecutor(opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  if (process.platform !== 'linux') {
    throw new Error(
      `createLinuxExecutor called on ${process.platform}. Linux executor is for Linux only.`,
    )
  }

  const input = requireLinuxInput()
  const terminalBundleId = getLinuxTerminalBundleId()
  const { getMouseAnimationEnabled } = opts

  logForDebugging(
    terminalBundleId
      ? `[computer-use-linux] terminal ${terminalBundleId}`
      : '[computer-use-linux] terminal not detected',
  )

  return {
    capabilities: {
      ...CLI_LINUX_CAPABILITIES,
      hostBundleId: terminalBundleId ?? 'linux-terminal',
    } as any, // Type doesn't include 'linux' platform, but we support it

    async prepareForAction(
      _allowlistBundleIds: string[],
      _displayId?: number,
    ): Promise<string[]> {
      // On Linux, xdotool operates on the focused window.
      // For now, no pre-action hiding is implemented.
      return []
    },

    async previewHideSet(
      _allowlistBundleIds: string[],
      _displayId?: number,
    ): Promise<Array<{ bundleId: string; displayName: string }>> {
      return []
    },

    async getDisplaySize(displayId?: number): Promise<DisplayGeometry> {
      return getLinuxDisplayGeometry(displayId)
    },

    async listDisplays(): Promise<DisplayGeometry[]> {
      // Linux typically has one display per screen
      const geom = await getLinuxDisplayGeometry(0)
      return [geom]
    },

    async findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      if (bundleIds.length === 0) return []

      if (isWaylandSession()) {
        return findWindowDisplaysWayland(bundleIds)
      } else {
        return findWindowDisplaysX11(bundleIds)
      }
    },

    async resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult> {
      const d = await getLinuxDisplayGeometry(opts.preferredDisplayId)
      const [targetW, targetH] = targetImageSize(d.width, d.height, API_RESIZE_PARAMS)

      const screenshot = await captureLinuxScreenshot(targetW, targetH)

      return {
        ...screenshot,
        displayWidth: d.width,
        displayHeight: d.height,
        originX: 0,
        originY: 0,
        displayId: opts.preferredDisplayId ?? 0,
        hidden: [],
      }
    },

    async screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult> {
      const d = await getLinuxDisplayGeometry(opts.displayId)
      const [targetW, targetH] = targetImageSize(d.width, d.height, API_RESIZE_PARAMS)

      const screenshot = await captureLinuxScreenshot(targetW, targetH)

      return {
        ...screenshot,
        displayWidth: d.width,
        displayHeight: d.height,
        originX: 0,
        originY: 0,
        displayId: opts.displayId,
      }
    },

    async zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      _allowedBundleIds: string[],
      _displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }> {
      const tmpFile = `/tmp/claude-code-zoom-${Date.now()}.png`

      try {
        if (isWaylandSession()) {
          // Use grim with slurp for Wayland region selection
          // First get full screenshot, then crop (grim doesn't support region directly)
          await execFileNoThrow('grim', ['-g', `${regionLogical.x},${regionLogical.y} ${regionLogical.w}x${regionLogical.h}`, tmpFile], { useCwd: false })
        } else {
          // X11: use import with crop
          const importArgs = [
            '-window', 'root',
            '-quality', String(LINUX_SCREENSHOT_QUALITY),
            '-crop',
            `${regionLogical.w}x${regionLogical.h}+${regionLogical.x}+${regionLogical.y}`,
            tmpFile,
          ]
          await execFileNoThrow('import', importArgs, { useCwd: false })
        }

        const { stdout: imgData, code: imgCode } = await execFileNoThrow('base64', ['-w', '0', tmpFile], { useCwd: false })
        if (imgCode !== 0) throw new Error('Failed to base64 encode zoom screenshot')

        return { base64: imgData.trim(), width: regionLogical.w, height: regionLogical.h }
      } finally {
        await execFileNoThrow('rm', ['-f', tmpFile], { useCwd: false })
      }
    },

    // ── Keyboard ─────────────────────────────────────────────────────────

    async key(keySequence: string, repeat?: number): Promise<void> {
      const parts = keySequence.split('+').filter(p => p.length > 0)
      const n = repeat ?? 1
      for (let i = 0; i < n; i++) {
        if (i > 0) await sleep(8)
        await input.keys(parts)
      }
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      for (const k of keyNames) {
        await input.key(k, 'press')
      }
      await sleep(durationMs)
      for (const k of keyNames.reverse()) {
        await input.key(k, 'release')
      }
    },

    async type(text: string, opts: { viaClipboard: boolean }): Promise<void> {
      if (opts.viaClipboard) {
        await typeViaClipboardLinux(input, text)
        return
      }
      await input.typeText(text)
    },

    readClipboard: readClipboardLinux,

    writeClipboard: writeClipboardLinux,

    // ── Mouse ───────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      await animatedMoveLinux(input, x, y, getMouseAnimationEnabled())
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void> {
      await animatedMoveLinux(input, x, y, getMouseAnimationEnabled())
      if (modifiers && modifiers.length > 0) {
        // Press modifiers, click, release modifiers
        const pressed: string[] = []
        try {
          for (const m of modifiers) {
            await input.key(m, 'press')
            pressed.push(m)
          }
          for (let i = 0; i < count; i++) {
            await input.mouseButton(button, 'click', 1)
          }
        } finally {
          for (const m of pressed.reverse()) {
            await input.key(m, 'release')
          }
        }
      } else {
        for (let i = 0; i < count; i++) {
          await input.mouseButton(button, 'click', 1)
        }
      }
    },

    async mouseDown(): Promise<void> {
      await input.mouseButton('left', 'press')
    },

    async mouseUp(): Promise<void> {
      await input.mouseButton('left', 'release')
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      return input.mouseLocation()
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      if (from !== undefined) {
        await moveAndSettleLinux(input, from.x, from.y)
      }
      await input.mouseButton('left', 'press')
      await sleep(LINUX_MOVE_SETTLE_MS)
      try {
        // Use animated move for drag destination (same as macOS)
        await animatedMoveLinux(input, to.x, to.y, getMouseAnimationEnabled())
      } finally {
        await input.mouseButton('left', 'release')
      }
    },

    async scroll(x: number, y: number, dx: number, dy: number): Promise<void> {
      await animatedMoveLinux(input, x, y, getMouseAnimationEnabled())
      if (dy !== 0) {
        await input.mouseScroll('vertical', dy)
      }
      if (dx !== 0) {
        await input.mouseScroll('horizontal', dx)
      }
    },

    // ── App management ───────────────────────────────────────────────────

    async getFrontmostApp(): Promise<FrontmostApp | null> {
      const info = await input.getFrontmostAppInfo()
      if (!info) return null
      return { bundleId: info.bundleId, displayName: info.appName }
    },

    async appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null> {
      return input.appUnderPoint(x, y)
    },

    async listInstalledApps(): Promise<InstalledApp[]> {
      // Parse .desktop files from system and user application directories
      const desktopDirs = [
        '/usr/share/applications',
        '/usr/local/share/applications',
        homedir() + '/.local/share/applications',
      ]

      const appsMap = new Map<string, InstalledApp>()

      for (const dir of desktopDirs) {
        try {
          const { stdout: lsOut, code } = await execFileNoThrow(
            'ls',
            ['-1', dir],
            { useCwd: false },
          )
          if (code !== 0) continue

          const files = lsOut.trim().split('\n').filter(f => f.endsWith('.desktop'))
          for (const file of files.slice(0, 200)) { // Cap at 200 for performance
            const filePath = `${dir}/${file}`
            const entry = await parseDesktopFile(filePath)
            if (!entry || !entry.name || !entry.exec) continue

            // Skip if already added
            const bundleId = filePath.split('/').pop()!.replace('.desktop', '')
            if (appsMap.has(bundleId)) continue

            appsMap.set(bundleId, {
              bundleId,
              displayName: entry.name,
              path: entry.exec,
              iconDataUrl: undefined, // Icon loaded lazily via getAppIcon
            })
          }
        } catch {
          // Directory might not exist, skip
        }
      }

      return Array.from(appsMap.values())
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 500) // Cap at 500 apps
    },

    async getAppIcon(path: string): Promise<string | undefined> {
      // path could be a .desktop file path or an executable path
      // First try to find the .desktop file if we got an executable path
      const desktopPath = path.endsWith('.desktop')
        ? path
        : await findDesktopFileByExec(path)

      if (!desktopPath) return undefined

      const iconRef = await getIconFromDesktopFile(desktopPath)
      if (!iconRef) return undefined

      // iconRef could be an absolute path, a theme icon name, or just a filename
      const iconPath = resolveIconPath(iconRef)
      if (!iconPath) return undefined

      return encodeIconToBase64(iconPath)
    },

    async listRunningApps(): Promise<RunningApp[]> {
      return input.listRunningApps()
    },

    async openApp(bundleId: string): Promise<void> {
      // Try to open the app using xdg-open
      await execFileNoThrow('xdg-open', [bundleId], { useCwd: false })
    },
  }
}

