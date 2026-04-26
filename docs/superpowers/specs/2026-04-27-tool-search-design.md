# Tool Search + Lazy Loading 设计文档

## 概述

为 Super-Claude-Code 实现基于 BM25 的工具搜索 + 延迟加载系统，借鉴 OpenAI Codex 的工程经验。

## 目标

1. **工具发现**：用户可用自然语言搜索工具，而非记忆工具名
2. **延迟加载**：工具按需加载，减少启动时间和内存占用
3. **统一入口**：MCP 工具和内置工具使用同一搜索机制

## 架构设计

```
用户输入 → 工具发现层（BM25 搜索） → 延迟加载 → 工具执行层
              ↓
         内存索引 + 文件缓存
```

### 组件说明

#### 1. SearchEngine（BM25 搜索引擎）
- 使用 `bm25s` 库实现
- 支持字段权重（name 权重 > description 权重 > keywords 权重）
- 返回按相关性排序的工具列表

#### 2. ToolIndex（工具索引管理）
- **内存索引**：启动时扫描所有工具元数据
- **文件缓存**：`.claude/tool-index.json` 加速启动
- **增量更新**：工具变更时局部更新索引

#### 3. ToolRegistry（统一工具注册表）
- 内置工具：静态定义元数据
- MCP 工具：从 `.mcp.json` 动态提取元数据
- 提供统一的工具元数据接口

#### 4. LazyLoader（延迟加载器）
- 工具默认只注册元数据，不实例化
- 首次调用时动态加载工具处理器
- 缓存已加载的工具处理器

#### 5. ToolDiscoveryMiddleware（工具发现中间件）
- 注入到工具调用流程的中间层
- 拦截用户输入，进行 BM25 搜索
- 提供工具推荐，不自动执行

## 交互设计

### 混合模式

#### 自动推荐（Auto Highlight）
- 用户描述需求时，自动搜索相关工具
- 显示 top-3 相关工具作为建议
- 用户可选择或忽略

#### 显式搜索（/search-tools 命令）
```
/search-tools git commit
/search-tools file read
/search-tools "我要操作数据库"
```

### 行为示例

```
用户: "帮我读这个文件"
  → 系统: [📌 推荐工具]
      1. file_read (0.95) - 读取文件内容
      2. file_write (0.72) - 写入文件内容
      3. glob (0.45) - 查找文件
  → 用户可输入 1 选择，或继续描述

用户: /search-tools git commit
  → 系统显示所有 git 相关工具列表
```

## 文件结构

```
src/services/tool-search/
├── index.ts                    # 导出
├── SearchEngine.ts             # BM25 搜索引擎
├── ToolIndex.ts                # 工具索引管理
├── ToolRegistry.ts             # 统一工具注册表
├── LazyLoader.ts               # 延迟加载器
└── commands/
    └── SearchToolsCommand.ts   # /search-tools 命令

src/middleware/
└── toolDiscovery.ts            # 工具发现中间件
```

## 实现步骤

### Phase 1: 核心模块
1. 实现 ToolRegistry（工具元数据注册）
2. 实现 ToolIndex（索引管理 + 文件缓存）
3. 实现 SearchEngine（BM25 搜索）

### Phase 2: 延迟加载
4. 实现 LazyLoader（按需加载）
5. 集成到现有工具执行流程

### Phase 3: 用户交互
6. 实现 /search-tools 命令
7. 实现自动推荐（middleware）
8. 配置项和开关

## 依赖

```json
{
  "bm25s": "^1.0.0"
}
```

## 配置项

```typescript
interface ToolSearchConfig {
  enabled: boolean              // 总开关
  autoHighlight: boolean        // 自动推荐
  maxSuggestions: number        // 最大推荐数，默认 3
  indexCachePath: string        // 索引缓存路径
  bm25Params: {
    k1: number                 // BM25 参数
    b: number                 // BM25 参数
  }
}
```

## 已知约束

1. MCP 服务器启动时才能获取完整工具列表
2. BM25 是关键词搜索，不支持语义理解
3. 延迟加载会增加首次调用延迟

## 借鉴来源

- OpenAI Codex 的工具发现机制（`TOOL_SEARCH_TOOL_NAME`）
- Codex 的延迟加载设计
- Codex 的工具元数据索引策略
