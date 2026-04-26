import type { ToolMetadata } from './types.js'

export class ToolRegistry {
  private tools = new Map<string, ToolMetadata>()

  register(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolMetadata | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.tools.values())
  }

  getBySource(source: 'builtin' | 'mcp'): ToolMetadata[] {
    return this.getAll().filter(t => t.source === source)
  }

  clear(): void {
    this.tools.clear()
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()