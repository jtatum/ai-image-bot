import { z } from 'zod'
import dotenv from 'dotenv'

// Only load .env file if not in test environment and not already loaded
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  dotenv.config()
}

const harmBlockThresholdEnum = z.enum([
  'OFF',
  'BLOCK_NONE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_LOW_AND_ABOVE',
])

const environmentSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'Discord token is required'),
  CLIENT_ID: z.string().min(1, 'Discord client ID is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DATABASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  HEALTH_CHECK_PORT: z.coerce.number().default(3001),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  COMMAND_COOLDOWN_SECONDS: z.coerce.number().default(30),
  USE_NEW_ARCHITECTURE: z.coerce.boolean().default(false),
  BOT_ACTIVITIES: z.string().optional(),
  GEMINI_SAFETY_HARASSMENT: harmBlockThresholdEnum.optional(),
  GEMINI_SAFETY_HATE_SPEECH: harmBlockThresholdEnum.optional(),
  GEMINI_SAFETY_SEXUALLY_EXPLICIT: harmBlockThresholdEnum.optional(),
  GEMINI_SAFETY_DANGEROUS_CONTENT: harmBlockThresholdEnum.optional(),
  GEMINI_SAFETY_CIVIC_INTEGRITY: harmBlockThresholdEnum.optional(),
})

export type Environment = z.infer<typeof environmentSchema>

let config: Environment

try {
  config = environmentSchema.parse(process.env)
} catch (error) {
  console.error('❌ Invalid environment configuration:', error)
  process.exit(1)
}

export { config }
export default config
