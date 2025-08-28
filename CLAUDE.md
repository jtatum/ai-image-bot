# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

- `npm run dev` - Development server with hot reload using tsx
- `npm run build` - Build TypeScript to JavaScript with tsc and tsc-alias
- `npm start` - Start production build
- `npm run deploy-commands` - Deploy slash commands to Discord globally
- `npm run deploy-commands:guild <GUILD_ID>` - Deploy to specific guild (faster for development)

### Testing

- `npm test` - Run all tests (currently 35 tests with 100% pass rate)
- `npm test tests/unit/gemini.test.ts` - Run specific test file
- `npm test tests/unit/interactionCreate.test.ts` - Test cooldown logic
- `npm run test:watch` - Watch mode for development
- `npm run test:coverage` - Coverage report

### Code Quality

- `npm run lint` - ESLint check
- `npm run lint:fix` - Auto-fix linting issues
- `npm run type-check` - TypeScript type checking
- `npm run format` - Prettier formatting

## Architecture Overview

### Core System Design

The bot uses an **ExtendedClient** pattern where the Discord.js Client is extended with:

- `commands: Collection<string, Command>` - Dynamically loaded slash commands
- `cooldowns: Collection<string, Collection<string, number>>` - Per-user, per-command cooldown tracking
- `shutdown(): Promise<void>` - Graceful shutdown method

### Key Architectural Patterns

**Command System**: Commands are auto-loaded from `src/commands/` and must implement the `Command` interface:

```typescript
interface Command {
  data: SlashCommandBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  cooldown?: number // seconds, 0 disables cooldowns entirely
}
```

**Event System**: Events are auto-loaded from `src/events/` following the `Event` interface pattern.

**Cooldown Architecture**: The sophisticated cooldown system in `interactionCreate.ts`:

- Uses nested Collections: `client.cooldowns.get(commandName).get(userId)`
- Supports `cooldown: 0` to completely disable cooldowns for a command
- Falls back to `command.cooldown ?? 3` for default behavior
- Uses `COMMAND_COOLDOWN_SECONDS` environment variable as global default

**Service Layer**: External integrations like `GeminiService` are implemented as classes with:

- Constructor-time initialization based on environment variables
- `isAvailable()` method to check if service is configured
- Proper error handling and logging

### Environment Configuration

Uses **Zod validation** in `src/config/environment.ts` with strict type checking. Key variables:

- `DISCORD_TOKEN`, `CLIENT_ID` (required)
- `GOOGLE_API_KEY` (optional, enables Gemini image generation)
- `COMMAND_COOLDOWN_SECONDS` (default: 30, set to 0 to disable globally)

### Path Aliases

The project uses TypeScript path aliases (`@/*`) that map to `src/*`. Both production code and tests use these aliases, requiring proper Jest configuration with `moduleNameMapper`.

## Testing Architecture

### Test Structure

- **100% test coverage** with comprehensive suites
- Jest with ESM support and custom configuration
- Uses `ts-jest` with `strict: false` for tests to handle complex Discord.js mocking

### Critical Testing Patterns

- **Mock Timing**: Mocks must be defined BEFORE any imports that use them
- **Config Mocking**: The environment config is loaded once, so tests mock the config object directly, not process.env
- **Stateful Mocks**: Cooldown tests require stateful mocks that actually track state between calls
- **Service Mocking**: External APIs (like Google Gemini) are mocked at the module level

### Test Setup Files

- `tests/setup.ts` - Global Jest configuration and Discord.js mocking
- `tests/setupEnv.js` - Environment variables for tests
- `.env.test` - Test environment configuration

## Google Gemini Integration

The `GeminiService` class handles AI image generation:

- Uses `@google/genai` package with `gemini-2.5-flash-image-preview` model
- Converts base64 response data to Buffer for Discord attachments
- Gracefully handles missing API keys (service becomes unavailable)
- Implements proper error handling and safety filtering

## Development Patterns

### Adding New Commands

1. Create `src/commands/commandname.ts` implementing `Command` interface
2. Set appropriate `cooldown` value (or 0 to disable)
3. Add comprehensive tests in `tests/unit/`
4. Deploy with `npm run deploy-commands`

### Working with Cooldowns

- Use `cooldown: 0` to completely bypass cooldown logic
- Default cooldown is 3 seconds unless overridden
- Global default can be set via `COMMAND_COOLDOWN_SECONDS` environment variable
- Cooldowns are per-user, per-command

### Testing Strategy

- Mock external dependencies before imports
- Use stateful mocks for collections and cooldown tracking
- Test both success and error paths
- Verify cooldown behavior with timer mocking

## Production Considerations

- Health checks available at `:3001/health`
- Graceful shutdown handles SIGTERM/SIGINT
- Winston logging with structured output
- Docker containerization with non-root execution
- Environment validation prevents startup with invalid configuration
