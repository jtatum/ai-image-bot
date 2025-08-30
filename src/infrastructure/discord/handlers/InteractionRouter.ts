import { Interaction } from 'discord.js'
import logger from '@/config/logger.js'
import { ButtonHandler } from './ButtonHandler.js'
import { ModalHandler } from './ModalHandler.js'
import { CommandHandler } from './CommandHandler.js'

/**
 * Configuration for the interaction router
 */
export interface InteractionRouterConfig {
  /** Button handler instance */
  buttonHandler: ButtonHandler
  /** Modal handler instance */
  modalHandler: ModalHandler
  /** Command handler instance */
  commandHandler: CommandHandler
}

/**
 * Router that orchestrates all interaction handlers
 * Routes Discord interactions to the appropriate specialized handler
 */
export class InteractionRouter {
  private buttonHandler: ButtonHandler
  private modalHandler: ModalHandler
  private commandHandler: CommandHandler

  constructor(config: InteractionRouterConfig) {
    this.buttonHandler = config.buttonHandler
    this.modalHandler = config.modalHandler
    this.commandHandler = config.commandHandler

    logger.info('InteractionRouter initialized with handlers', {
      buttonHandlers: this.buttonHandler.getStats().totalHandlers,
      modalHandlers: this.modalHandler.getStats().totalHandlers,
      commandHandlers: this.commandHandler.getStats().totalCommands,
    })
  }

  /**
   * Route an interaction to the appropriate handler
   * @param interaction The Discord interaction to route
   */
  async routeInteraction(interaction: Interaction): Promise<void> {
    const startTime = Date.now()

    try {
      logger.debug('Routing interaction', {
        type: interaction.type,
        id: interaction.id,
        user: interaction.user?.id,
        guild: interaction.guild?.id,
      })

      // Route based on interaction type
      if (interaction.isButton()) {
        await this.buttonHandler.handleButton(interaction)
      } else if (interaction.isModalSubmit()) {
        await this.modalHandler.handleModal(interaction)
      } else if (interaction.isChatInputCommand()) {
        await this.commandHandler.handleCommand(interaction)
      } else {
        // Log unsupported interaction types but don't error
        logger.debug('Unsupported interaction type received', {
          type: interaction.type,
          id: interaction.id,
          user: interaction.user?.id,
        })
        return
      }

      const duration = Date.now() - startTime
      logger.debug('Interaction routed successfully', {
        type: interaction.type,
        duration,
        performanceCategory: this.getPerformanceCategory(duration),
      })
    } catch (error) {
      const duration = Date.now() - startTime

      logger.error('Error routing interaction', {
        type: interaction.type,
        id: interaction.id,
        user: interaction.user?.id,
        guild: interaction.guild?.id,
        duration,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })

      // Re-throw the error so the top-level handler can process it
      throw error
    }
  }

  /**
   * Get statistics about all handlers
   * @returns Combined statistics from all handlers
   */
  getStats(): {
    buttonHandlers: number
    modalHandlers: number
    commands: number
    totalHandlers: number
  } {
    const buttonStats = this.buttonHandler?.getStats() ?? { totalHandlers: 0 }
    const modalStats = this.modalHandler?.getStats() ?? { totalHandlers: 0 }
    const commandStats = this.commandHandler?.getStats() ?? { totalCommands: 0 }

    return {
      buttonHandlers: buttonStats.totalHandlers,
      modalHandlers: modalStats.totalHandlers,
      commands: commandStats.totalCommands,
      totalHandlers:
        buttonStats.totalHandlers + modalStats.totalHandlers + commandStats.totalCommands,
    }
  }

  /**
   * Check if a specific interaction type can be handled
   * @param interaction The interaction to check
   * @returns True if the interaction can be handled
   */
  canHandle(interaction: Interaction): boolean {
    if (interaction.isButton()) {
      return this.buttonHandler.canHandle(interaction.customId)
    } else if (interaction.isModalSubmit()) {
      return this.modalHandler.canHandle(interaction.customId)
    } else if (interaction.isChatInputCommand()) {
      return this.commandHandler.hasCommand(interaction.commandName)
    }
    return false
  }

  /**
   * Get detailed handler information for debugging
   * @returns Detailed information about all handlers
   */
  getHandlerInfo(): {
    buttonHandlers: {
      totalHandlers: number
      registeredPrefixes: string[]
    }
    modalHandlers: {
      totalHandlers: number
      registeredPrefixes: string[]
    }
    commands: {
      totalCommands: number
      commandNames: string[]
    }
  } {
    return {
      buttonHandlers: this.buttonHandler.getStats(),
      modalHandlers: this.modalHandler.getStats(),
      commands: {
        totalCommands: this.commandHandler.getStats().totalCommands,
        commandNames: this.commandHandler.getCommandNames(),
      },
    }
  }

  /**
   * Validate router configuration
   * @returns Validation result with any issues found
   */
  validateConfiguration(): {
    isValid: boolean
    issues: string[]
    warnings: string[]
  } {
    const issues: string[] = []
    const warnings: string[] = []

    // Check if handlers are properly initialized
    if (!this.buttonHandler) {
      issues.push('ButtonHandler is not initialized')
    }
    if (!this.modalHandler) {
      issues.push('ModalHandler is not initialized')
    }
    if (!this.commandHandler) {
      issues.push('CommandHandler is not initialized')
    }

    // Check for empty handlers (warnings, not errors)
    const stats = this.getStats()
    if (stats.buttonHandlers === 0) {
      warnings.push('No button handlers registered')
    }
    if (stats.modalHandlers === 0) {
      warnings.push('No modal handlers registered')
    }
    if (stats.commands === 0) {
      warnings.push('No commands registered')
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    }
  }

  /**
   * Categorize interaction processing performance
   * @param duration Duration in milliseconds
   * @returns Performance category string
   */
  private getPerformanceCategory(duration: number): string {
    if (duration < 50) return 'excellent'
    if (duration < 100) return 'good'
    if (duration < 250) return 'acceptable'
    if (duration < 500) return 'slow'
    return 'very_slow'
  }

  /**
   * Get active handlers summary for monitoring
   * @returns Summary of active handlers and their status
   */
  getActiveHandlersSummary(): {
    timestamp: Date
    handlers: {
      buttons: { active: number; prefixes: string[] }
      modals: { active: number; prefixes: string[] }
      commands: { active: number; names: string[] }
    }
    totalActive: number
  } {
    const buttonStats = this.buttonHandler.getStats()
    const modalStats = this.modalHandler.getStats()
    const commandStats = this.commandHandler.getStats()

    return {
      timestamp: new Date(),
      handlers: {
        buttons: {
          active: buttonStats.totalHandlers,
          prefixes: buttonStats.registeredPrefixes,
        },
        modals: {
          active: modalStats.totalHandlers,
          prefixes: modalStats.registeredPrefixes,
        },
        commands: {
          active: commandStats.totalCommands,
          names: this.commandHandler.getCommandNames(),
        },
      },
      totalActive:
        buttonStats.totalHandlers + modalStats.totalHandlers + commandStats.totalCommands,
    }
  }

  /**
   * Health check for the router and all handlers
   * @returns Health status of the router
   */
  async healthCheck(): Promise<{
    healthy: boolean
    status: string
    details: {
      router: { status: string }
      handlers: {
        buttons: { status: string; count: number }
        modals: { status: string; count: number }
        commands: { status: string; count: number }
      }
    }
    timestamp: Date
  }> {
    const stats = this.getStats()
    const validation = this.validateConfiguration()

    const healthy = validation.isValid && stats.totalHandlers > 0

    return {
      healthy,
      status: healthy ? 'healthy' : 'unhealthy',
      details: {
        router: {
          status: validation.isValid ? 'ok' : `issues: ${validation.issues.join(', ')}`,
        },
        handlers: {
          buttons: {
            status: stats.buttonHandlers > 0 ? 'active' : 'no_handlers',
            count: stats.buttonHandlers,
          },
          modals: {
            status: stats.modalHandlers > 0 ? 'active' : 'no_handlers',
            count: stats.modalHandlers,
          },
          commands: {
            status: stats.commands > 0 ? 'active' : 'no_handlers',
            count: stats.commands,
          },
        },
      },
      timestamp: new Date(),
    }
  }
}
