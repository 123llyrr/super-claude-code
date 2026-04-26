# Linux Computer Use 完美实现设计方案

**日期：** 2026-04-26
**目标：** 实现一个完美的 Linux Computer Use，兼容 OpenAI Codex Computer Use 协议

## 背景

现有 Super-Claude-Code 的 Linux Computer Use 基于 xdotool/Hyprland 实现，仅支持坐标级操作。open-codex-computer-use 项目提供了基于 AT-SPI2 的语义级操作实现。本设计旨在集成 open-codex runtime，结合两者优势，实现完美的 Linux Computer Use。

## 核心目标

1. **语义级操作** — 完整 accessibility tree，按 element_index 点击
2. **兼容官方协议** — 完全兼容 OpenAI Codex Computer Use 的 9-tool MCP 协议
3. **全桌面环境覆盖** — X11/Wayland 通吃，Hyprland/GNOME/KDE/Sway 皆能运作
4. **主辅双轨** — open-codex primary，现有输入层 fallback

## 架构

```
┌─────────────────────────────────────────────────────┐
│  Claude Code                                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  computerUse/mcpServer.ts                     │  │
│  │  - 9 Codex tools (list_apps/get_app_state/   │  │
│  │    click/scroll/drag/type_text/press_key/    │  │
│  │    set_value/perform_secondary_action)        │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────▼──────────────────────────┐  │
│  │  ComputerExecutorFactory                       │  │
│  │  检测 open-codex runtime 可用性               │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│         ┌─────────────┴─────────────┐               │
│         ▼                           ▼               │
│  ┌─────────────────┐    ┌─────────────────────┐   │
│  │  OpenCodexRT    │    │  LinuxInputRT        │   │
│  │  (AT-SPI2语义) │    │  (xdotool/Hyprland) │   │
│  │                 │    │                      │   │
│  │  Primary ✓      │    │  Fallback           │   │
│  │  - element tree │    │  - 坐标级操作       │   │
│  │  - semantic act │    │  - 基础可用         │   │
│  └─────────────────┘    └─────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 组件职责

| 组件 | 职责 |
|------|------|
| `mcpServer.ts` | MCP 协议处理、tool call 分发 |
| `ComputerExecutorFactory` | 检测 open-codex 可用性，选择 primary/fallback runtime |
| `OpenCodexRuntime` | 封装 open-codex Linux binary，AT-SPI2 语义操作 |
| `LinuxInputRuntime` | 现有 xdotool/Hyprland 实现，坐标级操作兜底 |

## 检测逻辑

```
1. 检查 open-computer-use binary 是否存在于 PATH
2. 尝试调用 `open-computer-use doctor`
3. 若成功 → Primary = OpenCodexRT
4. 若失败 → Primary = LinuxInputRT，记录降级日志
```

## 工具映射

| Codex Tool | Primary (AT-SPI2) | Fallback (坐标) |
|------------|-------------------|-----------------|
| `get_app_state` | AT-SPI2 tree + GDK screenshot | grim/import screenshot |
| `list_apps` | AT-SPI2 app enumeration | xdotool search |
| `click` | `do_action("click")` + 语义坐标 | xdotool mousemove + click |
| `perform_secondary_action` | `do_action(name)` | 不支持 |
| `scroll` | `Page_Up/Down` keys | xdotool click 4/5 |
| `drag` | AT-SPI2 拖拽序列 | xdotool 模拟拖拽 |
| `type_text` | EditableText.insert_text | xdotool type |
| `press_key` | AT-SPI2 key synthesis | xdotool key |
| `set_value` | Value.set_current_value | 不支持 |

## 错误处理

- Primary 失败 → 自动切换 Fallback，通知用户已降级
- Fallback 失败 → 报错返回 `isError: true`
- 所有工具调用统一通过 `ExecutorAdapter` 屏蔽差异

## 实现步骤

1. 实现 `OpenCodexRuntime` 类，封装 subprocess 调用 open-computer-use
2. 修改 `ComputerExecutorFactory`，增加 primary/fallback 检测与选择逻辑
3. 实现 `ExecutorAdapter` 统一接口，屏蔽两个 runtime 的差异
4. 调整 `mcpServer.ts` 使用新的 executor factory
5. 保留并优化现有 `linuxInputLoader.ts` 作为 fallback
6. 添加降级提示与错误恢复逻辑

## 平台支持

- 仅限 Linux
- 覆盖 X11 (xdotool) 和 Wayland (ydotool + grim/wl-*)
- 支持 Hyprland、GNOME Shell、KDE Plasma、Sway 等桌面环境

## 参考实现

- open-codex-computer-use: `apps/OpenComputerUseLinux/main.go` + `runtime.py`
- 现有 Linux 实现: `src/utils/computerUse/executor.ts` (createLinuxExecutor)
