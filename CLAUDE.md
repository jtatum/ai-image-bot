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

The bot uses a **Clean Architecture** pattern with the following layers:

- **Domain**: Core business entities and interfaces (`src/domain/`)
- **Application**: Business logic and use cases (`src/application/`)
- **Infrastructure**: External integrations (Discord, Google AI, monitoring) (`src/infrastructure/`)
- **Presentation**: UI layer for Discord commands and events (`src/presentation/`)
- **Shared**: Cross-cutting concerns and configuration (`src/shared/`)

The bot uses an **ExtendedClient** pattern where the Discord.js Client is extended with:

- `commands: Collection<string, Command>` - Dynamically loaded slash commands
- `cooldowns: Collection<string, Collection<string, number>>` - Per-user, per-command cooldown tracking
- `shutdown(): Promise<void>` - Graceful shutdown method

### Key Architectural Patterns

**Command System**: Commands are auto-loaded from `src/presentation/commands/implementations/` and extend the `BaseCommand` abstract class:

```typescript
abstract class BaseCommand {
  abstract readonly data: SlashCommandBuilder
  abstract readonly cooldown?: number // seconds, 0 disables cooldowns entirely
  protected abstract executeCommand(interaction: ChatInputCommandInteraction): Promise<void>
}
```

**Event System**: Events are auto-loaded from `src/presentation/events/implementations/` and extend the `BaseEvent` abstract class.

**Handler Architecture**: The interaction system is decomposed into specialized handlers:

- `CommandHandler` - Processes slash commands
- `ButtonHandler` - Handles button interactions
- `ModalHandler` - Processes modal submissions
- `CooldownHandler` - Manages per-user, per-command cooldowns
- `InteractionRouter` - Routes interactions to appropriate handlers

**Cooldown Architecture**: The sophisticated cooldown system:

- Uses nested Collections: `client.cooldowns.get(commandName).get(userId)`
- Supports `cooldown: 0` to completely disable cooldowns for a command
- Falls back to `command.cooldown ?? 3` for default behavior
- Uses `COMMAND_COOLDOWN_SECONDS` environment variable as global default

**Service Layer**: The application layer uses dependency injection with:

- `ImageGenerationService` - Core business logic for image operations
- `GeminiAdapter` - Implements `IImageGenerator` interface for Google AI integration
- Use cases (`GenerateImageUseCase`, `EditImageUseCase`, `RegenerateImageUseCase`) coordinate business workflows
- Services check availability via `isAvailable()` method and handle errors gracefully

### Environment Configuration

Uses **Zod validation** in `src/shared/config/environment.ts` with strict type checking. Key variables:

- `DISCORD_TOKEN`, `CLIENT_ID` (required)
- `GOOGLE_API_KEY` (optional, enables Gemini image generation)
- `COMMAND_COOLDOWN_SECONDS` (default: 30, set to 0 to disable globally)

### Path Aliases

The project uses extensive TypeScript path aliases that map to the new architecture:

- `@/*` maps to `src/*` (general)
- `@/domain/*` maps to `src/domain/*`
- `@/application/*` maps to `src/application/*`
- `@/infrastructure/*` maps to `src/infrastructure/*`
- `@/presentation/*` maps to `src/presentation/*`
- `@/shared/*` maps to `src/shared/*`

Both production code and tests use these aliases, requiring proper Jest configuration with `moduleNameMapper`.

## Testing Architecture

### Test Structure

- **100% test coverage** with comprehensive suites (35+ tests)
- Jest with ESM support and custom configuration
- Uses `ts-jest` with `strict: false` for tests to handle complex Discord.js mocking
- Tests organized by architecture layers: `tests/unit/domain/`, `tests/unit/application/`, `tests/unit/infrastructure/`, `tests/unit/presentation/`

### Critical Testing Patterns

- **Mock Timing**: Mocks must be defined BEFORE any imports that use them
- **Config Mocking**: The environment config is loaded once, so tests mock the config object directly, not process.env
- **Stateful Mocks**: Cooldown tests require stateful mocks that actually track state between calls
- **Service Mocking**: External APIs (like Google Gemini) are mocked at the module level

### Test Setup Files

- `tests/setup.ts` - Global Jest configuration and Discord.js mocking
- `tests/setupEnv.js` - Environment variables for tests
- `tests/helpers/mockInteractions.ts` - Reusable interaction mocks
- `tests/fixtures/mockCommand.ts` - Test command implementations

## Google Gemini Integration

The Google AI integration is implemented via the `GeminiAdapter` class:

- Uses `@google/genai` package with `gemini-2.5-flash-image-preview` model
- Implements the `IImageGenerator` interface for clean abstraction
- Converts base64 response data to Buffer for Discord attachments
- Configurable safety settings via environment variables (`GEMINI_SAFETY_*`)
- Gracefully handles missing API keys (service becomes unavailable)
- Proper error handling with user-friendly messages

## Development Patterns

### Adding New Commands

1. Create `src/presentation/commands/implementations/CommandName.ts` extending `BaseCommand`
2. Implement the abstract `executeCommand` method with your logic
3. Set appropriate `cooldown` value (or 0 to disable)
4. Add comprehensive tests in `tests/unit/presentation/commands/implementations/`
5. Deploy with `npm run deploy-commands`

Example command structure:

```typescript
export class MyCommand extends BaseCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('My awesome command')

  public readonly cooldown = 10 // Optional: 0 to disable

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await this.safeReply(interaction, 'Hello from my command!')
  }
}
```

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

## Current Architecture Status

**IMPORTANT**: This codebase uses a **Clean Architecture** implementation that has been fully migrated and is currently active in production.

### Current State

- The clean architecture is the **current and only system**
- All commands are loaded from `src/presentation/commands/implementations/`
- All events are loaded from `src/presentation/events/implementations/`
- 630 tests are passing with 100% coverage
- No legacy architecture remains

## Production Considerations

- Health checks available at `:3001/health`
- Graceful shutdown handles SIGTERM/SIGINT
- Winston logging with structured output (located at `src/infrastructure/monitoring/Logger.ts`)
- Docker containerization with non-root execution
- Environment validation prevents startup with invalid configuration
