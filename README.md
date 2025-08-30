# Gemini Discord Bot

A Discord bot that generates images using Google's Gemini AI model.

## Features

- `/gemini <prompt>` - Generate images from text descriptions
- `/ping` - Check bot latency
- `/info` - Display bot information
- Cooldown system to prevent spam
- Content safety filtering

## Setup

### Prerequisites

- Node.js 18+
- Discord Bot Token
- Google AI API Key (for image generation)

### Installation

1. Clone and install dependencies:

```bash
git clone <repository-url>
cd gemini-bot
npm install
```

2. Create `.env` file:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Optional - for image generation (bot will work without this)
GOOGLE_API_KEY=your_google_ai_api_key_here

# Optional - customize behavior
COMMAND_COOLDOWN_SECONDS=30
LOG_LEVEL=info
```

3. Deploy commands and start:

```bash
npm run build
npm run deploy-commands
npm start
```

### Development

```bash
npm run dev  # Hot reload development server
npm run deploy-commands:guild <GUILD_ID>  # Deploy to specific server for testing
```

## Commands

### `/gemini <prompt>`

Generate AI images using Google Gemini. Examples:

- `/gemini a cute robot in a futuristic city`
- `/gemini sunset over mountains, digital art style`
- `/gemini cyberpunk cat with neon lights`

The bot includes content safety filtering and will refuse inappropriate requests.

## Configuration

| Variable                   | Required | Default | Description                                                |
| -------------------------- | -------- | ------- | ---------------------------------------------------------- |
| `DISCORD_TOKEN`            | Yes      | -       | Discord bot token                                          |
| `CLIENT_ID`                | Yes      | -       | Discord application ID                                     |
| `GOOGLE_API_KEY`           | No       | -       | Google AI API key (image generation disabled without this) |
| `COMMAND_COOLDOWN_SECONDS` | No       | 30      | Global command cooldown                                    |
| `LOG_LEVEL`                | No       | info    | Logging level (error, warn, info, debug)                   |

## Development Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production build
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Check code style
npm run lint:fix     # Fix linting issues
npm run type-check   # TypeScript type checking
```

## Docker

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

## Architecture

The bot uses clean architecture with the following structure:

```
src/
├── application/        # Business logic and use cases
├── domain/            # Core entities and interfaces
├── infrastructure/    # External integrations (Discord, Google AI, monitoring)
├── presentation/      # Commands and events
└── shared/           # Configuration and utilities
```

## Health Monitoring

- Health check endpoint: `http://localhost:3001/health`
- Logs are written to `logs/` directory
- Graceful shutdown on SIGTERM/SIGINT

## License

MIT
