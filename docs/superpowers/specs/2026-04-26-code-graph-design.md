# 代码图谱 Sidecar 设计文档

## 概述

将 AtomCode 的代码图谱以 Rust sidecar 进程方式引入 Super-Claude-Code，使 Agent 具备语言语义级的代码理解能力。

**核心思路**：Rust 二进制进程通过 stdin/stdout 接收 JSON 命令，执行 tree-sitter 解析和图查询，返回结果给 Bun 主进程。AtomCode 代码几乎完整复用。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  Bun 进程 (super-claude-code)                           │
│                                                         │
│  src/graph/                                             │
│    client.ts       ← JSON-RPC over stdin/stdout          │
│    tools/          ← 7个 MCP 工具 (list_symbols 等)      │
│    types.ts       ← 与 sidecar 共享的 TypeScript 类型    │
└─────────────────────────────────────────────────────────┘
                           │ JSON
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Rust 进程 (code-graph-daemon)                          │
│                                                         │
│  src/graph/                                             │
│    mod.rs          ← CodeGraph 核心                      │
│    indexer.rs      ← tree-sitter 增量索引                │
│    resolve.rs      ← 调用关系解析                        │
│  src/semantic/                                           │
│    language.rs     ← 语言检测 + tree-sitter queries     │
│  src/tool/                                             │
│    blast_radius.rs 等 ← 7 个工具实现                     │
└─────────────────────────────────────────────────────────┘
```

---

## 项目结构

### 新增文件

```
src/graph/
  client.ts          # Bun 侧 IPC 客户端
  types.ts           # 共享类型 (SymbolNode, Edge, QueryResult)
  tools/
    index.ts         # 工具导出
    listSymbols.ts   # list_symbols
    findReferences.ts # find_references
    traceCallers.ts  # trace_callers
    traceCallees.ts  # trace_callees
    traceChain.ts    # trace_chain
    fileDeps.ts      # file_deps
    blastRadius.ts   # blast_radius

vendor/code-graph/   # Rust sidecar (git submodule 或 copy)
  Cargo.toml
  src/
    main.rs          # CLI 入口，stdin/stdout JSON loop
    graph/
    semantic/
    tool/
```

---

## IPC 协议

### 命令格式（ Bun → Rust ）

```json
{
  "cmd": "query",
  "method": "list_symbols",
  "params": { "file": "src/tools/foo.ts" },
  "id": 1
}
```

### 响应格式（ Rust → Bun ）

```json
{
  "id": 1,
  "ok": true,
  "result": { ... }
}
```

```json
{
  "id": 1,
  "ok": false,
  "error": "Code graph is not yet indexed"
}
```

### 管理命令

| cmd | 作用 |
|-----|------|
| `init { project_dir }` | 初始化图谱，后台启动全量索引 |
| `index_file { path }` | 增量索引单个文件 |
| `query { method, params }` | 执行图查询 |
| `ready` | 返回 `{ ready: bool, stats: { nodes, files } }` |

---

## 7 个工具

### 1. `list_symbols`
列出文件中所有符号（函数、结构体、变量等）。

**参数**: `{ file: string }`
**返回**: `SymbolNode[]`

### 2. `find_references`
查找某符号被引用的所有位置。

**参数**: `{ file: string, symbol?: string }` （symbol 省略则列出文件中所有引用）
**返回**: `{ file, line, column, context }[]`

### 3. `trace_callers`
向上追溯：谁调用了这个函数（传递闭包，BFS）。

**参数**: `{ file: string, depth?: number }` （depth 默认 3）
**返回**: `SymbolNode[]` 按深度排序

### 4. `trace_callees`
向下追溯：这个函数调用了哪些（传递闭包，BFS）。

**参数**: `{ file: string, depth?: number }`
**返回**: `SymbolNode[]`

### 5. `trace_chain`
两符号间的最短调用路径。

**参数**: `{ from: string, to: string }`
**返回**: `SymbolNode[]` 路径，或空（无路径）

### 6. `file_deps`
列出依赖此文件的所有文件。

**参数**: `{ file: string, depth?: number }`
**返回**: `{ direct: Path[], indirect: Path[], total: number }`

### 7. `blast_radius`
评估修改某文件的影响范围（重构前必查）。

**参数**: `{ file: string }`
**返回**: 格式化文本，人类可读

---

## 启动与生命周期

### 惰性启动
- 首次调用任何图谱工具时，spawn Rust sidecar 子进程
- 若 5 分钟无活动，kill 之子进程（节省内存）
- 项目目录改变时，重启 sidecar（传入新 `project_dir`）

### 错误处理
- sidecar crash → 记录错误，返回工具失败，重新 spawn
- 索引未完成 → `ready` 查询返回 `ready: false`，工具返回友好提示

### 索引状态
```typescript
interface GraphStats {
  ready: boolean;
  nodeCount: number;
  fileCount: number;
  indexingProgress?: number; // 0-100%
}
```

---

## 依赖版本（已锁定实际可用版本）

```toml
# vendor/code-graph/Cargo.toml
[dependencies]
tree-sitter = "0.24"              # tree-sitter core
tree-sitter-rust = "0.24"         # matches core
tree-sitter-python = "0.25"       # no 0.24, ecosystem moved to 0.25
tree-sitter-javascript = "0.25"   # no 0.24, ecosystem moved to 0.25
tree-sitter-typescript = "0.23"   # no 0.24, use 0.23
tree-sitter-go = "0.25"           # no 0.24, ecosystem moved to 0.25
tree-sitter-java = "0.23"         # no 0.24, use 0.23
tree-sitter-c = "0.24"            # matches core
tree-sitter-cpp = "0.23"          # no 0.24, use 0.23
tree-sitter-html = "0.23"         # no 0.24, use 0.23

# NOTE: tree-sitter 解析器生态没有统一的版本。Python/JS/Go 只有 0.25，
# TypeScript/Java/C++/HTML 只有 0.23，Rust/C 有 0.24。
# 编译成功说明跨版本使用时运行时兼容（均支持 tree-sitter 0.20+）。
```

---

## 不支持的语言

以下语言 fallback 到 grep，不阻塞工具调用：

- bash / zsh / fish
- lua
- php
- ruby
- css / scss / less
- sql

工具定义注明：`"Note": "Falls back to grep for unsupported languages"`。

---

## Phase 规划

### Phase 1 — MVP（当前实现）
- [ ] Rust sidecar 骨架（stdin/stdout JSON loop）
- [ ] `CodeGraph` 核心 + `GraphIndexer`
- [ ] `list_symbols` + `find_references` 工具
- [ ] `list_symbols` + `find_references` MCP 工具接入
- [ ] Bun 侧 `client.ts`

### Phase 2 — 完整工具集
- [ ] `trace_callers` / `trace_callees`
- [ ] `blast_radius` / `file_deps`
- [ ] `trace_chain`

### Phase 3 — 优化
- [ ] 增量索引（mtime dirty 检测）
- [ ] 文件监视（chokidar 联动，文件保存时触发 reindex）
- [ ] 惰性启动 + 自动回收

---

## 与现有工具的关系

| 现有工具 | 代码图谱工具 | 关系 |
|---------|-------------|------|
| `Read` | `list_symbols` | Read 是原始文本，list_symbols 是语义层 |
| `Grep` | `find_references` | Grep 是字符串匹配，find_references 是符号语义 |
| — | `trace_callers` | 新增，无对应工具 |
| — | `blast_radius` | 新增，无对应工具 |

代码图谱工具**不替代**现有工具，而是提供更精准的语义级查询。Agent 可根据场景选择。

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| tree-sitter parser 版本不匹配 | 统一锁定 0.24 版本 |
| 首次索引耗时 20-40s | 后台异步，Bun 进程不被阻塞 |
| sidecar 内存占用高 | 5 分钟 idle 超时自动 kill |
| Rust 代码编译慢 | 仅开发时编译，CI 用预编译 binary |
| Windows 兼容性 | sidecar 支持 Windows（Mingw 交叉编译）|
