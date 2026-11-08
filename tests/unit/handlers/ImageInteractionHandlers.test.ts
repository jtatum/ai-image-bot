import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('@/infrastructure/monitoring/Logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

jest.mock('@/infrastructure/google/GeminiAdapter.js', () => ({
  GeminiAdapter: jest.fn().mockImplementation(() => ({
    isAvailable: () => true,
    generateImage: jest.fn(),
    editImage: jest.fn(),
    getInfo: () => ({ name: 'mock' }),
  })),
}))

import { ImageInteractionHandlers } from '@/infrastructure/discord/handlers/ImageInteractionHandlers.js'

async function prefilledPrompt(messageContent: string): Promise<string | undefined> {
  const showModal = jest.fn()
  const interaction = {
    user: { id: '123456789012345678' },
    guild: null,
    message: { content: messageContent },
    showModal,
    reply: jest.fn(),
  }

  await new ImageInteractionHandlers().handleRegenerateButton(interaction as never)

  expect(showModal).toHaveBeenCalledTimes(1)
  const modal = (showModal.mock.calls[0][0] as { toJSON: () => any }).toJSON()
  return modal.components[0].components[0].value
}

describe('ImageInteractionHandlers.handleRegenerateButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('pre-fills a single-line prompt', async () => {
    await expect(
      prefilledPrompt('🎨 **tester** generated an image (3.2s)\n> a red fox in the snow')
    ).resolves.toBe('a red fox in the snow')
  })

  it('pre-fills every line of a multi-line prompt', async () => {
    const prompt = 'a lighthouse at dusk\nwatercolor style\n\nno people'
    await expect(
      prefilledPrompt(`🎨 **tester** regenerated an image (4.0s)\n> ${prompt}`)
    ).resolves.toBe(prompt)
  })

  it('pre-fills every line of a multi-line prompt from an error message', async () => {
    const prompt = 'make the sky purple\nand add two moons'
    await expect(
      prefilledPrompt(`<@123456789012345678> ❌ Generation stopped: SAFETY\n**Edit Request:** ${prompt}`)
    ).resolves.toBe(prompt)
  })
})
