# Refactoring Plan: Improving Separation of Concerns

## Overview

This plan outlines an incremental approach to refactor the Gemini Discord Bot to improve separation of concerns, reduce file complexity, and establish clearer architectural boundaries.

## Current Issues

1. **Mixed Responsibilities in Utils**: `src/utils/` contains Discord-specific logic, business logic, and UI components
2. **Monolithic Event Handler**: `src/events/interactionCreate.ts` handles commands, buttons, modals, and cooldowns (120+ lines)
3. **Scattered Image Logic**: Image-related functionality spread across 6+ utility files
4. **Tight Coupling**: Business logic mixed with Discord presentation layer
5. **Testing Complexity**: Difficult to test business logic in isolation

## Target Architecture

```
src/
├── application/           # Application services (business logic)
│   ├── services/
│   │   ├── GeminiService.ts         # Existing, to be moved
│   │   └── ImageGenerationService.ts # New abstraction layer
│   └── use-cases/
│       ├── GenerateImageUseCase.ts   # Business workflow
│       ├── EditImageUseCase.ts       # Business workflow
│       └── RegenerateImageUseCase.ts # Business workflow
├── domain/               # Core business entities & interfaces
│   ├── entities/
│   │   └── ImageRequest.ts          # Domain model
│   └── interfaces/
│       ├── IImageGenerator.ts       # Provider abstraction
│       └── IImageResult.ts          # Result abstraction
├── infrastructure/       # External integrations
│   ├── discord/
│   │   ├── client/
│   │   │   └── ExtendedClient.ts    # From bot/client.ts
│   │   ├── handlers/
│   │   │   ├── CommandHandler.ts    # Extract from interactionCreate
│   │   │   ├── ButtonHandler.ts     # Extract from interactionCreate
│   │   │   ├── ModalHandler.ts      # Extract from interactionCreate
│   │   │   └── CooldownHandler.ts   # Extract from interactionCreate
│   │   └── builders/
│   │       ├── ResponseBuilder.ts   # Consolidate response logic
│   │       ├── ButtonBuilder.ts     # From utils/buttons.ts
│   │       └── ModalBuilder.ts      # From utils/modalHelpers.ts
│   ├── google/
│   │   └── GeminiAdapter.ts        # Implement IImageGenerator
│   └── monitoring/
│       ├── Logger.ts                # From config/logger.ts
│       └── HealthCheck.ts          # From services/healthCheck.ts
├── presentation/         # UI layer (Discord commands/events)
│   ├── commands/
│   │   ├── base/
│   │   │   └── BaseCommand.ts      # Abstract command class
│   │   └── implementations/
│   │       ├── GeminiCommand.ts    # Refactored command
│   │       ├── PingCommand.ts      # Minimal changes
│   │       └── InfoCommand.ts      # Minimal changes
│   └── events/
│       ├── base/
│       │   └── BaseEvent.ts        # Abstract event class
│       └── implementations/
│           ├── InteractionCreateEvent.ts # Simplified router
│           ├── ReadyEvent.ts        # Minimal changes
│           └── ErrorEvent.ts        # Minimal changes
└── shared/              # Cross-cutting concerns
    ├── config/
    │   ├── environment.ts           # Keep as-is
    │   └── constants.ts             # New file for magic numbers
    └── utils/
        ├── validation.ts            # Keep validation utils
        └── rateLimiter.ts          # Keep rate limiting

```

## Incremental Implementation Steps

### Phase 1: Foundation (Low Risk)

**Goal**: Set up new structure without breaking existing code

#### Step 1.1: Create Directory Structure

- [ ] Create new directories: `application`, `domain`, `infrastructure`, `presentation`, `shared`
- [ ] Add README.md in each directory explaining its purpose
- [ ] No code changes yet, just structure

#### Step 1.2: Create Domain Interfaces

- [ ] Create `domain/interfaces/IImageGenerator.ts`
- [ ] Create `domain/interfaces/IImageResult.ts`
- [ ] Create `domain/entities/ImageRequest.ts`
- [ ] These are new files, won't break existing code

#### Step 1.3: Create Base Classes

- [ ] Create `presentation/commands/base/BaseCommand.ts`
- [ ] Create `presentation/events/base/BaseEvent.ts`
- [ ] Add common functionality (logging, error handling)
- [ ] No migration yet, just preparation

### Phase 2: Extract Handlers (Medium Risk)

**Goal**: Break down the monolithic `interactionCreate.ts`

#### Step 2.1: Create Handler Abstractions

- [ ] Create `infrastructure/discord/handlers/CooldownHandler.ts`
  - Extract cooldown logic (lines 73-99 from interactionCreate.ts)
  - Add tests for CooldownHandler
- [ ] Create `infrastructure/discord/handlers/CommandHandler.ts`
  - Extract command execution logic
  - Add tests for CommandHandler

#### Step 2.2: Create Interaction Handlers

- [ ] Create `infrastructure/discord/handlers/ButtonHandler.ts`
  - Extract button handling logic (lines 12-35)
  - Map button IDs to handler functions
- [ ] Create `infrastructure/discord/handlers/ModalHandler.ts`
  - Extract modal handling logic (lines 38-61)
  - Map modal IDs to handler functions

#### Step 2.3: Refactor InteractionCreate Event

- [ ] Update `interactionCreate.ts` to use new handlers
- [ ] Should shrink from 120 lines to ~40 lines
- [ ] Run all tests to ensure nothing breaks

### Phase 3: Consolidate Builders (Low Risk)

**Goal**: Unify Discord UI component creation

#### Step 3.1: Move and Enhance Builders

- [ ] Move `utils/buttons.ts` → `infrastructure/discord/builders/ButtonBuilder.ts`
- [ ] Move `utils/modalHelpers.ts` → `infrastructure/discord/builders/ModalBuilder.ts`
- [ ] Create `infrastructure/discord/builders/ResponseBuilder.ts`
  - Consolidate response creation from `imageHelpers.ts` and `interactionHelpers.ts`

#### Step 3.2: Update Imports

- [ ] Update all files importing from old locations
- [ ] Run tests after each file update
- [ ] Keep old files temporarily for safety

### Phase 4: Extract Business Logic (Medium Risk)

**Goal**: Separate business logic from Discord presentation

#### Step 4.1: Create Image Generation Service

- [ ] Create `application/services/ImageGenerationService.ts`
  - Extract core logic from `commands/gemini.ts`
  - Make it Discord-agnostic
- [ ] Create `infrastructure/google/GeminiAdapter.ts`
  - Implement `IImageGenerator` interface
  - Wrap existing `services/gemini.ts`

#### Step 4.2: Create Use Cases

- [ ] Create `application/use-cases/GenerateImageUseCase.ts`
  - Move logic from `commands/gemini.ts`
- [ ] Create `application/use-cases/EditImageUseCase.ts`
  - Move logic from `utils/editImage.ts`
- [ ] Create `application/use-cases/RegenerateImageUseCase.ts`
  - Move logic from `utils/regenerateImage.ts`

#### Step 4.3: Update Commands

- [ ] Refactor `GeminiCommand.ts` to use new use cases
- [ ] Command should only handle Discord interaction flow
- [ ] Business logic delegated to use cases

### Phase 5: Migration (High Risk)

**Goal**: Move files to new locations and update all references

#### Step 5.1: Move Core Files

- [ ] Move `bot/client.ts` → `infrastructure/discord/client/ExtendedClient.ts`
- [ ] Move `config/logger.ts` → `infrastructure/monitoring/Logger.ts`
- [ ] Move `services/healthCheck.ts` → `infrastructure/monitoring/HealthCheck.ts`
- [ ] Update all imports

#### Step 5.2: Move Commands and Events

- [ ] Move commands to `presentation/commands/implementations/`
- [ ] Update commands to extend `BaseCommand`
- [ ] Move events to `presentation/events/implementations/`
- [ ] Update events to extend `BaseEvent`

#### Step 5.3: Clean Up Utils

- [ ] Move remaining valid utils to `shared/utils/`
- [ ] Delete obsolete utility files
- [ ] Ensure no broken imports

### Phase 6: Testing and Documentation (Low Risk)

**Goal**: Ensure everything works and is documented

#### Step 6.1: Update Tests

- [ ] Update test imports to new locations
- [ ] Add tests for new abstractions
- [ ] Ensure 100% test coverage maintained
- [ ] Run full test suite

#### Step 6.2: Update Documentation

- [ ] Update README.md with new architecture
- [ ] Update CLAUDE.md with new patterns
- [ ] Add architecture diagram
- [ ] Document new conventions

#### Step 6.3: Performance Testing

- [ ] Test bot with all commands
- [ ] Verify cooldown system works
- [ ] Check memory usage
- [ ] Ensure no regressions

## Success Metrics

1. **File Size**: No file larger than 80 lines (except tests)
2. **Single Responsibility**: Each class/module has one clear purpose
3. **Test Coverage**: Maintain 100% test coverage
4. **Performance**: No degradation in response times
5. **Maintainability**: New features easier to add

## Rollback Plan

1. Keep all old files during migration
2. Use feature flags if needed
3. Tag git commit before each phase
4. Have parallel implementations during transition
5. Only delete old files after full validation

## Risk Mitigation

1. **Incremental Changes**: Small, testable steps
2. **Backwards Compatibility**: Keep old code working during transition
3. **Comprehensive Testing**: Test after each step
4. **Code Reviews**: Review each phase before proceeding
5. **Monitoring**: Watch logs for errors during migration

## Timeline Estimate

- Phase 1: 2-3 hours (low complexity)
- Phase 2: 4-5 hours (medium complexity)
- Phase 3: 2-3 hours (low complexity)
- Phase 4: 5-6 hours (medium complexity)
- Phase 5: 3-4 hours (high risk, careful execution)
- Phase 6: 2-3 hours (validation)

**Total**: ~21-27 hours of focused work

## Notes

- Each checkbox represents a discrete, testable unit of work
- Complete each phase fully before moving to the next
- Run tests after every step
- Commit after each successful step
- If any step fails, stop and reassess before continuing
