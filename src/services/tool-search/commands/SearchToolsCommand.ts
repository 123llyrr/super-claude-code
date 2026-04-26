import type { Command } from '../../../types/command.js'

const searchTools = {
  type: 'local',
  name: 'search-tools',
  description: 'Search for available tools by keyword',
  supportsNonInteractive: false,
  load: () => import('./SearchToolsCommandImpl.js'),
} satisfies Command

export const searchToolsCommand: Command = searchTools