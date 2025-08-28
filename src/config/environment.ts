import { z } from 'zod'
import dotenv from 'dotenv'

// Only load .env file if not in test environment and not already loaded
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  dotenv.config()
}

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
