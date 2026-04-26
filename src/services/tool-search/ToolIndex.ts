import type { ToolMetadata } from './types.ts'

export interface IndexedTool {
  name: string
  description: string
  keywords: string[]
  source: 'builtin' | 'mcp'
}

export class ToolIndex {
  private tools = new Map<string, ToolMetadata>()

  add(tool: ToolMetadata): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolMetadata | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolMetadata[] {
    return Array.from(this.tools.values())
  }

  clear(): void {
    this.tools.clear()
  }

  buildCorpus(): IndexedTool[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      keywords: tool.keywords,
      source: tool.source,
    }))
  }

  size(): number {
    return this.tools.size
  }
}
