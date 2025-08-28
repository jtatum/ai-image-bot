// Set up test environment before loading any modules
// CRITICAL: Set NODE_ENV first to prevent .env file loading
process.env.NODE_ENV = 'test'
process.env.DISCORD_TOKEN = 'test_token_123456789'
process.env.CLIENT_ID = 'test_client_id_123456789'
process.env.LOG_LEVEL = 'error'
process.env.PORT = '3000'
process.env.HEALTH_CHECK_PORT = '3001'
process.env.RATE_LIMIT_WINDOW_MS = '60000'
process.env.RATE_LIMIT_MAX_REQUESTS = '100'

// Clear any environment variables that might have been loaded from .env
delete process.env._ENV_LOADED