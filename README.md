# Gemini Bot

A production-grade Discord bot built with TypeScript, Discord.js v14, and modern development practices.

## ✨ Features

- 🔧 **Modern Stack**: TypeScript, Discord.js v14, Node.js 18+
- 🚀 **Production Ready**: Docker support, health checks, graceful shutdown
- 🔒 **Security**: Input validation, rate limiting, permission system
- 🧪 **Testing**: Comprehensive test suite with Jest
- 📊 **Monitoring**: Winston logging, health endpoints, metrics
- 🔄 **CI/CD**: GitHub Actions pipeline
- 🛡️ **Error Handling**: Robust error handling and recovery
- 📁 **Modular**: Clean architecture with command and event handlers

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Discord Application & Bot Token

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd gemini-bot
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and add your Discord bot token and client ID:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
```

4. Build the project:

```bash
npm run build
```

5. Deploy commands to Discord:

```bash
npm run deploy-commands
```

6. Start the bot:

```bash
npm start
```

### Development

For development with hot reload:

```bash
npm run dev
```

## 🐳 Docker

### Development

```bash
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
docker-compose up -d
```

### With Database (PostgreSQL + Redis)

```bash
docker-compose --profile with-db up -d
```

## 📝 Commands

- `/ping` - Check bot latency and responsiveness
- `/info` - Display bot information and statistics

## 🧪 Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 🔧 Development

### Project Structure

```
gemini-bot/
├── src/
│   ├── bot/           # Core bot functionality
│   │   ├── client.ts  # Discord client setup
│   │   └── types.ts   # TypeScript interfaces
│   ├── commands/      # Slash commands
│   │   ├── ping.ts
│   │   └── info.ts
│   ├── events/        # Event listeners
│   │   ├── ready.ts
│   │   ├── interactionCreate.ts
│   │   └── guildCreate.ts
│   ├── services/      # Business logic
│   │   └── healthCheck.ts
│   ├── utils/         # Utilities and helpers
│   │   ├── commandLoader.ts
│   │   ├── eventLoader.ts
│   │   ├── rateLimiter.ts
│   │   ├── permissions.ts
│   │   ├── validation.ts
│   │   └── gracefulShutdown.ts
│   ├── config/        # Configuration
│   │   ├── environment.ts
│   │   └── logger.ts
│   └── index.ts       # Entry point
├── tests/
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── fixtures/      # Test fixtures
└── docker/            # Docker configuration
```

### Adding New Commands

1. Create a new file in `src/commands/`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'

const myCommand: Command = {
  data: new SlashCommandBuilder().setName('mycommand').setDescription('My awesome command'),

  cooldown: 5, // Optional cooldown in seconds

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Hello from my command!')
  },
}

export default myCommand
```

2. The command will be automatically loaded on bot restart
3. Deploy commands to Discord: `npm run deploy-commands`

### Adding New Events

1. Create a new file in `src/events/`:

```typescript
import { Events } from 'discord.js'
import { Event } from '@/bot/types.js'

const myEvent: Event = {
  name: Events.MessageCreate,
  once: false, // Set to true for one-time events

  async execute(message) {
    // Handle the event
  },
}

export default myEvent
```

2. The event will be automatically loaded on bot restart

### Environment Variables

| Variable                  | Required | Default       | Description                   |
| ------------------------- | -------- | ------------- | ----------------------------- |
| `DISCORD_TOKEN`           | Yes      | -             | Discord bot token             |
| `CLIENT_ID`               | Yes      | -             | Discord application client ID |
| `NODE_ENV`                | No       | `development` | Environment mode              |
| `LOG_LEVEL`               | No       | `info`        | Logging level                 |
| `PORT`                    | No       | `3000`        | Application port              |
| `HEALTH_CHECK_PORT`       | No       | `3001`        | Health check port             |
| `RATE_LIMIT_WINDOW_MS`    | No       | `60000`       | Rate limit window             |
| `RATE_LIMIT_MAX_REQUESTS` | No       | `100`         | Max requests per window       |

## 🔍 Monitoring

### Health Checks

The bot provides several health check endpoints:

- `GET /health` - Comprehensive health status
- `GET /ready` - Readiness probe
- `GET /metrics` - Basic metrics

### Logging

Logs are written to:

- Console (with colors in development)
- `logs/error.log` (errors only)
- `logs/combined.log` (all logs)

### Production Monitoring

- Health checks for container orchestration
- Structured logging with Winston
- Graceful shutdown handling
- Error recovery and reporting

## 🛡️ Security

- Input validation and sanitization
- Rate limiting per user and command
- Permission checking system
- Malicious content detection
- HTTPS-only external URLs
- Non-root Docker container

## 🚢 Deployment

### Manual Deployment

1. Build the Docker image:

```bash
docker build -t gemini-bot .
```

2. Run with environment variables:

```bash
docker run -d \
  --name gemini-bot \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -p 3001:3001 \
  gemini-bot
```

### CI/CD Pipeline

The project includes a GitHub Actions workflow that:

1. **Tests** - Runs linting, type checking, and unit tests
2. **Security** - Performs security audit
3. **Build** - Builds and tests Docker image
4. **Deploy** - Deploys to production (when pushed to main)

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For support and questions:

- Check the [Issues](../../issues) page
- Review the documentation
- Join our Discord server (if available)

---

Built with ❤️ using TypeScript and Discord.js
