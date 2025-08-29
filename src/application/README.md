# Application Layer

This directory contains application services and use cases that orchestrate business operations.

## Purpose

The application layer acts as a coordinator between the domain and infrastructure layers:

- **Use cases** - Implement specific application workflows
- **Application services** - Coordinate complex business operations
- **Data transformation** - Convert between domain models and external formats
- **Transaction boundaries** - Define operation boundaries

## Structure

- `services/` - Application services that coordinate multiple domain operations
- `use-cases/` - Specific business workflows (e.g., GenerateImageUseCase)

## Rules

1. **Orchestration, not business logic** - Delegate business rules to domain layer
2. **Dependency inversion** - Depend on domain interfaces, not implementations
3. **Single responsibility** - Each use case should handle one specific workflow
4. **Framework agnostic** - Should not depend on UI frameworks or external libraries

## Examples

```typescript
// Use Case
export class GenerateImageUseCase {
  constructor(
    private imageGenerator: IImageGenerator,
    private logger: ILogger
  ) {}

  async execute(request: ImageRequest): Promise<ImageResult> {
    // Validate request using domain logic
    const validation = request.validate()
    if (!validation.isValid) {
      throw new ValidationError(validation.errors)
    }

    // Orchestrate the operation
    this.logger.info('Generating image', { userId: request.userId })
    return await this.imageGenerator.generateImage(request)
  }
}

// Application Service
export class ImageGenerationService {
  // Coordinates multiple use cases
}
```

This layer contains the "application-specific" business rules and workflows.
