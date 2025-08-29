# Presentation Layer

This directory contains the user interface components for Discord interactions.

## Purpose

The presentation layer handles user interactions and presents information:

- **Commands** - Discord slash commands that users invoke
- **Events** - Discord events that trigger bot responses
- **Input validation** - Validate user inputs before passing to application layer
- **Response formatting** - Format application results for Discord display

## Structure

- `commands/` - Discord slash commands
  - `base/` - Abstract base classes for commands
  - `implementations/` - Concrete command implementations
- `events/` - Discord event handlers
  - `base/` - Abstract base classes for events
  - `implementations/` - Concrete event handlers

## Rules

1. **Thin layer** - Minimal logic, delegate to application layer
2. **Input validation** - Validate and sanitize user inputs
3. **Error presentation** - Convert application errors to user-friendly messages
4. **Framework specific** - Discord.js specific code is acceptable here

## Examples

```typescript
// Command implementation
export class GeminiCommand extends BaseCommand {
  data = new SlashCommandBuilder().setName('gemini').setDescription('Generate an image using AI')

  cooldown = 30

  async executeCommand(interaction: ChatInputCommandInteraction) {
    // 1. Extract and validate user input
    const prompt = interaction.options.getString('prompt', true)
    const request = new ImageRequest(prompt, interaction.user.id)

    // 2. Delegate to application layer
    try {
      const result = await this.generateImageUseCase.execute(request)

      // 3. Present result to user
      await interaction.reply({
        content: 'Image generated successfully!',
        files: [new AttachmentBuilder(result.buffer)],
      })
    } catch (error) {
      // 4. Handle and present errors
      await this.handleError(interaction, error)
    }
  }
}

// Event handler
export class InteractionCreateEvent extends BaseEvent {
  name = Events.InteractionCreate

  async handleEvent(interaction: Interaction) {
    // Route to appropriate handlers
  }
}
```

This layer should focus purely on Discord-specific presentation concerns.
