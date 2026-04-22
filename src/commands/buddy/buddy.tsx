import * as React from 'react'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { getCompanion } from '../../buddy/companion.js'
import { Box, Text } from '../../ink.js'
import { RARITY_STARS, RARITY_COLORS, STAT_NAMES, type Rarity } from '../../buddy/types.js'
import { renderSprite } from '../../buddy/sprites.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  const companion = getCompanion()
  const args = context.args ?? []
  const subcommand = args[0]

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

  // /buddy (no args) — show full companion card
  return (
    <Result onClose={onDone} companion={companion} action="show" />
  )
}

function Result({
  companion,
  action,
}: {
  onClose: LocalJSXCommandOnDone
  companion: ReturnType<typeof getCompanion>
  action: 'show' | 'pet' | 'stats' | 'help' | 'none'
}) {
  // No companion yet
  if (!companion && action !== 'help') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text italic color="inactive">No companion hatched yet. Your buddy will appear soon!</Text>
      </Box>
    )
  }

  // Help text
  if (action === 'help') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">/buddy</Text>
        <Text>  Show your companion&apos;s full card with ASCII art</Text>
        <Text bold color="cyan">/buddy pet</Text>
        <Text>  Trigger pet animation — hearts float above your buddy!</Text>
        <Text bold color="cyan">/buddy stats</Text>
        <Text>  Display your companion&apos;s stat breakdown</Text>
      </Box>
    )
  }

  // Pet action
  if (action === 'pet' && companion) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>
          You pet <Text bold color={RARITY_COLORS[companion.rarity]}>{companion.name}</Text>!
          Hearts float above their head.
        </Text>
        <Text italic color="inactive">Use /buddy pet anytime to show them love.</Text>
      </Box>
    )
  }

  if (action === 'pet' && !companion) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text italic color="inactive">No companion yet. Keep chatting and one will hatch!</Text>
      </Box>
    )
  }

  // Stats only
  if (action === 'stats' && companion) {
    const rarityColor = RARITY_COLORS[companion.rarity] as string
    return (
      <Box flexDirection="column" padding={1}>
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
      </Box>
    )
  }

  // Full show (default)
  if (companion) {
    const rarityColor = RARITY_COLORS[companion.rarity] as string
    const spriteLines = renderSprite(companion)
    const stars = RARITY_STARS[companion.rarity]

    return (
      <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Text bold color={rarityColor}>
          {stars} {companion.name} {stars}
        </Text>
        <Text italic dimColor>{companion.species}</Text>

        {/* ASCII sprite + info side by side */}
        <Box flexDirection="row" marginTop={1}>
          {/* Sprite */}
          <Box flexDirection="column" marginRight={2}>
            {spriteLines.map((line, i) => (
              <Text key={i} color={rarityColor}>{line}</Text>
            ))}
          </Box>

          {/* Info panel */}
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
          <Text color="cyan">Tip:</Text> Use /buddy pet to show some love!
        </Text>
      </Box>
    )
  }

  // Fallback (shouldn't reach here)
  return (
    <Box flexDirection="column" padding={1}>
      <Text italic color="inactive">No companion yet.</Text>
    </Box>
  )
}

function renderStatBar(value: number, rarity: Rarity): React.ReactNode {
  const filled = Math.round(value / 5)
  const empty = 20 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return <Text>{bar} {String(value).padStart(3)}</Text>
}
