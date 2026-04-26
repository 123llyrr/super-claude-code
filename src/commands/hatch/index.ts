import type { Command } from '../../commands.js'

const hatch = {
  type: 'local-jsx',
  name: 'hatch',
  description: 'Hatch a new companion — displays full card after hatching',
  immediate: true,
  load: () => import('./hatch.js'),
} satisfies Command

export default hatch
