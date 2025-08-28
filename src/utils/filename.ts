/**
 * Sanitizes a string to be safe for use as a filename
 * @param input The input string to sanitize
 * @param maxLength Maximum length of the output (default: 50)
 * @returns A sanitized filename string
 */
export function sanitizeFilename(input: string, maxLength: number = 50): string {
  // Remove invalid filename characters and control characters
  let sanitized = input.replace(/[<>:"/\\|?*]/g, '')

  // Remove control characters (char codes 0-31)
  sanitized = sanitized.replace(/[\x00-\x1f]/g, '') // eslint-disable-line no-control-regex

  return sanitized
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .toLowerCase()
    .substring(0, maxLength)
    .replace(/-$/, '') // Remove trailing hyphen if substring cut it off
}

/**
 * Creates a filename from username and prompt
 * @param username The Discord username
 * @param prompt The image generation prompt
 * @returns A sanitized filename
 */
export function createImageFilename(username: string, prompt: string): string {
  const sanitizedUsername = sanitizeFilename(username, 20)
  const sanitizedPrompt = sanitizeFilename(prompt, 30)

  if (!sanitizedPrompt) {
    return `${sanitizedUsername}-gemini-image.png`
  }

  return `${sanitizedUsername}-${sanitizedPrompt}.png`
}
