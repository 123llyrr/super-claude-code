import * as React from 'react'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { getCompanion, rehatchCompanion } from '../../buddy/companion.js'
import { Box, Text } from '../../ink.js'
import { RARITY_STARS, RARITY_COLORS, STAT_NAMES, type Rarity } from '../../buddy/types.js'
import { renderSprite } from '../../buddy/sprites.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const companion = getCompanion()
  const parsedArgs = args ? args.split(' ') : []
  const subcommand = parsedArgs[0]

  // /buddy help — show help text
  if (subcommand === 'help') {
    return (
      <Result onClose={onDone} companion={null} action="help" />
    )
  }

  // /buddy stats — show stats only
  if (subcommand === 'stats') {
    return (
      <Result onClose={onDone} companion={companion} action="stats" />
    )
  }

  // /buddy pet — trigger pet animation
  if (subcommand === 'pet') {
    context.setAppState(prev => ({
      ...prev,
      companionPetAt: Date.now(),
    }))
    return (
      <Result onClose={onDone} companion={companion} action="pet" />
    )
  }

  // /buddy re-hatch — regenerate companion
  if (subcommand === 're-hatch') {
    const newCompanion = rehatchCompanion()
    return (
      <Result onClose={onDone} companion={newCompanion} action="rehatch" />
    )
  }

  // /buddy (no args) — show full companion card
  return (
    <Result onClose={onDone} companion={companion} action="show" />
  )
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
  action,
}: {
  onClose: LocalJSXCommandOnDone
  companion: ReturnType<typeof getCompanion>
  action: 'show' | 'pet' | 'stats' | 'help' | 'rehatch' | 'none'
}) {
  // No companion yet
  if (!companion && action !== 'help') {
    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text italic color="inactive">No companion hatched yet. Your buddy will appear soon!</Text>
      </ResultBox>
    )
  }

  // Help text
  if (action === 'help') {
    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text bold color="cyan">/buddy</Text>
        <Text>  Show your companion&apos;s full card with ASCII art</Text>
        <Text bold color="cyan">/buddy pet</Text>
        <Text>  Trigger pet animation — hearts float above your buddy!</Text>
        <Text bold color="cyan">/buddy stats</Text>
        <Text>  Display your companion&apos;s stat breakdown</Text>
        <Text bold color="cyan">/buddy re-hatch</Text>
        <Text>  Re-hatch your companion — new species, rarity, and personality</Text>
      </ResultBox>
    )
  }

  // Pet action
  if (action === 'pet' && companion) {
    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text>
          You pet <Text bold color={RARITY_COLORS[companion.rarity]}>{companion.name}</Text>!
          Hearts float above their head.
        </Text>
        <Text italic color="inactive">Use /buddy pet anytime to show them love.</Text>
      </ResultBox>
    )
  }

  if (action === 'pet' && !companion) {
    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text italic color="inactive">No companion yet. Keep chatting and one will hatch!</Text>
      </ResultBox>
    )
  }

  // Re-hatch — show new companion
  if (action === 'rehatch' && companion) {
    const rarityColor = RARITY_COLORS[companion.rarity] as string
    const spriteLines = renderSprite(companion)
    const stars = RARITY_STARS[companion.rarity]

    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text bold color="warning">✨ Re-hatched! Your new companion has arrived!</Text>

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
          </Box>
        </Box>
      </ResultBox>
    )
  }

  // Stats only
  if (action === 'stats' && companion) {
    const rarityColor = RARITY_COLORS[companion.rarity] as string
    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text bold color={rarityColor}>
          {RARITY_STARS[companion.rarity]} {companion.name}&apos;s Stats
        </Text>
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          {STAT_NAMES.map(stat => (
            <Text key={stat}>
              <Text color="cyan">{stat.padEnd(10)}</Text>
              {renderStatBar(companion.stats[stat], companion.rarity)}
            </Text>
          ))}
        </Box>
      </ResultBox>
    )
  }

  // Full show (default)
  if (companion) {
    const rarityColor = RARITY_COLORS[companion.rarity] as string
    const spriteLines = renderSprite(companion)
    const stars = RARITY_STARS[companion.rarity]

    return (
      <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
        <Text bold color={rarityColor}>
          {stars} {companion.name} {stars}
        </Text>
        <Text italic dimColor>{companion.species}</Text>

        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" marginRight={2}>
            {spriteLines.map((line, i) => (
              <Text key={i} color={rarityColor}>{line}</Text>
            ))}
          </Box>

          <Box flexDirection="column">
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
            <Text marginTop={1}>
              <Text color="cyan" bold>Stats:</Text>
            </Text>
            {STAT_NAMES.map(stat => (
              <Text key={stat} dimColor>
                <Text color="cyan">{stat.slice(0, 4)}.</Text>{' '}
                {renderStatBar(companion.stats[stat], companion.rarity)}
              </Text>
            ))}
          </Box>
        </Box>

        <Text marginTop={1} italic dimColor>
          <Text color="cyan">Tip:</Text> Use /buddy pet for love, /buddy re-hatch for a new buddy!
        </Text>
      </ResultBox>
    )
  }

  // Fallback
  return (
    <ResultBox onClose={onClose} dismissText="Press any key to dismiss...">
      <Text italic color="inactive">No companion yet.</Text>
    </ResultBox>
  )
}

function renderStatBar(value: number, rarity: Rarity): React.ReactNode {
  const filled = Math.round(value / 5)
  const empty = 20 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return <Text>{bar} {String(value).padStart(3)}</Text>
}
