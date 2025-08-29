# Infrastructure Layer

This directory contains implementations for external system integrations and technical concerns.

## Purpose

The infrastructure layer provides concrete implementations for domain interfaces:

- **External API integrations** - Discord, Google Gemini, databases
- **Framework-specific code** - Discord.js implementations
- **Technical services** - Logging, monitoring, caching
- **Adapters** - Convert between external formats and domain models

## Structure

- `discord/` - Discord.js specific implementations
  - `client/` - Extended Discord client
  - `handlers/` - Interaction handlers
  - `builders/` - Discord UI component builders
- `google/` - Google API integrations
- `monitoring/` - Logging and health check services

## Rules

1. **Implement domain interfaces** - Provide concrete implementations for domain contracts
2. **Framework isolation** - Keep framework-specific code contained
3. **Error handling** - Convert external errors to domain errors
4. **Configuration driven** - Use environment variables for external service configuration

## Examples

```typescript
// Infrastructure adapter implementing domain interface
export class GeminiAdapter implements IImageGenerator {
  constructor(private apiKey: string) {}

  async generateImage(request: ImageRequest): Promise<IImageResult> {
    try {
      // Google Gemini API specific implementation
      const response = await this.geminiClient.generateImage(request.prompt)
      return this.mapToImageResult(response)
    } catch (error) {
      // Convert external errors to domain errors
      throw new ImageGenerationError(error.message)
    }
  }

  private mapToImageResult(response: GeminiResponse): IImageResult {
    // Convert external format to domain format
  }
}

// Discord-specific handler
export class CommandHandler {
  async handleCommand(interaction: ChatInputCommandInteraction) {
    // Discord.js specific logic
  }
}
```

This layer is the most likely to change when external dependencies change or are replaced.
