/**
 * Wayland input wrapper using ydotool for mouse, keyboard, and window operations.
 *
 * ydotool uses Wayland protocols to simulate input events. This module provides
 * a similar API to xdotool so the executor can work on Wayland compositors
 * (Sway, KDE Wayland, GNOME Wayland, etc.).
 *
 * Required tools: ydotool, grim, wl-copy, wl-paste
 */

import { execFileNoThrow } from '../execFileNoThrow.js'
import { logForDebugging } from '../debug.js'

export interface WaylandInputAPI {
  // Mouse
  moveMouse(x: number, y: number, animated: boolean): Promise<void>
  mouseLocation(): Promise<{ x: number; y: number }>
  mouseButton(
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'press' | 'release',
    count?: number,
  ): Promise<void>
  mouseScroll(direction: 'vertical' | 'horizontal', amount: number): Promise<void>

  // Keyboard
  key(
    key: string,
    action: 'press' | 'release' | 'click',
  ): Promise<void>
  keys(keys: string[]): Promise<void>
  typeText(text: string): Promise<void>

  // Window/App info
  getFrontmostAppInfo(): Promise<{
    bundleId: string
    appName: string
  } | null>
  appUnderPoint(x: number, y: number): Promise<{
    bundleId: string
    displayName: string
  } | null>
  listRunningApps(): Promise<Array<{
    bundleId: string
    displayName: string
    pid?: number
  }>>
}

let cached: WaylandInputAPI | undefined

/**
 * Map key names to ydotool key codes.
 * ydotool uses key codes like KEY_ESC, KEY_ENTER, etc.
 */
function mapKeyToYdotool(key: string): string {
  const keyMap: Record<string, string> = {
    escape: 'KEY_ESC',
    esc: 'KEY_ESC',
    enter: 'KEY_ENTER',
    return: 'KEY_ENTER',
    tab: 'KEY_TAB',
    backspace: 'KEY_BACKSPACE',
    delete: 'KEY_DELETE',
    up: 'KEY_UP',
    down: 'KEY_DOWN',
    left: 'KEY_LEFT',
    right: 'KEY_RIGHT',
    space: 'KEY_SPACE',
    home: 'KEY_HOME',
    end: 'KEY_END',
    pageup: 'KEY_PAGEUP',
    pagedown: 'KEY_PAGEDOWN',
    f1: 'KEY_F1',
    f2: 'KEY_F2',
    f3: 'KEY_F3',
    f4: 'KEY_F4',
    f5: 'KEY_F5',
    f6: 'KEY_F6',
    f7: 'KEY_F7',
    f8: 'KEY_F8',
    f9: 'KEY_F9',
    f10: 'KEY_F10',
    f11: 'KEY_F11',
    f12: 'KEY_F12',
    // Modifiers
    ctrl: 'KEY_LEFTCTRL',
    control: 'KEY_LEFTCTRL',
    shift: 'KEY_LEFTSHIFT',
    alt: 'KEY_LEFTALT',
    meta: 'KEY_LEFTMETA',
    super: 'KEY_LEFTMETA',
    windows: 'KEY_LEFTMETA',
    // Letters
    a: 'KEY_A', b: 'KEY_B', c: 'KEY_C', d: 'KEY_D', e: 'KEY_E',
    f: 'KEY_F', g: 'KEY_G', h: 'KEY_H', i: 'KEY_I', j: 'KEY_J',
    k: 'KEY_K', l: 'KEY_L', m: 'KEY_M', n: 'KEY_N', o: 'KEY_O',
    p: 'KEY_P', q: 'KEY_Q', r: 'KEY_R', s: 'KEY_S', t: 'KEY_T',
    u: 'KEY_U', v: 'KEY_V', w: 'KEY_W', x: 'KEY_X', y: 'KEY_Y',
    z: 'KEY_Z',
    // Numbers
    '0': 'KEY_0', '1': 'KEY_1', '2': 'KEY_2', '3': 'KEY_3',
    '4': 'KEY_4', '5': 'KEY_5', '6': 'KEY_6', '7': 'KEY_7',
    '8': 'KEY_8', '9': 'KEY_9',
  }
  const lower = key.toLowerCase()
  if (keyMap[lower]) return keyMap[lower]
  // Assume it's already a ydotool key code if not in map
  return key.toUpperCase()
}

function mapButton(button: 'left' | 'right' | 'middle'): string {
  switch (button) {
    case 'left':
      return 'BTN_LEFT'
    case 'right':
      return 'BTN_RIGHT'
    case 'middle':
      return 'BTN_MIDDLE'
  }
}

async function runYdotool(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const result = await execFileNoThrow('ydotool', args, { useCwd: false })
  return result
}

async function runYdotoolNoCheck(args: string[]): Promise<string> {
  const { stdout, code } = await runYdotool(args)
  if (code !== 0) {
    logForDebugging(`[wayland-input] ydotool ${args[0]} failed: ${stdout}`)
  }
  return stdout
}

/**
 * Get the active Wayland compositor name.
 */
async function getCompositor(): Promise<string> {
  // Check WAYLAND_DISPLAY to confirm we're on Wayland
  const waylandDisplay = process.env.WAYLAND_DISPLAY
  if (!waylandDisplay) {
    return 'unknown'
  }

  // Check for Sway
  if (process.env.SWAYNC_CLIPBOARD || process.env.SWAYSOCK) {
    return 'sway'
  }

  // Check for KDE
  if (process.env.KDE_FULL_SESSION || process.env.KDE_SESSION_VERSION) {
    return 'kde'
  }

  // Check for GNOME
  if (process.env.GNOME_DESKTOP_SESSION_ID || process.env.DESKTOP_SESSION?.includes('gnome')) {
    return 'gnome'
  }

  // Try to detect via wlrctl or other tools
  const { code } = await execFileNoThrow('which', ['swaymsg'], { useCwd: false })
  if (code === 0) {
    return 'sway'
  }

  return 'wayland'
}

/**
 * Get focused window info using compositor-specific tools.
 */
async function getFocusedWindowWayland(): Promise<{ bundleId: string; appName: string } | null> {
  const compositor = await getCompositor()

  try {
    if (compositor === 'sway') {
      // Sway has swaymsg to get focused window
      const { stdout, code } = await execFileNoThrow(
        'swaymsg',
        ['-t', 'get_focused'],
        { useCwd: false },
      )
      if (code === 0 && stdout) {
        // Parse JSON response
        const window = JSON.parse(stdout)
        return {
          bundleId: window.app_id || window.window_properties?.instance || 'unknown',
          appName: window.name || window.title || 'Unknown',
        }
      }
    } else if (compositor === 'gnome') {
      // GNOME: use xdotool fallback or gdbus
      // Actually GNOME on Wayland doesn't support xdotool, try GNOME Shell eval
      const { stdout, code } = await execFileNoThrow(
        'busctl',
        ['--user', 'call', 'org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval', 's', 'global.display.get_focus_window().get_id()'],
        { useCwd: false },
      )
      if (code === 0) {
        // Returns window ID, but we need app info...
        return { bundleId: 'gnome-shell', appName: 'GNOME Shell' }
      }
    } else if (compositor === 'kde') {
      // KDE Plasma Wayland
      const { stdout, code } = await execFileNoThrow(
        'qdbus',
        ['org.kde.KWin', '/KWin', 'org.kde.KWin.activeWindow'],
        { useCwd: false },
      )
      if (code === 0 && stdout) {
        const windowId = stdout.trim()
        // Try to get window name from KWin
        try {
          const { stdout: nameOut } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', `/KWin/Windows/${windowId}`, 'org.kde.KWin.Window.resourceName'],
            { useCwd: false },
          )
          if (nameOut && nameOut.trim()) {
            return {
              bundleId: windowId,
              appName: nameOut.trim(),
            }
          }
        } catch {}
        return {
          bundleId: windowId,
          appName: `Window ${windowId}`,
        }
      }
    }
  } catch (err) {
    logForDebugging(`[wayland-input] Failed to get focused window: ${err}`)
  }

  // Fallback
  return { bundleId: 'wayland', appName: 'Wayland Session' }
}

/**
 * Get window/app at point using compositor tools.
 */
async function getWindowAtPointWayland(x: number, y: number): Promise<{ bundleId: string; displayName: string } | null> {
  const compositor = await getCompositor()

  try {
    if (compositor === 'sway') {
      const { stdout, code } = await execFileNoThrow(
        'swaymsg',
        ['-t', 'get_tree', '-r'],
        { useCwd: false },
      )
      if (code === 0 && stdout) {
        const tree = JSON.parse(stdout)
        // Find node at coordinates recursively
        const findAtPoint = (node: any, px: number, py: number): any => {
          if (node.type === 'window' && node.rect) {
            const rect = node.rect
            if (px >= rect.x && px < rect.x + rect.width && py >= rect.y && py < rect.y + rect.height) {
              return node
            }
          }
          if (node.nodes) {
            for (const child of node.nodes) {
              const found = findAtPoint(child, px, py)
              if (found) return found
            }
          }
          if (node.floating_nodes) {
            for (const child of node.floating_nodes) {
              const found = findAtPoint(child, px, py)
              if (found) return found
            }
          }
          return null
        }

        const window = findAtPoint(tree, x, y)
        if (window) {
          return {
            bundleId: window.app_id || 'unknown',
            displayName: window.name || 'Unknown',
          }
        }
      }
    }
  } catch (err) {
    logForDebugging(`[wayland-input] Failed to get window at point: ${err}`)
  }

  return null
}

export function requireWaylandInput(): WaylandInputAPI {
  if (cached) return cached

  cached = {
    async moveMouse(x: number, y: number, _animated: boolean): Promise<void> {
      // ydotool uses absolute positioning with "mousemove -- x y"
      const { code, stderr } = await runYdotool(['mousemove', String(x), String(y)])
      if (code !== 0) {
        throw new Error(`ydotool mousemove failed: ${stderr}`)
      }
    },

    async mouseLocation(): Promise<{ x: number; y: number }> {
      // ydotool doesn't have a direct "get mouse location" command
      // Try using swaymsg or other compositor tools
      const compositor = await getCompositor()

      if (compositor === 'sway') {
        const { stdout, code } = await execFileNoThrow(
          'swaymsg',
          ['-t', 'get_seat', '--raw'],
          { useCwd: false },
        )
        if (code === 0) {
          try {
            const seats = JSON.parse(stdout)
            if (seats && seats.length > 0) {
              const cursor = seats[0].cursor
              if (cursor) {
                return { x: cursor.x, y: cursor.y }
              }
            }
          } catch {
            // Parse error, fall through
          }
        }
      } else if (compositor === 'kde') {
        // KDE Plasma Wayland: use qdbus to get cursor position
        try {
          const { stdout, code } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', '/KWin', 'org.kde.KWin.Cursor', 'pos'],
            { useCwd: false },
          )
          if (code === 0 && stdout) {
            const parts = stdout.trim().split(',')
            if (parts.length === 2) {
              return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) }
            }
          }
        } catch {}
        // Try alternate path
        try {
          const { stdout, code } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', '/Cursor', 'pos'],
            { useCwd: false },
          )
          if (code === 0 && stdout) {
            const parts = stdout.trim().split(' ')
            if (parts.length >= 2) {
              return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) }
            }
          }
        } catch {}
      }

      // Fallback: return 0,0 - executor should track position
      return { x: 0, y: 0 }
    },

    async mouseButton(
      button: 'left' | 'right' | 'middle',
      action: 'click' | 'press' | 'release',
      count: number = 1,
    ): Promise<void> {
      const btn = mapButton(button)
      let cmd: string[]

      if (action === 'click') {
        cmd = ['click', btn]
      } else if (action === 'press') {
        cmd = ['mousedown', btn]
      } else {
        cmd = ['mouseup', btn]
      }

      const { code, stderr } = await runYdotool(cmd)
      if (code !== 0) {
        throw new Error(`ydotool ${cmd[0]} failed: ${stderr}`)
      }

      // Handle multiple clicks
      if (action === 'click' && count > 1) {
        for (let i = 1; i < count; i++) {
          await runYdotool(cmd)
        }
      }
    },

    async mouseScroll(direction: 'vertical' | 'horizontal', amount: number): Promise<void> {
      // ydotool uses click-based scroll emulation
      // 4=up, 5=down, 6=left, 7=right
      const clicks = Math.abs(amount)
      const sign = amount > 0 ? 1 : -1

      for (let i = 0; i < clicks; i++) {
        let btn: string
        if (direction === 'vertical') {
          btn = sign > 0 ? '4' : '5'
        } else {
          btn = sign > 0 ? '6' : '7'
        }

        const { code, stderr } = await runYdotool(['click', btn])
        if (code !== 0) {
          throw new Error(`ydotool click scroll failed: ${stderr}`)
        }
      }
    },

    async key(
      key: string,
      action: 'press' | 'release' | 'click',
    ): Promise<void> {
      const mapped = mapKeyToYdotool(key)
      let cmd: string[]

      if (action === 'click') {
        cmd = ['key', mapped]
      } else if (action === 'press') {
        cmd = ['keydown', mapped]
      } else {
        cmd = ['keyup', mapped]
      }

      const { code, stderr } = await runYdotool(cmd)
      if (code !== 0) {
        throw new Error(`ydotool ${cmd[0]} failed: ${stderr}`)
      }
    },

    async keys(keys: string[]): Promise<void> {
      // ydotool key accepts single key or combo
      // For combos, use the combined key code like KEY_LEFTCTRL+KEY_A
      const mapped = keys.map(mapKeyToYdotool).join('+')
      const { code, stderr } = await runYdotool(['key', '--', mapped])
      if (code !== 0) {
        throw new Error(`ydotool key failed: ${stderr}`)
      }
    },

    async typeText(text: string): Promise<void> {
      // ydotool type for text input
      const { code, stderr } = await runYdotool(['type', '--', text])
      if (code !== 0) {
        throw new Error(`ydotool type failed: ${stderr}`)
      }
    },

    async getFrontmostAppInfo(): Promise<{ bundleId: string; appName: string } | null> {
      return getFocusedWindowWayland()
    },

    async appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null> {
      return getWindowAtPointWayland(x, y)
    },

    async listRunningApps(): Promise<Array<{ bundleId: string; displayName: string; pid?: number }>> {
      const compositor = await getCompositor()

      try {
        if (compositor === 'sway') {
          const { stdout, code } = await execFileNoThrow(
            'swaymsg',
            ['-t', 'get_tree', '-r'],
            { useCwd: false },
          )
          if (code === 0 && stdout) {
            const tree = JSON.parse(stdout)
            const appsMap = new Map<string, { bundleId: string; displayName: string; pid?: number }>()

            const collectWindows = (node: any) => {
              if (node.type === 'window' && node.app_id) {
                const bundleId = node.app_id
                if (!appsMap.has(bundleId)) {
                  appsMap.set(bundleId, {
                    bundleId,
                    displayName: node.name || node.title || bundleId,
                    pid: node.pid,
                  })
                }
              }
              if (node.nodes) {
                node.nodes.forEach(collectWindows)
              }
              if (node.floating_nodes) {
                node.floating_nodes.forEach(collectWindows)
              }
            }

            collectWindows(tree)
            return Array.from(appsMap.values())
          }
        }
      } catch (err) {
        logForDebugging(`[wayland-input] Failed to list apps: ${err}`)
      }

      return []
    },
  }

  return cached
}
