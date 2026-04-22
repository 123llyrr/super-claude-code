import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js'
import {
  companionUserId,
  getCompanion,
  roll,
} from '../buddy/companion.js'
import {
  RARITY_STARS,
  STAT_NAMES,
  type Companion,
  type StatName,
} from '../buddy/types.js'
import { renderSprite } from '../buddy/sprites.js'
import { enableConfigs, saveGlobalConfig } from '../utils/config.js'

// Simple name generation based on species and stats (fallback when no AI-generated name)
const SPECIES_PREFIX: Record<string, string[]> = {
  duck: ['Quackers', 'Ducky', 'Waddle', 'Puddles'],
  goose: ['Gus', 'Grace', 'Honker', 'Serena'],
  blob: ['Blobby', 'Gloop', 'Puddles', 'Goober'],
  cat: ['Whiskers', 'Mittens', 'Luna', 'Shadow'],
  dragon: ['Spark', 'Ember', 'Scales', 'Flame'],
  octopus: ['Ink', 'Splash', 'Tentie', 'Coral'],
  owl: ['Hoot', 'Sage', 'Night', 'Misty'],
  penguin: ['Waddle', 'Slippy', 'Frost', 'Pebble'],
  turtle: ['Shelly', 'Tank', 'Shell', 'Slowpoke'],
  snail: ['Shiny', 'Glide', 'Squish', 'Dewdrop'],
  ghost: ['Spooky', 'Boo', 'Misty', 'Phantom'],
  axolotl: ['Axel', 'Pink', 'Gills', 'Fluffin'],
  capybara: ['Chill', 'Buba', 'Relax', 'Zen'],
  cactus: ['Spike', 'Prickle', 'Sandy', 'Thorn'],
  robot: ['Beep', 'Byte', 'Circuit', 'Glitch'],
  rabbit: ['Hoppy', 'Cotton', 'Fluff', 'Thumper'],
  mushroom: ['Spore', 'Cap', 'Toad', 'Shroom'],
  chonk: ['Chonks', 'Biggles', 'Round', 'Bubbles'],
}

const PERSONALITY_TRAITS: string[] = [
  'curious', 'sleepy', 'energetic', 'grumpy', 'friendly',
  'mischievous', 'wise', 'silly', 'calm', 'fiesty',
]

function generateFallbackName(species: string): string {
  const prefixes = SPECIES_PREFIX[species] ?? ['Buddy', 'Pal', 'Friend']
  const seed = hashString(companionUserId() + species)
  return prefixes[seed % prefixes.length]!
}

function generateFallbackPersonality(stats: Record<StatName, number>): string {
  // Pick personality based on highest stat
  const entries = Object.entries(stats) as [StatName, number][]
  const highest = entries.reduce((a, b) => (a[1] > b[1] ? a : b))
  const seed = hashString(companionUserId() + highest[0])
  return PERSONALITY_TRAITS[seed % PERSONALITY_TRAITS.length]!
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function ensureCompanion(): Companion {
  const existing = getCompanion()
  if (existing) return existing

  // No companion exists - generate bones and create with fallback name/personality
  const userId = companionUserId()
  const { bones } = roll(userId)
  const name = generateFallbackName(bones.species)
  const personality = generateFallbackPersonality(bones.stats)

  const companion: Companion = {
    ...bones,
    name,
    personality,
    hatchedAt: Date.now(),
  }

  // Store the companion soul in config
  saveGlobalConfig(current => ({
    ...current,
    companion: {
      name: companion.name,
      personality: companion.personality,
      hatchedAt: companion.hatchedAt,
    },
  }))

  return companion
}

function renderStatBar(value: number, max = 100): string {
  const filled = Math.round((value / max) * 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function formatBuddyShow(companion: Companion): string {
  const spriteLines = renderSprite(companion, 0)
  const stars = RARITY_STARS[companion.rarity]
  const shinyLabel = companion.shiny ? ' ✨ SHINY' : ''

  const statsLines = STAT_NAMES.map(
    name => `  ${name.padEnd(10)} ${renderStatBar(companion.stats[name])} ${companion.stats[name]}`,
  ).join('\n')

  return [
    '```',
    ...spriteLines,
    '```',
    '',
    `## ${companion.name}`,
    '',
    `*${companion.personality}*`,
    '',
    `${stars}${shinyLabel} **${companion.rarity}** ${companion.species}`,
    '',
    '### Stats',
    statsLines,
    '',
    `Hatched: ${new Date(companion.hatchedAt).toLocaleDateString()}`,
  ].join('\n')
}

function formatBuddyPet(companion: Companion): string {
  const reactions = [
    `${companion.name} purrs contentedly! Hearts float above their head. 💕`,
    `${companion.name} nuzzles against your hand. They're so happy! 💖`,
    `${companion.name} closes their eyes and smiles. What a peaceful moment. 💗`,
    `You pet ${companion.name} gently. They lean into your touch. 💝`,
    `${companion.name} wiggles with joy! You're the best friend ever! 💞`,
  ]
  const seed = hashString(companionUserId() + 'pet')
  return reactions[seed % reactions.length]!
}

function formatBuddyStats(companion: Companion): string {
  const stars = RARITY_STARS[companion.rarity]

  const statsLines = STAT_NAMES.map(
    name => `${name.padEnd(10)} ${renderStatBar(companion.stats[name])} ${companion.stats[name]}`,
  ).join('\n')

  // Find peak and dump stats
  const entries = Object.entries(companion.stats) as [StatName, number][]
  const peak = entries.reduce((a, b) => (a[1] > b[1] ? a : b))
  const dump = entries.reduce((a, b) => (a[1] < b[1] ? a : b))

  return [
    `## ${companion.name}'s Stats`,
    '',
    `**Rarity:** ${stars} ${companion.rarity}`,
    '',
    '```',
    statsLines,
    '```',
    '',
    `Peak: ${peak[0]} (${peak[1]}) | Dump: ${dump[0]} (${dump[1]})`,
  ].join('\n')
}

const server = new Server(
  {
    name: 'buddy',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(
  ListToolsRequestSchema,
  async (): Promise<ListToolsResult> => ({
    tools: [
      {
        name: 'buddy_show',
        description: 'Show your buddy companion with ASCII art, name, personality, and stats',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'buddy_pet',
        description: 'Pet your buddy and get a loving reaction',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'buddy_stats',
        description: 'Show your buddy stats with visual bars',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }),
)

server.setRequestHandler(
  CallToolRequestSchema,
  async ({ params: { name, arguments: _args } }): Promise<CallToolResult> => {
    try {
      const companion = ensureCompanion()

      let output: string
      switch (name) {
        case 'buddy_show':
          output = formatBuddyShow(companion)
          break
        case 'buddy_pet':
          output = formatBuddyPet(companion)
          break
        case 'buddy_stats':
          output = formatBuddyStats(companion)
          break
        default:
          return {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          }
      }

      return {
        content: [{ type: 'text', text: output }],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${message}` }],
      }
    }
  },
)

async function runServer(): Promise<void> {
  // Enable config access before any config operations
  enableConfigs()

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

runServer().catch(console.error)
