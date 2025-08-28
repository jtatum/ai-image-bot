import { AttachmentBuilder } from 'discord.js'
import { createImageFilename } from '@/utils/filename.js'
import { createImageActionButtons } from '@/utils/buttons.js'
import { GenerateImageResult } from '@/services/gemini.js'

/**
 * Creates a Discord attachment from image generation result
 */
export function createImageAttachment(
  result: GenerateImageResult,
  username: string,
  prompt: string,
  prefix: string = ''
): AttachmentBuilder {
  if (!result.success || !result.buffer) {
    throw new Error('Cannot create attachment from failed result')
  }

  const finalPrompt = prefix ? `${prefix}_${prompt}` : prompt
  const filename = createImageFilename(username, finalPrompt)

  return new AttachmentBuilder(result.buffer, {
    name: filename,
    description: `${prefix ? 'Edited' : 'Generated'} image: ${prompt.substring(0, 100)}`,
  })
}

/**
 * Builds a complete success response for image operations
 */
export interface ImageSuccessResponse {
  content: string
  files: AttachmentBuilder[]
  components: any[]
}

export function buildImageSuccessResponse(
  result: GenerateImageResult,
  username: string,
  prompt: string,
  userId: string,
  type: 'generated' | 'edited' | 'regenerated',
  contextLabel: string = 'Prompt'
): ImageSuccessResponse {
  const attachment = createImageAttachment(
    result,
    username,
    prompt,
    type === 'edited' ? 'edited' : ''
  )
  const buttons = createImageActionButtons(userId)

  const typeEmojis = {
    generated: '🎨',
    edited: '✏️',
    regenerated: '🎨',
  }

  const typeLabels = {
    generated: 'generated',
    edited: 'edited',
    regenerated: 'regenerated',
  }

  return {
    content: `${typeEmojis[type]} **Image ${typeLabels[type]} successfully!**\n**${contextLabel}:** ${prompt}`,
    files: [attachment],
    components: [buttons],
  }
}
