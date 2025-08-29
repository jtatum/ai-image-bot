# Domain Layer

This directory contains the core business logic of the application, following Domain-Driven Design principles.

## Purpose

The domain layer represents the heart of the business logic, containing:

- **Pure business entities** with no external dependencies
- **Domain interfaces** that define contracts for external services
- **Business rules and validation** logic
- **Domain events** for business processes

## Structure

- `entities/` - Core business objects (e.g., ImageRequest)
- `interfaces/` - Contracts for external services (e.g., IImageGenerator)

## Rules

1. **No external dependencies** - Domain code should not import from infrastructure or presentation layers
2. **Pure functions** - Business logic should be testable in isolation
3. **Rich domain models** - Entities should contain behavior, not just data
4. **Interface segregation** - Keep interfaces focused and specific

## Examples

```typescript
// Domain Entity
export class ImageRequest {
  constructor(
    public prompt: string,
    public userId: string
  ) {}

  validate(): ValidationResult {
    // Business validation logic
  }
}

// Domain Interface
export interface IImageGenerator {
  generateImage(request: ImageRequest): Promise<IImageResult>
}
```

This layer should remain stable and be the least likely to change when external requirements change.
