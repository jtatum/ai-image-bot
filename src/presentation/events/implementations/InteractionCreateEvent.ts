import { Events, Interaction } from 'discord.js'
import { BaseEvent } from '@/presentation/events/base/BaseEvent.js'
import { InteractionRouter } from '@/infrastructure/discord/handlers/InteractionRouter.js'
import { ButtonHandler } from '@/infrastructure/discord/handlers/ButtonHandler.js'
import { ModalHandler } from '@/infrastructure/discord/handlers/ModalHandler.js'
import { CommandHandler } from '@/infrastructure/discord/handlers/CommandHandler.js'
import { CooldownHandler } from '@/infrastructure/discord/handlers/CooldownHandler.js'
import { ExtendedClient } from '@/bot/types.js'
import { ImageInteractionHandlers } from '@/infrastructure/discord/handlers/ImageInteractionHandlers.js'
import { handleRegenerateButton, handleRegenerateModal } from '@/utils/regenerateImage.js'
import { handleEditButton, handleEditModal } from '@/utils/editImage.js'

/**
 * Handles Discord interaction create events using the new handler architecture
 * Replaces the monolithic interactionCreate.ts with a clean, modular approach
 */
export class InteractionCreateEvent extends BaseEvent {
  public readonly name = Events.InteractionCreate
  public readonly once = false

  private router: InteractionRouter | null = null

  constructor() {
    super()
    // Initialization will happen in initialize() method
  }

  /**
   * Initialize the event with handlers
   * Called after the client is available to set up dependencies
   */
  public initialize(client: ExtendedClient): void {
    // Create cooldown handler
    const cooldownHandler = new CooldownHandler(client.cooldowns)

    // Create command handler
    const commandHandler = new CommandHandler(client, cooldownHandler)

    // Create new image interaction handlers using clean architecture
    const imageHandlers = new ImageInteractionHandlers()

    // Create button handler and register both old and new handlers (parallel implementation)
    const buttonHandler = new ButtonHandler()
    buttonHandler.registerHandlers([
      // Old handlers (still working)
      {
        prefix: 'regenerate_',
        handler: handleRegenerateButton,
        description: 'Handle image regeneration button clicks (legacy)',
      },
      {
        prefix: 'edit_',
        handler: handleEditButton,
        description: 'Handle image edit button clicks (legacy)',
      },
      // New handlers using clean architecture
      {
        prefix: 'new_regenerate_',
        handler: imageHandlers.handleRegenerateButton.bind(imageHandlers),
        description: 'Handle image regeneration button clicks (new architecture)',
      },
      {
        prefix: 'new_edit_',
        handler: imageHandlers.handleEditButton.bind(imageHandlers),
        description: 'Handle image edit button clicks (new architecture)',
      },
    ])

    // Create modal handler and register both old and new handlers (parallel implementation)
    const modalHandler = new ModalHandler()
    modalHandler.registerHandlers([
      // Old handlers (still working)
      {
        prefix: 'regenerate_modal_',
        handler: handleRegenerateModal,
        description: 'Handle image regeneration modal submissions (legacy)',
      },
      {
        prefix: 'edit_modal_',
        handler: handleEditModal,
        description: 'Handle image edit modal submissions (legacy)',
      },
      // New handlers using clean architecture
      {
        prefix: 'new_regenerate_modal_',
        handler: imageHandlers.handleRegenerateModal.bind(imageHandlers),
        description: 'Handle image regeneration modal submissions (new architecture)',
      },
      {
        prefix: 'new_edit_modal_',
        handler: imageHandlers.handleEditModal.bind(imageHandlers),
        description: 'Handle image edit modal submissions (new architecture)',
      },
    ])

    // Create router with all handlers
    this.router = new InteractionRouter({
      buttonHandler,
      modalHandler,
      commandHandler,
    })

    this.logger.info('InteractionCreateEvent initialized with parallel handler architecture', {
      imageHandlersAvailable: {
        generation: imageHandlers.isGenerationAvailable(),
        editing: imageHandlers.isEditingAvailable(),
      },
      handlerCounts: {
        buttons: buttonHandler.getStats().totalHandlers,
        modals: modalHandler.getStats().totalHandlers,
      },
    })
  }

  /**
   * Handle interaction create events
   * Routes to appropriate handler via InteractionRouter
   */
  protected async handleEvent(interaction: Interaction): Promise<void> {
    if (!this.router) {
      throw new Error('InteractionCreateEvent not properly initialized - router is missing')
    }

    // Route the interaction to the appropriate handler
    await this.router.routeInteraction(interaction)
  }

  /**
   * Validate that the event is properly configured
   */
  protected async validateEvent(interaction: Interaction): Promise<void> {
    await super.validateEvent(interaction)

    if (!this.router) {
      throw new Error('InteractionCreateEvent not initialized - call initialize() first')
    }

    // Check if the interaction can be handled
    if (!this.canHandleInteraction(interaction)) {
      this.logger.debug('Interaction cannot be handled by current handlers', {
        type: interaction.type,
        customId: this.getCustomId(interaction),
        commandName: this.getCommandName(interaction),
      })
    }
  }

  /**
   * Check if the interaction can be handled by the current setup
   */
  private canHandleInteraction(interaction: Interaction): boolean {
    if (!this.router) {
      return false
    }
    return this.router.canHandle(interaction)
  }

  /**
   * Extract custom ID from interaction if available
   */
  private getCustomId(interaction: Interaction): string | undefined {
    if ('customId' in interaction) {
      return (interaction as { customId: string }).customId
    }
    return undefined
  }

  /**
   * Extract command name from interaction if available
   */
  private getCommandName(interaction: Interaction): string | undefined {
    if (interaction.isChatInputCommand()) {
      return interaction.commandName
    }
    return undefined
  }

  /**
   * Create execution context for logging
   * Overrides BaseEvent method to provide interaction-specific context
   */
  protected createExecutionContext(args: unknown[]): Record<string, unknown> {
    const baseContext = super.createExecutionContext(args)

    if (args.length > 0 && args[0]) {
      const interaction = args[0] as Interaction

      return {
        ...baseContext,
        interaction: {
          type: interaction.type,
          id: interaction.id,
          user: interaction.user
            ? {
                id: interaction.user.id,
                tag: interaction.user.tag,
              }
            : null,
          guild: interaction.guild
            ? {
                id: interaction.guild.id,
                name: interaction.guild.name,
              }
            : null,
          customId: this.getCustomId(interaction),
          commandName: this.getCommandName(interaction),
        },
      }
    }

    return baseContext
  }

  /**
   * Handle interaction processing errors
   * Overrides BaseEvent method for interaction-specific error handling
   */
  protected async handleError(error: unknown, ...args: unknown[]): Promise<void> {
    await super.handleError(error, ...args)

    // Additional interaction-specific error logging
    if (args.length > 0 && args[0]) {
      const interaction = args[0] as Interaction

      this.logger.error('Interaction processing failed', {
        interactionId: interaction.id,
        interactionType: interaction.type,
        userId: interaction.user?.id,
        guildId: interaction.guild?.id,
        customId: this.getCustomId(interaction),
        commandName: this.getCommandName(interaction),
        errorDetails:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })
    }
  }

  /**
   * Get router statistics for monitoring
   */
  public getRouterStats(): ReturnType<InteractionRouter['getStats']> {
    if (!this.router) {
      return {
        buttonHandlers: 0,
        modalHandlers: 0,
        commands: 0,
        totalHandlers: 0,
      }
    }
    return this.router.getStats()
  }

  /**
   * Get detailed handler information
   */
  public getHandlerInfo(): ReturnType<InteractionRouter['getHandlerInfo']> | null {
    if (!this.router) {
      return null
    }
    return this.router.getHandlerInfo()
  }

  /**
   * Health check for the event and its handlers
   */
  public async healthCheck(): Promise<ReturnType<InteractionRouter['healthCheck']> | null> {
    if (!this.router) {
      return null
    }
    return await this.router.healthCheck()
  }

  /**
   * Get active handlers summary
   */
  public getActiveHandlersSummary(): ReturnType<
    InteractionRouter['getActiveHandlersSummary']
  > | null {
    if (!this.router) {
      return null
    }
    return this.router.getActiveHandlersSummary()
  }
}
