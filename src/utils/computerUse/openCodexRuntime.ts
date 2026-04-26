/**
 * OpenCodexRuntime - TypeScript wrapper for the `open-computer-use` binary.
 *
 * The open-computer-use binary provides cross-platform UI automation via a
 * standardized CLI interface. This class wraps its commands and parses responses.
 */

import { execFileNoThrow } from '../execFileNoThrow.js'
import { logForDebugging } from '../debug.js'

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── OpenCodexRuntime ─────────────────────────────────────────────────────────

export class OpenCodexRuntime {
  private available: boolean = false
  private readonly binaryName = 'open-computer-use'

  /**
   * Checks if the `open-computer-use` binary is available and functional.
   * Sets internal `this.available` flag on success.
   */
  async checkAvailability(): Promise<boolean> {
    // Check if binary exists
    const { code: whichCode } = await execFileNoThrow(
      'which',
      [this.binaryName],
      { useCwd: false },
    )

    if (whichCode !== 0) {
      logForDebugging(`OpenCodexRuntime: ${this.binaryName} not found in PATH`)
      this.available = false
      return false
    }

    // Verify it works by calling doctor
    const { code: doctorCode, stdout: doctorStdout, stderr: doctorStderr } =
      await execFileNoThrow(
        this.binaryName,
        ['doctor'],
        { useCwd: false },
      )

    if (doctorCode !== 0) {
      logForDebugging(
        `OpenCodexRuntime: ${this.binaryName} doctor failed: ${doctorStderr || doctorStdout}`,
      )
      this.available = false
      return false
    }

    this.available = true
    logForDebugging(`OpenCodexRuntime: ${this.binaryName} is available`)
    return true
  }

  /**
   * Calls an open-computer-use tool with the given arguments.
   * Returns parsed JSON response.
   * Throws on error.
   */
  private async callTool<T = unknown>(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const argsJson = JSON.stringify(args)
    logForDebugging(`OpenCodexRuntime: calling ${tool} with args ${argsJson}`)

    const { code, stdout, stderr } = await execFileNoThrow(
      this.binaryName,
      ['call', tool, '--args', argsJson],
      { useCwd: false },
    )

    if (code !== 0) {
      throw new Error(
        `OpenCodexRuntime: ${tool} failed (${code}): ${stderr || stdout}`,
      )
    }

    try {
      return JSON.parse(stdout) as T
    } catch {
      throw new Error(`OpenCodexRuntime: failed to parse ${tool} response: ${stdout}`)
    }
  }

  /**
   * Returns a list of installed application names.
   */
  async listApps(): Promise<string> {
    const response = await this.callTool<{ output: string }>('list_apps', {})
    return response.output
  }

  /**
   * Gets the current state snapshot of an application.
   */
  async getAppState(app: string): Promise<OpenCodexSnapshot> {
    return this.callTool<OpenCodexSnapshot>('get_app_state', { app })
  }

  /**
   * Clicks at the specified location or element.
   */
  async click(
    app: string,
    element?: OpenCodexElement,
    x?: number,
    y?: number,
  ): Promise<void> {
    const args: Record<string, unknown> = { app }
    if (element) {
      args.element = element
    }
    if (x !== undefined) {
      args.x = x
    }
    if (y !== undefined) {
      args.y = y
    }
    await this.callTool('click', args)
  }

  /**
   * Scrolls within an application.
   */
  async scroll(
    app: string,
    elementIndex: string,
    direction: string,
    pages: number,
  ): Promise<void> {
    await this.callTool('scroll', {
      app,
      element_index: elementIndex,
      direction,
      pages,
    })
  }

  /**
   * Drags from one position to another within an application.
   */
  async drag(
    app: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): Promise<void> {
    await this.callTool('drag', {
      app,
      from_x: fromX,
      from_y: fromY,
      to_x: toX,
      to_y: toY,
    })
  }

  /**
   * Types text into the focused element of an application.
   */
  async typeText(app: string, text: string): Promise<void> {
    await this.callTool('type_text', { app, text })
  }

  /**
   * Presses a key in an application.
   */
  async pressKey(app: string, key: string): Promise<void> {
    await this.callTool('press_key', { app, key })
  }

  /**
   * Sets the value of an element (e.g., text input).
   */
  async setValue(app: string, elementIndex: string, value: string): Promise<void> {
    await this.callTool('set_value', {
      app,
      element_index: elementIndex,
      value,
    })
  }

  /**
   * Performs a secondary action (e.g., right-click context menu item).
   */
  async performSecondaryAction(
    app: string,
    elementIndex: string,
    action: string,
  ): Promise<void> {
    await this.callTool('perform_secondary_action', {
      app,
      element_index: elementIndex,
      action,
    })
  }
}
