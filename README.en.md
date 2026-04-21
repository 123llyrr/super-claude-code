# Super Claude Code

<p align="right"><a href="./README.md">中文</a> | <strong>English</strong></p>

A **locally runnable version** repaired from the leaked Claude Code source, with support for any Anthropic-compatible API endpoint such as MiniMax and OpenRouter.

> The original leaked source does not run as-is. This repository fixes multiple blocking issues in the startup path so the full Ink TUI can work locally.


## Key Features

### 🧠 Memory System
Cross-session persistent memory. AI automatically extracts and stores project facts, user preferences, and coding conventions. Context is available on demand without repeated explanations.

### 💫 Soul System
The "soul" of your AI — role definition, behavioral guidelines, and communication style persist across sessions. Define your专属 AI partner instead of re-tuning it every time.

### 🖥️ Linux Computer Use
Execute **Computer Use** tasks on Linux environments:
- Screen and region screenshot capture
- Mouse and keyboard automation
- Wayland/X11 input event injection
- Native Linux input loader (no macOS accessibility API dependency)

### ⚡ Performance Optimization
- **Hot loading**: Code changes take effect in seconds, no restart needed
- **Memory compression**: Auto-merges similar memories, keeps memory lean
- **Context trimming**: Intelligent compression of historical messages, reduces token consumption

---

## Features

- Full Ink TUI experience (matching the official Claude Code interface)
- `--print` headless mode for scripts and CI
- MCP server, plugin, and Skills support
- Custom API endpoint and model support
- Fallback Recovery CLI mode

---


## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- Linux / macOS / Windows (some features limited on Windows)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Authentication (required, choose one)
ANTHROPIC_AUTH_TOKEN=your_token_here   # Recommended: Bearer token
# ANTHROPIC_API_KEY=sk-xxx           # Alternative: API key

# Endpoint (optional, defaults to Anthropic)
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic

# Models
ANTHROPIC_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M2.7-highspeed
ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M2.7-highspeed

# Timeout & telemetry
API_TIMEOUT_MS=3000000
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

### 3. Run

```bash
# Interactive mode
./bin/super-claude-code

# Headless mode
./bin/super-claude-code -p "your question"

# Help
./bin/super-claude-code --help
```

> Windows users: use PowerShell to call Bun directly, or run inside Git Bash. Voice input and Computer Use are not available on Windows.

---

## Environment Variables

| Variable | Required | Description |
|------|------|------|
| `ANTHROPIC_AUTH_TOKEN` | One of two | Bearer token |
| `ANTHROPIC_API_KEY` | One of two | API key |
| `ANTHROPIC_BASE_URL` | No | API endpoint |
| `ANTHROPIC_MODEL` | No | Default model |
| `ANTHROPIC_DEFAULT_*_MODEL` | No | Per-tier model mapping |
| `API_TIMEOUT_MS` | No | Timeout in milliseconds |
| `DISABLE_TELEMETRY` | No | Disable telemetry |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | No | Disable non-essential network requests |

---

## Fallback Mode

If the TUI fails, force the simplified readline interface:

```bash
CLAUDE_CODE_FORCE_RECOVERY_CLI=1 ./bin/super-claude-code
```

---

## Key Fixes

The leaked source was non-functional. This project fixes critical issues:

| Issue | Root cause | Fix |
|------|------|------|
| TUI unresponsive | Entry routing error, skipped full init on no args | Fixed routing logic |
| Startup hangs | Missing modules blocked text loader | Added stub files |
| `--print` broken | Missing type definitions and resources | Added stubs directory |
| Enter key unresponsive | `isModifierPressed()` exception broke event chain | Added try/catch |
| Init skipped | `LOCAL_RECOVERY=1` enabled by default | Removed default value |
| Color diff missing | `color-diff-napi` dependency absent | Created TypeScript stub |
| Chrome MCP fails | `ant-claude-for-chrome-mcp` protocol missing | Added stub implementation |

---

## Project Structure

```text
bin/super-claude-code          # Entry script
preload.ts                     # Bun preload (sets MACRO globals)
.env.example                   # Environment variable template
stubs/                         # Type stubs (for missing types)
deps/                          # External dependency sources
src/
├── entrypoints/               # Entrypoints
│   ├── cli.tsx               # Main CLI entry
│   ├── init.ts               # Initialization
│   └── mcp.ts                # MCP entry
├── main.tsx                   # Main TUI logic
├── localRecoveryCli.ts        # Fallback Recovery CLI
├── setup.ts                   # Startup initialization
├── commands.ts                # Slash commands main entry
├── components/                # UI components (Ink/React)
├── screens/                   # Screen views
│   ├── REPL.tsx             # Interactive REPL screen
│   └── Doctor.tsx           # Diagnostic screen
├── ink/                       # Ink terminal rendering engine
├── hooks/                     # React hooks
├── services/                   # Service layer (MCP, API, diagnostics)
├── skills/                     # Skill system
├── tools/                      # Agent tools (Bash, Edit, Grep, etc.)
├── utils/                       # Utility functions
├── bridge/                      # Bridge communication layer
├── state/                       # State management
├── memdir/                      # Memory system
├── voice/                       # Voice module
├── vim/                         # Vim emulation
├── keybindings/                 # Keybindings
├── migrations/                  # Data migrations
├── server/                       # Server
├── remote/                       # Remote sessions
├── plugins/                      # Plugin system
├── outputStyles/                 # Output styles
├── query/                        # Query engine
├── tasks/                        # Task system
├── coordinator/                  # Coordinator
├── buddy/                        # Buddy system
├── assistant/                    # Assistant module
├── bootstrap/                    # Bootstrap module
├── context/                      # Context
├── types/                        # Type definitions
├── constants/                    # Constants
├── schemas/                      # Schemas
└── upstreamproxy/               # Upstream proxy
```

---

## Tech Stack

| Category | Technology |
|------|------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript |
| Terminal UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI parsing | Commander.js |
| API | Anthropic SDK |
| Protocols | MCP, LSP |

---

## Disclaimer

This repository is based on the Claude Code source leaked from the Anthropic npm registry on 2026-03-31. All original source code copyrights belong to [Anthropic](https://www.anthropic.com). It is provided for learning and research purposes only.
