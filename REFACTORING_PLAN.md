# Refactoring Plan: Improving Separation of Concerns

## Overview

This plan outlines an incremental approach to refactor the Gemini Discord Bot to improve separation of concerns, reduce file complexity, and establish clearer architectural boundaries.

**UPDATE**: After Phase 2 implementation, we've adopted a parallel implementation strategy where new architecture is built alongside the old, allowing for safe development and atomic switchover.

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

## Implementation Status & Adjusted Plan

### ✅ Phase 1: Foundation - COMPLETE

- Created directory structure (application, domain, infrastructure, presentation, shared)
- Created domain interfaces and entities
- Created base classes (BaseCommand, BaseEvent)

### ✅ Phase 2: Extract Handlers - COMPLETE (with parallel approach)

- Created all handlers (CooldownHandler, CommandHandler, ButtonHandler, ModalHandler)
- Created InteractionRouter to orchestrate handlers
- Created new InteractionCreateEvent as parallel implementation
- Old interactionCreate.ts still running (intentionally)
- 5 tests correctly skipped (testing future functionality)

**Note**: We've adopted a parallel implementation strategy where the new architecture is built alongside the old one, allowing for zero-risk development and clean switchover.

### Phase 3: Consolidate Builders (Updated for Parallel Approach)

**Goal**: Unify Discord UI component creation in parallel structure

#### Step 3.1: Create Builder Classes

- [ ] Create `infrastructure/discord/builders/ButtonBuilder.ts` (enhance from utils/buttons.ts)
- [ ] Create `infrastructure/discord/builders/ModalBuilder.ts` (enhance from utils/modalHelpers.ts)
- [ ] Create `infrastructure/discord/builders/ResponseBuilder.ts` (consolidate from imageHelpers.ts)
- [ ] Keep old utils files untouched for now

#### Step 3.2: Update New Handlers to Use Builders

- [ ] Update ButtonHandler to use new ButtonBuilder
- [ ] Update ModalHandler to use new ModalBuilder
- [ ] Keep old code paths unchanged

### Phase 4: Extract Business Logic (Updated for Parallel Approach)

**Goal**: Create clean business layer parallel to existing code

#### Step 4.1: Create Application Services

- [ ] Create `application/services/ImageGenerationService.ts` (Discord-agnostic)
- [ ] Create `infrastructure/google/GeminiAdapter.ts` implementing IImageGenerator
- [ ] Keep existing services/gemini.ts running

#### Step 4.2: Create Use Cases

- [ ] Create `application/use-cases/GenerateImageUseCase.ts`
- [ ] Create `application/use-cases/EditImageUseCase.ts`
- [ ] Create `application/use-cases/RegenerateImageUseCase.ts`
- [ ] Wire use cases to new services

#### Step 4.3: Create New Command Implementations

- [ ] Create `presentation/commands/implementations/GeminiCommand.ts` using use cases
- [ ] Create `presentation/commands/implementations/PingCommand.ts` extending BaseCommand
- [ ] Create `presentation/commands/implementations/InfoCommand.ts` extending BaseCommand
- [ ] Keep old commands in src/commands/ running

### Phase 5: The Switchover (Completely Revised)

**Goal**: Single clean switch from old to new architecture

#### Step 5.1: Update EventLoader

- [ ] Modify EventLoader to support both old and new event locations
- [ ] Add flag to choose between old/new architecture
- [ ] Test loading new InteractionCreateEvent

#### Step 5.2: Update CommandLoader

- [ ] Modify CommandLoader to support both old and new command locations
- [ ] Add flag to choose between old/new commands
- [ ] Test loading new command implementations

#### Step 5.3: Integration Testing

- [ ] Test bot with new architecture in dev environment
- [ ] Verify all interactions work (commands, buttons, modals)
- [ ] Check cooldown system functions correctly
- [ ] Verify health checks and monitoring work

#### Step 5.4: The Switch

- [ ] Update loaders to use new locations by default
- [ ] Enable the 5 skipped tests
- [ ] Fix any Collection mocking issues in tests
- [ ] Run full test suite - ensure 100% pass rate

#### Step 5.5: Cleanup

- [ ] Delete old src/events/interactionCreate.ts
- [ ] Delete old command files from src/commands/
- [ ] Move remaining utils to shared/utils/
- [ ] Delete obsolete utility files
- [ ] Update all imports

### Phase 6: Documentation and Final Validation

**Goal**: Document the new architecture and ensure quality

#### Step 6.1: Update Documentation

- [ ] Update README.md with new architecture
- [ ] Update CLAUDE.md with new patterns
- [ ] Add architecture diagram
- [ ] Document new testing patterns

#### Step 6.2: Final Validation

- [ ] Full test suite passes (no skipped tests)
- [ ] All linting passes
- [ ] Type checking passes
- [ ] Performance benchmarks

#### Step 6.3: Accumulated tech debt

- [ ] deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
- [ ] deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported

## Success Metrics

1. **Zero breaking changes** during development
2. **100% test coverage** maintained
3. **No regression** in functionality
4. **Clean switch** - single commit to flip from old to new
5. **Improved maintainability** - measured by file size and complexity

## Rollback Plan

With the parallel implementation approach:

1. Old code remains fully functional throughout development
2. New code is built and tested in isolation
3. Switchover is a simple flag/configuration change
4. Rollback is instant - just revert the switch

## Risk Mitigation

1. **Parallel Development**: Build new without touching old
2. **Comprehensive Testing**: Test new architecture thoroughly before switch
3. **Atomic Switchover**: Single point of change reduces risk
4. **Incremental Validation**: Each phase independently testable
5. **Monitoring**: Watch logs during and after switchover

## Timeline Estimate (Revised)

- Phase 3: 2-3 hours
- Phase 4: 4-5 hours
- Phase 5: 3-4 hours (including testing)
- Phase 6: 1-2 hours

**Total**: ~12-14 hours (reduced from original 21-27 hours due to parallel approach)

## Key Advantages of Parallel Approach

1. **Risk-free development** - Bot stays functional throughout
2. **Clean architecture** - No hybrid/messy code
3. **Easy rollback** - Just flip the switch back
4. **Better testing** - Can validate new architecture thoroughly
5. **Simpler commits** - Each phase is independent
6. **Learning opportunity** - Can compare old vs new performance

## Notes

- The parallel implementation strategy emerged during Phase 2 implementation
- 5 skipped tests are intentional - they test future functionality
- Linting issues in new code should be fixed before proceeding
- Each phase should be completed fully before moving to the next
- The switchover (Phase 5) is now the critical phase requiring careful execution
