import { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { geminiService } from '@/services/gemini.js'

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction

/**
 * Safely replies to an interaction, handling deferred/replied state
 */
export async function safeReply(interaction: AnyInteraction, options: any): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    if ('editReply' in interaction) {
      // For editReply, remove ephemeral and other flags not allowed
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ephemeral, fetchReply, tts, withResponse, ...editOptions } = options
      await interaction.editReply(editOptions)
    } else if ('followUp' in interaction) {
      await (interaction as any).followUp(options)
    }
  } else {
    await interaction.reply(options)
  }
}

/**
 * Checks if Gemini service is available and replies with error if not
 * Returns true if available, false if error reply was sent
 */
export async function checkGeminiAvailability(
  interaction: AnyInteraction,
  feature: string = 'service'
): Promise<boolean> {
  if (!geminiService.isAvailable()) {
    await safeReply(interaction, {
      content: `❌ ${feature} is currently unavailable. Please try again later.`,
      ephemeral: true,
    })
    return false
  }
  return true
}

/**
 * Handles Gemini result errors (when result.success is false)
 */
export async function handleGeminiResultError(
  interaction: AnyInteraction,
  errorMessage: string,
  context: string,
  userPrompt: string
): Promise<void> {
  const content = `❌ ${errorMessage}\n**${context}:** ${userPrompt}`

  await safeReply(interaction, {
    content,
    ephemeral: false,
  })
}

/**
 * Handles Gemini service errors with standardized error messages
 */
export async function handleGeminiError(
  interaction: AnyInteraction,
  error: unknown,
  context: string,
  userPrompt?: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
  const content = userPrompt
    ? `❌ ${errorMessage}\n**${context}:** ${userPrompt}`
    : `❌ ${errorMessage}`

  await safeReply(interaction, {
    content,
    ephemeral: false,
  })
}
