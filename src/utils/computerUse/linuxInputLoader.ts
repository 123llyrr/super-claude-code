/**
 * Unified Linux input loader that auto-detects X11 vs Wayland.
 *
 * Detects the session type by checking environment variables:
 * - X11: XDG_SESSION_TYPE=x11, DISPLAY is set, WAYLAND_DISPLAY is not
 * - Wayland: XDG_SESSION_TYPE=wayland, WAYLAND_DISPLAY is set
 *
 * Falls back to checking for X11 if WAYLAND_DISPLAY is not set.
 */

import { execFileNoThrow } from '../execFileNoThrow.js'
import { logForDebugging } from '../debug.js'

export interface LinuxInputAPI {
  moveMouse(x: number, y: number, animated: boolean): Promise<void>
  mouseLocation(): Promise<{ x: number; y: number }>
  mouseButton(
    button: 'left' | 'right' | 'middle',
    action: 'click' | 'press' | 'release',
    count?: number,
  ): Promise<void>
  mouseScroll(direction: 'vertical' | 'horizontal', amount: number): Promise<void>
  key(key: string, action: 'press' | 'release' | 'click'): Promise<void>
  keys(keys: string[]): Promise<void>
  typeText(text: string): Promise<void>
  getFrontmostAppInfo(): Promise<{ bundleId: string; appName: string } | null>
  appUnderPoint(x: number, y: number): Promise<{ bundleId: string; displayName: string } | null>
  listRunningApps(): Promise<Array<{ bundleId: string; displayName: string; pid?: number }>>
}

let cachedInput: LinuxInputAPI | undefined
let sessionType: 'x11' | 'wayland' | 'unknown' = 'unknown'

export function detectSessionType(): 'x11' | 'wayland' | 'unknown' {
  if (sessionType !== 'unknown') return sessionType

  const xdgSession = process.env.XDG_SESSION_TYPE?.toLowerCase()
  if (xdgSession === 'x11') { sessionType = 'x11'; return sessionType }
  if (xdgSession === 'wayland') { sessionType = 'wayland'; return sessionType }

  const hasDisplay = !!process.env.DISPLAY
  const hasWaylandDisplay = !!process.env.WAYLAND_DISPLAY

  if (hasWaylandDisplay && !hasDisplay) sessionType = 'wayland'
  else if (hasDisplay) sessionType = 'x11'

  logForDebugging(`[linux-input] Detected session type: ${sessionType}`)
  return sessionType
}

function checkCommandSync(cmd: string): boolean {
  try {
    const { execSync } = require('child_process')
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch { return false }
}

function initializeInput(): void {
  if (cachedInput) return

  const type = detectSessionType()
  logForDebugging(`[linux-input] Initializing ${type} input...`)

  if (type === 'wayland') {
    if (!checkCommandSync('ydotool')) {
      throw new Error('ydotool is required for Wayland support. Please install it.')
    }
    cachedInput = createWaylandInput()
  } else {
    if (!checkCommandSync('xdotool')) {
      throw new Error('xdotool is required for X11 support. Please install it.')
    }
    cachedInput = createX11Input()
  }
  logForDebugging('[linux-input] Input initialized successfully')
}

function createX11Input(): LinuxInputAPI {
  const keyMap: Record<string, string> = {
    escape: 'Escape', esc: 'Escape', enter: 'Return', return: 'Return',
    tab: 'Tab', backspace: 'BackSpace', delete: 'Delete', up: 'Up',
    down: 'Down', left: 'Left', right: 'Right', space: 'space',
    home: 'Home', end: 'End', pageup: 'Prior', pagedown: 'Next',
    f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
    f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
    ctrl: 'ctrl', control: 'ctrl', shift: 'shift', alt: 'alt',
    meta: 'meta', super: 'super', windows: 'super',
  }
  const btnMap: Record<string, string> = { left: '1', right: '2', middle: '3' }

  return {
    async moveMouse(x: number, y: number): Promise<void> {
      const { code, stderr } = await execFileNoThrow('xdotool', ['mousemove', '--', String(x), String(y)], { useCwd: false })
      if (code !== 0) throw new Error(`xdotool mousemove failed: ${stderr}`)
    },
    async mouseLocation(): Promise<{ x: number; y: number }> {
      const { stdout, code } = await execFileNoThrow('xdotool', ['getmouselocation', '--shell'], { useCwd: false })
      if (code !== 0) return { x: 0, y: 0 }
      let x = 0, y = 0
      for (const line of stdout.split('\n')) {
        if (line.startsWith('X=')) x = parseInt(line.slice(2), 10)
        if (line.startsWith('Y=')) y = parseInt(line.slice(2), 10)
      }
      return { x, y }
    },
    async mouseButton(button, action, count = 1): Promise<void> {
      const btn = btnMap[button]
      const cmd = action === 'click' ? ['click', '--repeat', String(count), btn]
        : action === 'press' ? ['mousedown', btn] : ['mouseup', btn]
      const { code, stderr } = await execFileNoThrow('xdotool', cmd, { useCwd: false })
      if (code !== 0) throw new Error(`xdotool ${cmd[0]} failed: ${stderr}`)
    },
    async mouseScroll(direction: 'vertical' | 'horizontal', amount: number): Promise<void> {
      const clicks = Math.abs(amount)
      const sign = amount > 0 ? 1 : -1
      const btn = direction === 'vertical' ? (sign > 0 ? '4' : '5') : (sign > 0 ? '6' : '7')
      for (let i = 0; i < clicks; i++) {
        const { code, stderr } = await execFileNoThrow('xdotool', ['click', '--repeat', '1', btn], { useCwd: false })
        if (code !== 0) throw new Error(`xdotool scroll failed: ${stderr}`)
      }
    },
    async key(key, action): Promise<void> {
      const mapped = keyMap[key.toLowerCase()] || key
      const cmd = action === 'click' ? ['key', mapped] : action === 'press' ? ['keydown', mapped] : ['keyup', mapped]
      const { code, stderr } = await execFileNoThrow('xdotool', cmd, { useCwd: false })
      if (code !== 0) throw new Error(`xdotool ${cmd[0]} failed: ${stderr}`)
    },
    async keys(keys): Promise<void> {
      const mapped = keys.map(k => keyMap[k.toLowerCase()] || k).join('+')
      const { code, stderr } = await execFileNoThrow('xdotool', ['key', '--', mapped], { useCwd: false })
      if (code !== 0) throw new Error(`xdotool key failed: ${stderr}`)
    },
    async typeText(text): Promise<void> {
      const { code, stderr } = await execFileNoThrow('xdotool', ['type', '--delay', '0', text], { useCwd: false })
      if (code !== 0) throw new Error(`xdotool type failed: ${stderr}`)
    },
    async getFrontmostAppInfo(): Promise<{ bundleId: string; appName: string } | null> {
      const { stdout, code } = await execFileNoThrow('xdotool', ['getwindowfocus', '-f', 'getwindowclassname'], { useCwd: false })
      if (code !== 0) return null
      const { stdout: nameOut } = await execFileNoThrow('xdotool', ['getwindowfocus', '-f', 'getwindowname'], { useCwd: false })
      return { bundleId: stdout.trim(), appName: nameOut.trim() || stdout.trim() }
    },
    async appUnderPoint(x, y): Promise<{ bundleId: string; displayName: string } | null> {
      const { stdout, code } = await execFileNoThrow('xdotool', ['mousemove', '--', String(x), String(y), 'getwindowclassname'], { useCwd: false })
      if (code !== 0) return null
      const { stdout: nameOut } = await execFileNoThrow('xdotool', ['mousemove', '--', String(x), String(y), 'getwindowname'], { useCwd: false })
      return { bundleId: stdout.trim(), displayName: nameOut.trim() || stdout.trim() }
    },
    async listRunningApps(): Promise<Array<{ bundleId: string; displayName: string; pid?: number }>> {
      const { stdout, code } = await execFileNoThrow('xdotool', ['search', '--onlyvisible', '--name', '.'], { useCwd: false })
      if (code !== 0) return []
      const windowIds = stdout.trim().split('\n').filter(id => id.length > 0).slice(0, 100)
      const appsMap = new Map<string, { bundleId: string; displayName: string; pid?: number }>()
      for (const windowId of windowIds) {
        const { stdout: classOut } = await execFileNoThrow('xdotool', ['getwindowclassname', windowId], { useCwd: false })
        const { stdout: nameOut } = await execFileNoThrow('xdotool', ['getwindowname', windowId], { useCwd: false })
        const { stdout: pidOut } = await execFileNoThrow('xdotool', ['getwindowpid', windowId], { useCwd: false })
        const bundleId = classOut.trim() || 'unknown'
        const pid = parseInt(pidOut.trim(), 10)
        if (!appsMap.has(bundleId)) {
          appsMap.set(bundleId, { bundleId, displayName: nameOut.trim() || 'Unknown', pid: isNaN(pid) ? undefined : pid })
        }
      }
      return Array.from(appsMap.values())
    },
  }
}

function createWaylandInput(): LinuxInputAPI {
  const keyMap: Record<string, string> = {
    escape: 'KEY_ESC', esc: 'KEY_ESC', enter: 'KEY_ENTER', return: 'KEY_ENTER',
    tab: 'KEY_TAB', backspace: 'KEY_BACKSPACE', delete: 'KEY_DELETE', up: 'KEY_UP',
    down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT', space: 'KEY_SPACE',
    home: 'KEY_HOME', end: 'KEY_END', pageup: 'KEY_PAGEUP', pagedown: 'KEY_PAGEDOWN',
    f1: 'KEY_F1', f2: 'KEY_F2', f3: 'KEY_F3', f4: 'KEY_F4', f5: 'KEY_F5', f6: 'KEY_F6',
    f7: 'KEY_F7', f8: 'KEY_F8', f9: 'KEY_F9', f10: 'KEY_F10', f11: 'KEY_F11', f12: 'KEY_F12',
    ctrl: 'KEY_LEFTCTRL', control: 'KEY_LEFTCTRL', shift: 'KEY_LEFTSHIFT', alt: 'KEY_LEFTALT',
    meta: 'KEY_LEFTMETA', super: 'KEY_LEFTMETA', windows: 'KEY_LEFTMETA',
    a: 'KEY_A', b: 'KEY_B', c: 'KEY_C', d: 'KEY_D', e: 'KEY_E',
    f: 'KEY_F', g: 'KEY_G', h: 'KEY_H', i: 'KEY_I', j: 'KEY_J',
    k: 'KEY_K', l: 'KEY_L', m: 'KEY_M', n: 'KEY_N', o: 'KEY_O',
    p: 'KEY_P', q: 'KEY_Q', r: 'KEY_R', s: 'KEY_S', t: 'KEY_T',
    u: 'KEY_U', v: 'KEY_V', w: 'KEY_W', x: 'KEY_X', y: 'KEY_Y', z: 'KEY_Z',
    '0': 'KEY_0', '1': 'KEY_1', '2': 'KEY_2', '3': 'KEY_3',
    '4': 'KEY_4', '5': 'KEY_5', '6': 'KEY_6', '7': 'KEY_7',
    '8': 'KEY_8', '9': 'KEY_9',
  }
  const btnMap: Record<string, string> = { left: 'BTN_LEFT', right: 'BTN_RIGHT', middle: 'BTN_MIDDLE' }

  async function runYdotool(args: string[]): Promise<{ code: number; stderr: string }> {
    const { code, stderr } = await execFileNoThrow('ydotool', args, { useCwd: false })
    return { code, stderr }
  }

  async function getCompositor(): Promise<string> {
    if (process.env.SWAYNC_CLIPBOARD || process.env.SWAYSOCK) return 'sway'
    if (process.env.KDE_FULL_SESSION || process.env.KDE_SESSION_VERSION) return 'kde'
    if (process.env.GNOME_DESKTOP_SESSION_ID) return 'gnome'
    const { code } = await execFileNoThrow('which', ['swaymsg'], { useCwd: false })
    if (code === 0) return 'sway'
    return 'wayland'
  }

  return {
    async moveMouse(x: number, y: number): Promise<void> {
      const { code, stderr } = await runYdotool(['mousemove', String(x), String(y)])
      if (code !== 0) throw new Error(`ydotool mousemove failed: ${stderr}`)
    },
    async mouseLocation(): Promise<{ x: number; y: number }> {
      const compositor = await getCompositor()
      if (compositor === 'sway') {
        const { stdout, code } = await execFileNoThrow('swaymsg', ['-t', 'get_seat', '--raw'], { useCwd: false })
        if (code === 0) {
          try {
            const seats = JSON.parse(stdout)
            if (seats && seats.length > 0 && seats[0].cursor) {
              return { x: seats[0].cursor.x, y: seats[0].cursor.y }
            }
          } catch {}
        }
      } else if (compositor === 'kde') {
        // KDE Plasma Wayland: use kdotool or parse cursor position from KWin
        try {
          // Try using qdbus to get cursor position from KWin
          const { stdout, code } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', '/KWin', 'org.kde.KWin.Cursor', 'pos'],
            { useCwd: false }
          )
          if (code === 0 && stdout) {
            const parts = stdout.trim().split(',')
            if (parts.length === 2) {
              return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) }
            }
          }
        } catch {}
        // Fallback: try reading from KWin's internal state via dbus
        try {
          const { stdout, code } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', '/Cursor', 'pos'],
            { useCwd: false }
          )
          if (code === 0 && stdout) {
            const parts = stdout.trim().split(' ')
            if (parts.length >= 2) {
              return { x: parseInt(parts[0], 10), y: parseInt(parts[1], 10) }
            }
          }
        } catch {}
      }
      return { x: 0, y: 0 }
    },
    async mouseButton(button, action, count = 1): Promise<void> {
      const btn = btnMap[button]
      const cmd = action === 'click' ? ['click', btn] : action === 'press' ? ['mousedown', btn] : ['mouseup', btn]
      const { code, stderr } = await runYdotool(cmd)
      if (code !== 0) throw new Error(`ydotool ${cmd[0]} failed: ${stderr}`)
    },
    async mouseScroll(direction, amount): Promise<void> {
      const clicks = Math.abs(amount)
      const sign = amount > 0 ? 1 : -1
      const btn = direction === 'vertical' ? (sign > 0 ? '4' : '5') : (sign > 0 ? '6' : '7')
      for (let i = 0; i < clicks; i++) {
        const { code, stderr } = await runYdotool(['click', btn])
        if (code !== 0) throw new Error(`ydotool scroll failed: ${stderr}`)
      }
    },
    async key(key, action): Promise<void> {
      const mapped = keyMap[key.toLowerCase()] || `KEY_${key.toUpperCase()}`
      const cmd = action === 'click' ? ['key', mapped] : action === 'press' ? ['keydown', mapped] : ['keyup', mapped]
      const { code, stderr } = await runYdotool(cmd)
      if (code !== 0) throw new Error(`ydotool ${cmd[0]} failed: ${stderr}`)
    },
    async keys(keys): Promise<void> {
      const mapped = keys.map(k => keyMap[k.toLowerCase()] || `KEY_${k.toUpperCase()}`).join('+')
      const { code, stderr } = await runYdotool(['key', '--', mapped])
      if (code !== 0) throw new Error(`ydotool key failed: ${stderr}`)
    },
    async typeText(text): Promise<void> {
      const { code, stderr } = await runYdotool(['type', '--', text])
      if (code !== 0) throw new Error(`ydotool type failed: ${stderr}`)
    },
    async getFrontmostAppInfo(): Promise<null> {
      const compositor = await getCompositor()
      if (compositor === 'sway') {
        const { stdout, code } = await execFileNoThrow('swaymsg', ['-t', 'get_focused'], { useCwd: false })
        if (code === 0 && stdout) {
          try {
            const window = JSON.parse(stdout)
            return {
              bundleId: window.app_id || 'unknown',
              appName: window.name || window.title || 'Unknown',
            }
          } catch {}
        }
      } else if (compositor === 'kde') {
        // KDE Plasma Wayland: use qdbus to get active window
        try {
          const { stdout, code } = await execFileNoThrow(
            'qdbus',
            ['org.kde.KWin', '/KWin', 'org.kde.KWin.activeWindow'],
            { useCwd: false }
          )
          if (code === 0 && stdout) {
            const windowId = stdout.trim()
            // Try to get window info from KWin
            try {
              const { stdout: nameOut } = await execFileNoThrow(
                'qdbus',
                ['org.kde.KWin', `/KWin/Windows/${windowId}`, 'org.kde.KWin.Window.resourceName'],
                { useCwd: false }
              )
              return {
                bundleId: windowId,
                appName: nameOut.trim() || `Window ${windowId}`,
              }
            } catch {}
            return {
              bundleId: windowId,
              appName: `Window ${windowId}`,
            }
          }
        } catch {}
      }
      return { bundleId: 'wayland', appName: 'Wayland Session' }
    },
    async appUnderPoint(x, y): Promise<null> {
      const compositor = await getCompositor()
      if (compositor === 'sway') {
        const { stdout, code } = await execFileNoThrow('swaymsg', ['-t', 'get_tree', '-r'], { useCwd: false })
        if (code === 0 && stdout) {
          try {
            const tree = JSON.parse(stdout)
            const findAtPoint = (node: any, px: number, py: number): any => {
              if (node.type === 'window' && node.rect) {
                const r = node.rect
                if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) return node
              }
              for (const child of [...(node.nodes || []), ...(node.floating_nodes || [])]) {
                const found = findAtPoint(child, px, py)
                if (found) return found
              }
              return null
            }
            const window = findAtPoint(tree, x, y)
            if (window) return { bundleId: window.app_id || 'unknown', displayName: window.name || 'Unknown' }
          } catch {}
        }
      }
      return null
    },
    async listRunningApps(): Promise<[]> {
      const compositor = await getCompositor()
      if (compositor === 'sway') {
        const { stdout, code } = await execFileNoThrow('swaymsg', ['-t', 'get_tree', '-r'], { useCwd: false })
        if (code === 0 && stdout) {
          try {
            const tree = JSON.parse(stdout)
            const appsMap = new Map()
            const collectWindows = (node: any) => {
              if (node.type === 'window' && node.app_id) {
                if (!appsMap.has(node.app_id)) {
                  appsMap.set(node.app_id, { bundleId: node.app_id, displayName: node.name || node.app_id, pid: node.pid })
                }
              }
              for (const child of [...(node.nodes || []), ...(node.floating_nodes || [])]) collectWindows(child)
            }
            collectWindows(tree)
            return Array.from(appsMap.values())
          } catch {}
        }
      }
      return []
    },
  }
}

export function requireLinuxInput(): LinuxInputAPI {
  initializeInput()
  return cachedInput!
}

export function isWaylandSession(): boolean {
  return detectSessionType() === 'wayland'
}

export function getSessionTypeString(): string {
  return detectSessionType()
}
