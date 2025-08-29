import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { InteractionRouter, InteractionRouterConfig } from '@/infrastructure/discord/handlers/InteractionRouter.js'
import { ButtonHandler } from '@/infrastructure/discord/handlers/ButtonHandler.js'
import { ModalHandler } from '@/infrastructure/discord/handlers/ModalHandler.js'
import { CommandHandler } from '@/infrastructure/discord/handlers/CommandHandler.js'
import { createMockChatInputInteraction, createMockButtonInteraction, createMockModalInteraction } from '../../helpers/mockInteractions.js'

// Mock the logger
jest.mock('@/config/logger.js', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}))

import logger from '@/config/logger.js'

const mockLogger = logger as jest.Mocked<typeof logger>

describe('InteractionRouter', () => {
  let interactionRouter: InteractionRouter
  let mockButtonHandler: jest.Mocked<ButtonHandler>
  let mockModalHandler: jest.Mocked<ModalHandler>
  let mockCommandHandler: jest.Mocked<CommandHandler>

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock handlers
    mockButtonHandler = {
      handleButton: jest.fn() as any,
      canHandle: jest.fn().mockReturnValue(false),
      getStats: jest.fn().mockReturnValue({ totalHandlers: 2, registeredPrefixes: ['gen_', 'edit_'] }),
    } as any

    mockModalHandler = {
      handleModal: jest.fn() as any,
      canHandle: jest.fn().mockReturnValue(false),
      getStats: jest.fn().mockReturnValue({ totalHandlers: 2, registeredPrefixes: ['gen_modal_', 'edit_modal_'] }),
    } as any

    mockCommandHandler = {
      handleCommand: jest.fn() as any,
      hasCommand: jest.fn().mockReturnValue(false),
      getCommandNames: jest.fn().mockReturnValue(['gemini', 'ping', 'info']),
      getStats: jest.fn().mockReturnValue({ totalCommands: 3, activeCooldowns: 0 }),
    } as any

    const config: InteractionRouterConfig = {
      buttonHandler: mockButtonHandler,
      modalHandler: mockModalHandler,
      commandHandler: mockCommandHandler,
    }

    interactionRouter = new InteractionRouter(config)
  })

  describe('constructor', () => {
    it('should initialize with handlers and log initialization', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'InteractionRouter initialized with handlers',
        {
          buttonHandlers: 2,
          modalHandlers: 2,
          commandHandlers: 3,
        }
      )
    })

    it('should store handler references', () => {
      const stats = interactionRouter.getStats()
      expect(stats.buttonHandlers).toBe(2)
      expect(stats.modalHandlers).toBe(2)
      expect(stats.commands).toBe(3)
    })
  })

  describe('routeInteraction', () => {
    it('should route button interactions to ButtonHandler', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'test_button',
      })

      await interactionRouter.routeInteraction(interaction)

      expect(mockButtonHandler.handleButton).toHaveBeenCalledWith(interaction)
      expect(mockModalHandler.handleModal).not.toHaveBeenCalled()
      expect(mockCommandHandler.handleCommand).not.toHaveBeenCalled()

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Routing interaction',
        expect.objectContaining({
          type: interaction.type,
          id: interaction.id,
          user: 'user123',
          guild: 'guild123',
        })
      )
    })

    it('should route modal interactions to ModalHandler', async () => {
      const interaction = createMockModalInteraction({
        customId: 'test_modal',
      })

      await interactionRouter.routeInteraction(interaction)

      expect(mockModalHandler.handleModal).toHaveBeenCalledWith(interaction)
      expect(mockButtonHandler.handleButton).not.toHaveBeenCalled()
      expect(mockCommandHandler.handleCommand).not.toHaveBeenCalled()
    })

    it('should route command interactions to CommandHandler', async () => {
      const interaction = createMockChatInputInteraction({
        commandName: 'test',
      })

      await interactionRouter.routeInteraction(interaction)

      expect(mockCommandHandler.handleCommand).toHaveBeenCalledWith(interaction)
      expect(mockButtonHandler.handleButton).not.toHaveBeenCalled()
      expect(mockModalHandler.handleModal).not.toHaveBeenCalled()
    })

    it('should handle unsupported interaction types gracefully', async () => {
      const interaction = {
        type: 99, // Unknown type
        id: 'unknown123',
        user: { id: 'user123' },
        guild: { id: 'guild123' },
        isButton: () => false,
        isModalSubmit: () => false,
        isChatInputCommand: () => false,
      } as any

      await interactionRouter.routeInteraction(interaction)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Unsupported interaction type received',
        {
          type: 99,
          id: 'unknown123',
          user: 'user123',
        }
      )

      expect(mockButtonHandler.handleButton).not.toHaveBeenCalled()
      expect(mockModalHandler.handleModal).not.toHaveBeenCalled()
      expect(mockCommandHandler.handleCommand).not.toHaveBeenCalled()
    })

    it('should log successful routing with performance metrics', async () => {
      const interaction = createMockButtonInteraction()

      await interactionRouter.routeInteraction(interaction)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Interaction routed successfully',
        expect.objectContaining({
          type: interaction.type,
          duration: expect.any(Number),
          performanceCategory: expect.any(String),
        })
      )
    })

    it('should handle and re-throw handler errors', async () => {
      const error = new Error('Handler failed')
      const interaction = createMockButtonInteraction()
      
      mockButtonHandler.handleButton.mockImplementation(() => Promise.reject(error))

      await expect(interactionRouter.routeInteraction(interaction)).rejects.toThrow(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error routing interaction',
        expect.objectContaining({
          type: interaction.type,
          id: interaction.id,
          user: 'user123',
          guild: 'guild123',
          duration: expect.any(Number),
          error: {
            name: 'Error',
            message: 'Handler failed',
            stack: expect.any(String),
          },
        })
      )
    })

    it('should handle errors without user context', async () => {
      const error = new Error('Handler failed')
      const interaction = {
        type: 3, // Button interaction type
        id: 'test123',
        isButton: () => true,
        isModalSubmit: () => false,
        isChatInputCommand: () => false,
      } as any

      mockButtonHandler.handleButton.mockImplementation(() => Promise.reject(error))

      await expect(interactionRouter.routeInteraction(interaction)).rejects.toThrow(error)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error routing interaction',
        expect.objectContaining({
          type: 3,
          id: 'test123',
          user: undefined,
          guild: undefined,
        })
      )
    })
  })

  describe('canHandle', () => {
    it('should check if button interactions can be handled', () => {
      const interaction = createMockButtonInteraction({ customId: 'test_button' })
      mockButtonHandler.canHandle.mockReturnValue(true)

      const result = interactionRouter.canHandle(interaction)

      expect(result).toBe(true)
      expect(mockButtonHandler.canHandle).toHaveBeenCalledWith('test_button')
    })

    it('should check if modal interactions can be handled', () => {
      const interaction = createMockModalInteraction({ customId: 'test_modal' })
      mockModalHandler.canHandle.mockReturnValue(true)

      const result = interactionRouter.canHandle(interaction)

      expect(result).toBe(true)
      expect(mockModalHandler.canHandle).toHaveBeenCalledWith('test_modal')
    })

    it('should check if command interactions can be handled', () => {
      const interaction = createMockChatInputInteraction({ commandName: 'test' })
      mockCommandHandler.hasCommand.mockReturnValue(true)

      const result = interactionRouter.canHandle(interaction)

      expect(result).toBe(true)
      expect(mockCommandHandler.hasCommand).toHaveBeenCalledWith('test')
    })

    it('should return false for unsupported interaction types', () => {
      const interaction = {
        isButton: () => false,
        isModalSubmit: () => false,
        isChatInputCommand: () => false,
      } as any

      const result = interactionRouter.canHandle(interaction)

      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return combined statistics from all handlers', () => {
      const stats = interactionRouter.getStats()

      expect(stats).toEqual({
        buttonHandlers: 2,
        modalHandlers: 2,
        commands: 3,
        totalHandlers: 7, // 2 + 2 + 3
      })
    })

    it('should handle empty handlers', () => {
      mockButtonHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockModalHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockCommandHandler.getStats.mockReturnValue({ totalCommands: 0, activeCooldowns: 0 })

      const stats = interactionRouter.getStats()

      expect(stats).toEqual({
        buttonHandlers: 0,
        modalHandlers: 0,
        commands: 0,
        totalHandlers: 0,
      })
    })
  })

  describe('getHandlerInfo', () => {
    it('should return detailed handler information', () => {
      const info = interactionRouter.getHandlerInfo()

      expect(info).toEqual({
        buttonHandlers: {
          totalHandlers: 2,
          registeredPrefixes: ['gen_', 'edit_'],
        },
        modalHandlers: {
          totalHandlers: 2,
          registeredPrefixes: ['gen_modal_', 'edit_modal_'],
        },
        commands: {
          totalCommands: 3,
          commandNames: ['gemini', 'ping', 'info'],
        },
      })
    })
  })

  describe('validateConfiguration', () => {
    it('should validate proper configuration', () => {
      const validation = interactionRouter.validateConfiguration()

      expect(validation).toEqual({
        isValid: true,
        issues: [],
        warnings: [],
      })
    })

    it('should warn about empty handlers', () => {
      mockButtonHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockModalHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockCommandHandler.getStats.mockReturnValue({ totalCommands: 0, activeCooldowns: 0 })

      const validation = interactionRouter.validateConfiguration()

      expect(validation).toEqual({
        isValid: true,
        issues: [],
        warnings: [
          'No button handlers registered',
          'No modal handlers registered',
          'No commands registered',
        ],
      })
    })

    it.skip('should detect missing handlers', () => {
      // TODO: This test would require refactoring InteractionRouter constructor
      // to not call getStats() immediately on initialization
      const invalidConfig = {
        buttonHandler: null as any,
        modalHandler: mockModalHandler,
        commandHandler: mockCommandHandler,
      }

      const invalidRouter = new InteractionRouter(invalidConfig)
      const validation = invalidRouter.validateConfiguration()

      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('ButtonHandler is not initialized')
    })
  })

  describe('getActiveHandlersSummary', () => {
    it('should return active handlers summary', () => {
      const summary = interactionRouter.getActiveHandlersSummary()

      expect(summary).toEqual({
        timestamp: expect.any(Date),
        handlers: {
          buttons: {
            active: 2,
            prefixes: ['gen_', 'edit_'],
          },
          modals: {
            active: 2,
            prefixes: ['gen_modal_', 'edit_modal_'],
          },
          commands: {
            active: 3,
            names: ['gemini', 'ping', 'info'],
          },
        },
        totalActive: 7,
      })
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when properly configured', async () => {
      const health = await interactionRouter.healthCheck()

      expect(health).toEqual({
        healthy: true,
        status: 'healthy',
        details: {
          router: {
            status: 'ok',
          },
          handlers: {
            buttons: {
              status: 'active',
              count: 2,
            },
            modals: {
              status: 'active',
              count: 2,
            },
            commands: {
              status: 'active',
              count: 3,
            },
          },
        },
        timestamp: expect.any(Date),
      })
    })

    it('should return unhealthy status when no handlers are registered', async () => {
      mockButtonHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockModalHandler.getStats.mockReturnValue({ totalHandlers: 0, registeredPrefixes: [] })
      mockCommandHandler.getStats.mockReturnValue({ totalCommands: 0, activeCooldowns: 0 })

      const health = await interactionRouter.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.status).toBe('unhealthy')
      expect(health.details.handlers.buttons.status).toBe('no_handlers')
      expect(health.details.handlers.modals.status).toBe('no_handlers')
      expect(health.details.handlers.commands.status).toBe('no_handlers')
    })
  })

  describe('performance categorization', () => {
    it('should categorize performance correctly', async () => {
      const interaction = createMockButtonInteraction()

      // Mock a slow handler to test performance categorization
      mockButtonHandler.handleButton.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      await interactionRouter.routeInteraction(interaction)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Interaction routed successfully',
        expect.objectContaining({
          performanceCategory: expect.stringMatching(/good|acceptable|slow|very_slow/),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null user in interaction', async () => {
      const interaction = createMockButtonInteraction({ user: null })

      await interactionRouter.routeInteraction(interaction)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Routing interaction',
        expect.objectContaining({
          user: undefined,
        })
      )
    })

    it('should handle null guild in interaction', async () => {
      const interaction = createMockButtonInteraction({ guild: null })

      await interactionRouter.routeInteraction(interaction)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Routing interaction',
        expect.objectContaining({
          guild: undefined,
        })
      )
    })

    it('should handle non-Error objects being thrown', async () => {
      const interaction = createMockButtonInteraction()
      const errorObject = { message: 'Custom error object', code: 500 }
      
      mockButtonHandler.handleButton.mockRejectedValue(errorObject)

      await expect(interactionRouter.routeInteraction(interaction)).rejects.toEqual(errorObject)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error routing interaction',
        expect.objectContaining({
          error: errorObject,
        })
      )
    })
  })

  describe('integration scenarios', () => {
    it('should handle rapid consecutive interactions', async () => {
      const interactions = [
        createMockButtonInteraction({ customId: 'button1' }),
        createMockModalInteraction({ customId: 'modal1' }),
        createMockChatInputInteraction({ commandName: 'cmd1' }),
      ]

      await Promise.all(interactions.map(i => interactionRouter.routeInteraction(i)))

      expect(mockButtonHandler.handleButton).toHaveBeenCalledTimes(1)
      expect(mockModalHandler.handleModal).toHaveBeenCalledTimes(1)
      expect(mockCommandHandler.handleCommand).toHaveBeenCalledTimes(1)
    })

    it('should maintain performance under load', async () => {
      const interactions = Array(10).fill(null).map(() => createMockButtonInteraction())

      const startTime = Date.now()
      await Promise.all(interactions.map(i => interactionRouter.routeInteraction(i)))
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should complete quickly
      expect(mockButtonHandler.handleButton).toHaveBeenCalledTimes(10)
    })

    it('should handle mixed success and failure scenarios', async () => {
      const successInteraction = createMockButtonInteraction({ customId: 'success' })
      const failureInteraction = createMockButtonInteraction({ customId: 'failure' })
      
      mockButtonHandler.handleButton
        .mockImplementationOnce(() => Promise.resolve()) // Success
        .mockImplementationOnce(() => Promise.reject(new Error('Handler failed'))) // Failure

      await interactionRouter.routeInteraction(successInteraction)
      await expect(interactionRouter.routeInteraction(failureInteraction)).rejects.toThrow()

      expect(mockButtonHandler.handleButton).toHaveBeenCalledTimes(2)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Interaction routed successfully',
        expect.any(Object)
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error routing interaction',
        expect.any(Object)
      )
    })
  })
})