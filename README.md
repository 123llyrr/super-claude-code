# Super Claude Code

<p align="right"><strong>中文</strong> | <a href="./README.en.md">English</a></p>

基于 Claude Code 泄露源码修复的**本地可运行版本**，支持接入任意 Anthropic 兼容 API（如 MiniMax、OpenRouter 等）。

> 原始泄露源码无法直接运行。本仓库修复了启动链路中的多个阻塞问题，使完整的 Ink TUI 交互界面可以在本地工作。


## 核心特色

### 🧠 记忆系统（Memory System）
跨会话持久化记忆，AI 自动提取并存储项目事实、用户偏好、代码约定。上下文随用随取，无需重复告知。

### 💫 灵魂系统（Soul System）
AI 的「灵魂」——角色设定、行为准则、交流风格持久化。定义汝专属的 AI 伙伴，而非每次重新调教。

### 🖥️ Linux Computer Use
支持在 Linux 环境下执行 **Computer Use** 任务：
- 屏幕截图与区域识别
- 鼠标键盘自动化控制
- Wayland/X11 输入事件注入
- 原生 Linux 输入加载器（不依赖 macOS 的 accessibility API）

### ⚡ 性能优化
- **热加载**：修改代码后秒级生效，无需重启
- **记忆压缩**：自动合并相似记忆，保持记忆库精简
- **上下文精简**：智能压缩历史消息，减少 token 消耗

---

## 功能

- 完整的 Ink TUI 交互界面（与官方 Claude Code 一致）
- `--print` 无头模式（脚本/CI 场景）
- 支持 MCP 服务器、插件、Skills
- 支持自定义 API 端点和模型
- 降级 Recovery CLI 模式

---


## 快速开始

### 前置要求

- [Bun](https://bun.sh)（运行时）
- Linux / macOS / Windows（部分功能受限）

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 认证（必填二选一）
ANTHROPIC_AUTH_TOKEN=your_token_here   # 推荐：Bearer Token
# ANTHROPIC_API_KEY=sk-xxx            # 备选：API Key

# 端点（可选，默认 Anthropic）
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic

# 模型
ANTHROPIC_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M2.7-highspeed

# 超时 & 禁用遥测
API_TIMEOUT_MS=3000000
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

### 3. 运行

```bash
# 交互模式
./bin/super-claude-code

# 无头模式
./bin/super-claude-code -p "你的问题"

# 帮助
./bin/super-claude-code --help
```

> Windows 用户推荐使用 PowerShell 直接调用 Bun，或在 Git Bash 中运行。语音输入、Computer Use 等功能在 Windows 上不可用。

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_AUTH_TOKEN` | 二选一 | Bearer Token |
| `ANTHROPIC_API_KEY` | 二选一 | API Key |
| `ANTHROPIC_BASE_URL` | 否 | API 端点 |
| `ANTHROPIC_MODEL` | 否 | 默认模型 |
| `ANTHROPIC_DEFAULT_*_MODEL` | 否 | 各层级模型映射 |
| `API_TIMEOUT_MS` | 否 | 超时（毫秒） |
| `DISABLE_TELEMETRY` | 否 | 禁用遥测 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 否 | 禁用非必要网络请求 |

---

## 降级模式

TUI 异常时，强制使用简化 readline 界面：

```bash
CLAUDE_CODE_FORCE_RECOVERY_CLI=1 ./bin/super-claude-code
```

---

## 主要修复

泄露源码无法直接运行，本项目修复了以下关键问题：

| 问题 | 根因 | 修复 |
|------|------|------|
| TUI 无响应 | 入口路由错误，无参数时跳过了完整初始化 | 修正路由逻辑 |
| 启动挂起 | 缺失的模块导致 text loader 阻塞 | 创建 stub 桩文件 |
| `--print` 失效 | 缺失类型定义和资源文件 | 添加 stubs 目录 |
| Enter 键无效 | `isModifierPressed()` 异常中断了事件流 | 添加 try-catch 容错 |
| 初始化被跳过 | `LOCAL_RECOVERY=1` 默认启用导致跳过所有初始化 | 移除默认值 |
| 颜色对比度计算缺失 | `color-diff-napi` 依赖缺失 | 创建 TypeScript stub |
| Chrome MCP 连接失败 | `ant-claude-for-chrome-mcp` 协议缺失 | 添加 stub 实现 |

---

## 项目结构

```
bin/super-claude-code          # 入口脚本
preload.ts                     # Bun preload（设置 MACRO 全局变量）
.env.example                   # 环境变量模板
stubs/                         # 类型桩文件（补全缺失的类型）
deps/                          # 外部依赖源码
src/
├── entrypoints/               # 入口点
│   ├── cli.tsx               # CLI 主入口
│   ├── init.ts               # 初始化
│   └── mcp.ts                # MCP 入口
├── main.tsx                   # TUI 主逻辑
├── localRecoveryCli.ts        # 降级 Recovery CLI
├── setup.ts                   # 启动初始化
├── commands.ts                # 斜杠命令主入口
├── components/                # UI 组件（Ink/React）
├── screens/                   # 界面屏幕
│   ├── REPL.tsx              # 交互 REPL 界面
│   └── Doctor.tsx            # 诊断界面
├── ink/                       # Ink 终端渲染引擎
├── hooks/                     # React hooks
├── services/                   # 服务层（MCP, API, 诊断等）
├── skills/                     # Skill 系统
├── tools/                      # Agent 工具（Bash, Edit, Grep 等）
├── utils/                       # 工具函数
├── bridge/                      # Bridge 通信层
├── state/                       # 状态管理
├── memdir/                      # 记忆系统
├── voice/                       # 语音模块
├── vim/                         # Vim 模拟
├── keybindings/                 # 快捷键
├── migrations/                  # 数据迁移
├── server/                       # 服务器
├── remote/                       # 远程会话
├── plugins/                      # 插件系统
├── outputStyles/                 # 输出样式
├── query/                        # 查询引擎
├── tasks/                        # 任务系统
├── coordinator/                  # 协调器
├── buddy/                        # 伙伴系统
├── assistant/                    # Assistant 模块
├── bootstrap/                    # 引导模块
├── context/                      # 上下文
├── types/                        # 类型定义
├── constants/                    # 常量定义
├── schemas/                      # Schema 定义
└── upstreamproxy/               # 上游代理
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | [Bun](https://bun.sh) |
| 语言 | TypeScript |
| 终端 UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI 解析 | Commander.js |
| API | Anthropic SDK |
| 协议 | MCP, LSP |

---

## Disclaimer

本仓库基于 2026-03-31 从 Anthropic npm registry 泄露的 Claude Code 源码。所有原始源码版权归 [Anthropic](https://www.anthropic.com) 所有。仅供学习和研究用途。
