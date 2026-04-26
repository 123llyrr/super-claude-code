# /hatch Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `/hatch` command that hatches a new companion and displays its full card.

**Architecture:** Independent command files under `src/commands/hatch/`, reusing `rehatchCompanion()` from `buddy/companion.ts` and the re-hatch UI rendering from `buddy/buddy.tsx`.

**Tech Stack:** TypeScript, React ( Ink), local-jsx command pattern.

---

## File Map

| File | Action |
|------|--------|
| `src/commands/hatch/index.ts` | Create — command descriptor |
| `src/commands/hatch/hatch.tsx` | Create — React component |
| `src/commands.ts` | Modify — register `/hatch` command |

---

## Tasks

### Task 1: Create command descriptor

**Files:**
- Create: `src/commands/hatch/index.ts`

- [ ] **Step 1: Write command descriptor**

```ts
import type { Command } from '../../commands.js'

const hatch = {
  type: 'local-jsx',
  name: 'hatch',
  description: 'Hatch a new companion — displays full card after hatching',
  immediate: true,
  load: () => import('./hatch.js'),
} satisfies Command

export default hatch
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/hatch/index.ts
git commit -m "feat(hatch): add /hatch command descriptor"
```

---

### Task 2: Create hatch React component

**Files:**
- Create: `src/commands/hatch/hatch.tsx`

- [ ] **Step 1: Write hatch component**

```tsx
import * as React from 'react'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { rehatchCompanion } from '../../buddy/companion.js'
import { Box, Text } from '../../ink.js'
import { RARITY_STARS, RARITY_COLORS, STAT_NAMES, type Rarity } from '../../buddy/types.js'
import { renderSprite } from '../../buddy/sprites.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  const companion = rehatchCompanion()
  return <Result onClose={onDone} companion={companion} />
}

function ResultBox({
  onClose,
  dismissText,
  children,
}: {
  onClose: LocalJSXCommandOnDone
  dismissText?: string
  children: React.ReactNode
}) {
  function handleKeyDown(e: KeyboardEvent): void {
    e.preventDefault()
    onClose(undefined, { display: 'skip' })
  }
  return (
    <Box flexDirection="column" padding={1} tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      {children}
      {dismissText !== undefined && <Text dimColor italic>{dismissText}</Text>}
    </Box>
  )
}

function Result({
  onClose,
  companion,
}: {
  onClose: LocalJSXCommandOnDone
  companion: NonNullable<ReturnType<typeof rehatchCompanion>>
}) {
  const rarityColor = RARITY_COLORS[companion.rarity] as string
  const spriteLines = renderSprite(companion)
  const stars = RARITY_STARS[companion.rarity]

  return (
    <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
      <Text bold color="warning">✨ Hatched! Your new companion has arrived!</Text>

      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" marginRight={2}>
          {spriteLines.map((line, i) => (
            <Text key={i} color={rarityColor}>{line}</Text>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text bold color={rarityColor}>
            {stars} {companion.name} {stars}
          </Text>
          <Text italic dimColor>{companion.species}</Text>
          <Text>
            <Text color="cyan" bold>Personality:</Text>{' '}
            <Text italic>&quot;{companion.personality}&quot;</Text>
          </Text>
          <Text>
            <Text color="cyan" bold>Rarity:</Text>{' '}
            <Text color={rarityColor}>{companion.rarity}</Text>
          </Text>
          {companion.shiny && (
            <Text color="warning" bold>✨ Shiny ✨</Text>
          )}
          <Text marginTop={1} color="cyan" bold>Stats:</Text>
          {STAT_NAMES.map(stat => (
            <Text key={stat} dimColor>
              <Text color="cyan">{stat.slice(0, 4)}.</Text>{' '}
              {renderStatBar(companion.stats[stat], companion.rarity)}
            </Text>
          ))}
        </Box>
      </Box>
    </ResultBox>
  )
}

function renderStatBar(value: number, rarity: Rarity): React.ReactNode {
  const filled = Math.round(value / 5)
  const empty = 20 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return <Text>{bar} {String(value).padStart(3)}</Text>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/hatch/hatch.tsx
git commit -m "feat(hatch): add hatch React component with full card display"
```

---

### Task 3: Register /hatch in commands.ts

**Files:**
- Modify: `src/commands.ts`

- [ ] **Step 1: Add hatch to imports and registry**

Find the existing buddy import and add hatch alongside it:

```ts
import buddy from './commands/buddy/index.js'
import hatch from './commands/hatch/index.js'
```

Find the command registry array and add hatch:

```ts
const commands = [
  // ... existing commands
  buddy,
  hatch,  // <-- add here
]
```

- [ ] **Step 2: Commit**

```bash
git add src/commands.ts
git commit -m "feat(hatch): register /hatch command"
```

---

### Task 4: Smoke test

- [ ] **Step 1: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors related to hatch files.

- [ ] **Step 2: Verify the command can be loaded**

```bash
node --input-type=module -e "
import('./commands/hatch/index.js').then(m => console.log('OK:', m.default.name))
"
```

Expected: `OK: hatch`

---

## Spec Coverage

- [x] Independent entry point (`/hatch`)
- [x] Calls `rehatchCompanion()` on invocation
- [x] Displays full companion card after hatching
- [x] Always registered (`isEnabled` not needed — no feature flag)
- [x] Files: `index.ts` + `hatch.tsx` + commands.ts modification
