# Claude Development Guide

This file contains development instructions and commands for Claude Code to help maintain and extend the Gemini Discord Bot.

## Quick Commands

### Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production build
- `npm run deploy-commands` - Deploy slash commands to Discord globally
- `npm run deploy-commands:guild <GUILD_ID>` - Deploy commands to specific guild (faster)

### Testing

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types

### Docker

- `docker-compose up -d` - Start production containers
- `docker-compose -f docker-compose.dev.yml up` - Start development containers
- `docker-compose --profile with-db up -d` - Start with PostgreSQL and Redis

## Project Structure

- `src/bot/` - Core bot functionality (client, types)
- `src/commands/` - Slash command handlers
- `src/events/` - Discord event listeners
- `src/services/` - Business logic and external integrations
- `src/utils/` - Utility functions and helpers
- `src/config/` - Configuration management
- `tests/` - Test files (unit, integration)

## Common Tasks

### Adding a New Command

1. Create file in `src/commands/newcommand.ts`
2. Follow the Command interface pattern
3. Run `npm run deploy-commands` to register with Discord
4. Add tests in `tests/unit/commands/`

### Adding a New Event

1. Create file in `src/events/newevent.ts`
2. Follow the Event interface pattern
3. Event will be automatically loaded on restart

### Environment Setup

1. Copy `.env.example` to `.env`
2. Set required variables: `DISCORD_TOKEN`, `CLIENT_ID`
3. Optional: Set `LOG_LEVEL`, `NODE_ENV`, etc.

### Running Tests

- Unit tests: `npm test tests/unit/`
- Integration tests: `npm test tests/integration/`
- Specific test file: `npm test -- <filename>`

## Deployment Notes

- Production builds require `npm run build` first
- Use environment-specific Docker Compose files
- Health checks available at `:3001/health`
- Logs stored in `logs/` directory
- Graceful shutdown with SIGTERM/SIGINT

## Troubleshooting

- Check logs in `logs/` directory
- Verify environment variables in `.env`
- Ensure Discord token and permissions are correct
- Test commands locally before deploying
- Use health check endpoint to verify status

## Security Considerations

- Never commit `.env` files
- Validate all user inputs
- Check permissions before command execution
- Use HTTPS for external URLs only
- Rate limiting is enforced per user/command
