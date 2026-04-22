import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Interact with your companion — /buddy pet to give pets',
  immediate: true,
  aliases: ['companion', 'pet'],
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
