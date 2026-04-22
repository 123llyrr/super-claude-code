import * as React from 'react'
import type { LocalJSXCommandOnDone, LocalJSXCommandContext } from '../../types/command.js'
import { getCompanion } from '../../buddy/companion.js'
import { useSetAppState } from '../../state/AppState.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  const companion = getCompanion()
  const args = context.args ?? []
  const subcommand = args[0]

  // /buddy pet — trigger pet animation
  if (subcommand === 'pet') {
    // setAppState available via ToolUseContext (LocalJSXCommandContext extends it)
    context.setAppState(prev => ({
      ...prev,
      companionPetAt: Date.now(),
    }))
    return (
      <Result onClose={onDone} companion={companion} action="pet" />
    )
  }

  // /buddy (no args) — show companion info
  if (!companion) {
    return (
      <Result onClose={onDone} companion={null} action="none" />
    )
  }

  return (
    <Result onClose={onDone} companion={companion} action="info" />
  )
}

function Result({
  onClose,
  companion,
  action,
}: {
  onDone: LocalJSXCommandOnDone
  companion: ReturnType<typeof getCompanion>
  action: 'pet' | 'info' | 'none'
}) {
  return (
    <Box flexDirection="column" padding={1}>
      {action === 'pet' && companion && (
        <Text>You pet {companion.name}! Hearts float above their head. 💕</Text>
      )}
      {action === 'pet' && !companion && (
        <Text>No companion yet. Use /hatch to get one!</Text>
      )}
      {action === 'info' && companion && (
        <Text>
          {companion.name} the {companion.species} — &quot;{companion.personality}&quot;
        </Text>
      )}
      {action === 'none' && (
        <Text>No companion hatched yet. Your buddy will appear soon!</Text>
      )}
      <Text>
        <Text color="cyan" bold>Commands:</Text>
        {' '}/buddy pet — Give your companion pets
      </Text>
    </Box>
  )
}

// Re-use Box and Text from ink
import { Box, Text } from '../../ink.js'
