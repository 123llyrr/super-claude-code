# /hatch Command Design

## Overview

Add a standalone `/hatch` command as an independent entry point for hatching and displaying a companion. It exposes the re-hatch functionality under a discoverable, user-friendly name aimed at new users.

## Command Interface

| Aspect | Detail |
|--------|--------|
| Command | `/hatch` |
| Description | Hatch a new companion — shows full card after hatching |
| Aliases | None (intentionally minimal) |
| Type | `local-jsx` |

## Behavior

1. Call `rehatchCompanion()` — increments `rehatchCount`, regenerates bones, generates name + personality, persists to config
2. Render full companion card — identical visual to the re-hatch result in `/buddy re-hatch`

No arguments, no subcommands, no conditional logic. `/hatch` always hatches.

## Files to Create

- `src/commands/hatch/index.ts` — command descriptor
- `src/commands/hatch/hatch.tsx` — React component

## Reuse

- `rehatchCompanion()` from `src/buddy/companion.ts` — handles hatching logic
- `renderSprite()` from `src/buddy/sprites.ts` — ASCII sprite rendering
- `RARITY_STARS`, `RARITY_COLORS`, `STAT_NAMES` from `src/buddy/types.ts` — display constants
- `ResultBox` and `Result` from `src/commands/buddy/buddy.tsx` — or extract shared UI components

## Decision: Extract Shared UI or Duplicate

If `Result` component from `buddy.tsx` is extracted to a shared location, both commands use it. Given the similarity, duplication is acceptable for now — the two commands may diverge in future (e.g., `/hatch` could get a hatching animation later).

## Registration

Always registered — same pattern as `/buddy`:
```ts
isEnabled: () => true
```

Add to `src/commands.ts` import list.

## Visual Output

Exactly matches `/buddy re-hatch` output:
```
✨ Re-hatched! Your new companion has arrived!

[ASCII sprite]
Stars Name Stars
Species
Personality: "..."
Rarity: ...
(Shiny ✨ if applicable)
Stats bars
```
