# 🤖 Gemini Discord Bot

A powerful, production-ready Discord bot featuring Google Gemini AI image generation, built with TypeScript, Discord.js v14, and modern development practices.

## ✨ Features

### 🎨 **AI-Powered Image Generation**

- `/gemini <prompt>` - Generate images using Google's Gemini 2.5 Flash Image Preview model
- Smart content filtering and safety responses
- High-quality image generation from natural language descriptions

### 🛠️ **Core Bot Features**

- `/ping` - Check bot latency and responsiveness
- `/info` - Display bot information and statistics
- Smart cooldown system with configurable per-command limits
- Robust error handling and user-friendly responses

### 🚀 **Production-Grade Architecture**

- **Modern Stack**: TypeScript, Discord.js v14, Node.js 18+
- **AI Integration**: Google Gemini API for image generation
- **Testing**: 100% test coverage with Jest (35/35 tests passing)
- **Security**: Input validation, rate limiting, permission system
- **Monitoring**: Winston logging, health endpoints, graceful shutdown
- **Docker**: Full containerization with multi-stage builds
- **CI/CD**: Automated testing and deployment pipeline

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Discord Application & Bot Token
- Google AI API Key (for image generation)

### Installation

1. **Clone and install:**

```bash
git clone <repository-url>
cd gemini-bot
npm install
```

2. **Environment setup:**

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Optional - for image generation
GOOGLE_API_KEY=your_google_ai_api_key_here

# Customizable
COMMAND_COOLDOWN_SECONDS=30
LOG_LEVEL=info
```

3. **Build and deploy:**

```bash
npm run build
npm run deploy-commands
npm start
```

### Development Mode

```bash
npm run dev  # Hot reload with tsx
```

## 🎨 Commands

### `/gemini <prompt>`

Generate AI images using Google Gemini:

```
/gemini a cute robot playing chess in a futuristic city
/gemini sunset over mountains, digital art style
/gemini cyberpunk cat with neon lights, 4K
```

**Features:**

- Advanced AI image generation
- Content safety filtering
- Base64 to Discord attachment conversion
- Comprehensive error handling

### `/ping`

Check bot responsiveness and latency

### `/info`

Display bot statistics and system information

## 🧪 Testing

The bot has **100% test coverage** with comprehensive test suites:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run specific test suites
npm test tests/unit/gemini.test.ts
npm test tests/unit/interactionCreate.test.ts
```

**Test Coverage:**

- ✅ Cooldown logic (including 0-second cooldowns)
- ✅ Gemini AI image generation
- ✅ Command execution and error handling
- ✅ Rate limiting and user management
- ✅ Configuration validation
- ✅ Health checks and monitoring

## 🐳 Docker Deployment

### Development

```bash
docker-compose -f docker-compose.dev.yml up
```

### Production

```bash
docker-compose up -d
```

### With Database Support

```bash
docker-compose --profile with-db up -d
```

## 🏗️ Architecture

```
gemini-bot/
├── src/
│   ├── bot/              # Core Discord client & types
│   ├── commands/         # Slash commands
│   │   ├── gemini.ts     # AI image generation
│   │   ├── ping.ts       # Latency check
│   │   └── info.ts       # Bot information
│   ├── events/           # Discord event handlers
│   │   ├── ready.ts      # Bot startup
│   │   ├── interactionCreate.ts  # Command handling + cooldowns
│   │   └── guildCreate.ts        # New server setup
│   ├── services/         # Business logic
│   │   ├── gemini.ts     # Google AI integration
│   │   └── healthCheck.ts # Monitoring
│   ├── utils/            # Utilities
│   │   ├── rateLimiter.ts # Rate limiting
│   │   ├── commandLoader.ts # Dynamic command loading
│   │   └── deployCommands.ts # Discord API deployment
│   ├── config/           # Configuration
│   │   ├── environment.ts # Zod validation
│   │   └── logger.ts     # Winston setup
│   └── index.ts          # Application entry point
└── tests/
    ├── unit/             # Unit tests (35 tests)
    ├── integration/      # Integration tests
    └── setup.ts          # Test configuration
```

## ⚙️ Configuration

| Variable                   | Required    | Default       | Description                            |
| -------------------------- | ----------- | ------------- | -------------------------------------- |
| `DISCORD_TOKEN`            | ✅ Yes      | -             | Discord bot token                      |
| `CLIENT_ID`                | ✅ Yes      | -             | Discord application ID                 |
| `GOOGLE_API_KEY`           | 🔶 Optional | -             | Google AI API key for image generation |
| `COMMAND_COOLDOWN_SECONDS` | ❌ No       | `30`          | Global command cooldown (0 to disable) |
| `NODE_ENV`                 | ❌ No       | `development` | Environment mode                       |
| `LOG_LEVEL`                | ❌ No       | `info`        | Winston log level                      |
| `PORT`                     | ❌ No       | `3000`        | Application port                       |
| `HEALTH_CHECK_PORT`        | ❌ No       | `3001`        | Health check endpoint port             |

## 🔧 Development

### Adding New Commands

1. Create `src/commands/mycommand.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'

const myCommand: Command = {
  data: new SlashCommandBuilder().setName('mycommand').setDescription('My awesome command'),

  cooldown: 10, // Optional: cooldown in seconds (0 to disable)

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Hello from my command!')
  },
}

export default myCommand
```

2. Deploy: `npm run deploy-commands`

### Cooldown System

The bot features a sophisticated cooldown system:

- **Per-command cooldowns**: Each command can have its own cooldown period
- **Per-user tracking**: Cooldowns are tracked individually for each user
- **Zero-cooldown support**: Set `cooldown: 0` to disable cooldowns entirely
- **Global configuration**: `COMMAND_COOLDOWN_SECONDS` sets default for commands without specific cooldowns
- **Real-time feedback**: Users get precise time-remaining notifications

## 🛡️ Security & Best Practices

- **Input validation**: Zod schema validation for all configurations
- **Rate limiting**: Configurable per-user and per-command limits
- **Content filtering**: AI-powered safety checks for generated content
- **Permission system**: Role-based access control ready
- **Secure containers**: Non-root Docker execution
- **Environment isolation**: Proper secret management
- **Error boundaries**: Graceful error handling and recovery

## 📊 Monitoring & Health Checks

### Endpoints

- `GET /health` - Comprehensive system status
- `GET /ready` - Kubernetes-ready probe
- `GET /metrics` - Bot statistics and performance

### Logging

- **Structured logging** with Winston
- **Log files**: `logs/error.log`, `logs/combined.log`
- **Development**: Colorized console output
- **Production**: JSON-formatted logs for log aggregation

## 🚢 Production Deployment

### CI/CD Pipeline

1. **Quality Gates**: Linting, type checking, security audit
2. **Testing**: Full test suite (35 tests) must pass
3. **Build**: Multi-stage Docker build with optimization
4. **Deploy**: Automated deployment on successful builds

### Container Features

- **Multi-stage builds** for optimized production images
- **Health checks** for container orchestration
- **Graceful shutdown** handling (SIGTERM/SIGINT)
- **Resource limits** and security policies
- **Log aggregation** ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Follow code style: `npm run lint && npm run format`
6. Submit a pull request

### Development Workflow

```bash
# Start development
npm run dev

# Run tests continuously
npm run test:watch

# Check code quality
npm run lint
npm run type-check

# Deploy commands during development
npm run deploy-commands:guild YOUR_GUILD_ID
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏆 Project Status

- ✅ **100% Test Coverage** (35/35 tests passing)
- ✅ **Production Ready** with Docker deployment
- ✅ **AI Integration** with Google Gemini
- ✅ **Modern TypeScript** with strict type checking
- ✅ **Comprehensive Documentation**
- ✅ **Security Best Practices**

---

**Built with ❤️ using TypeScript, Discord.js, and Google Gemini AI**

_A modern Discord bot that brings AI image generation to your server with production-grade reliability and comprehensive testing._
