# Shared Layer

This directory contains cross-cutting concerns and utilities used across all layers.

## Purpose

The shared layer provides common functionality that doesn't belong to a specific architectural layer:

- **Configuration** - Environment variables and application settings
- **Utilities** - Helper functions and common operations
- **Constants** - Application-wide constants and enums
- **Types** - Common type definitions used across layers

## Structure

- `config/` - Configuration management and validation
- `utils/` - Pure utility functions and helpers

## Rules

1. **No business logic** - Should contain only technical utilities
2. **Layer agnostic** - Can be imported by any layer
3. **Pure functions** - Utilities should be stateless and predictable
4. **Well tested** - High test coverage for utility functions

## Examples

```typescript
// Configuration
export interface AppConfig {
  discordToken: string
  googleApiKey?: string
  logLevel: LogLevel
}

// Utility function
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

// Constants
export const MAX_PROMPT_LENGTH = 1000
export const DEFAULT_COOLDOWN_SECONDS = 30

// Common types
export type ValidationResult = {
  isValid: boolean
  errors: string[]
}
```

This layer should contain only stable, reusable components that don't change frequently.
