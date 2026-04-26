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
