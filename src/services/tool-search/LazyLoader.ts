import type { ToolMetadata, ToolHandler } from './types.js'

export class LazyLoader {
  private registry = new Map<string, ToolMetadata>()
  private cache = new Map<string, ToolHandler>()

  register(tool: ToolMetadata): void {
    if (!tool.load) {
      throw new Error(`Tool ${tool.name} must have a load function for lazy loading`)
    }
    this.registry.set(tool.name, tool)
  }

  async load(name: string): Promise<ToolHandler | undefined> {
    // Return cached if available
    if (this.cache.has(name)) {
      return this.cache.get(name)
    }

    const tool = this.registry.get(name)
    if (!tool || !tool.load) {
      return undefined
    }

    const handler = await tool.load()
    this.cache.set(name, handler)
    return handler
  }

  isLoaded(name: string): boolean {
    return this.cache.has(name)
  }

  preload(name: string): Promise<ToolHandler | undefined> {
    return this.load(name)
  }

  clearCache(): void {
    this.cache.clear()
  }

  getRegisteredTools(): ToolMetadata[] {
    return Array.from(this.registry.values())
  }
}
