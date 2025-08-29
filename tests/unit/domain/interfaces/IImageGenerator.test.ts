import { describe, it, expect } from '@jest/globals'
import { Buffer } from 'node:buffer'
import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'

/**
 * Contract tests for IImageGenerator implementations
 * These tests ensure any implementation of IImageGenerator follows the expected behavior
 */
export function testImageGeneratorContract(
  createGenerator: () => IImageGenerator,
  isAvailable: boolean = true
) {
  describe('IImageGenerator Contract', () => {
    let generator: IImageGenerator

    beforeEach(() => {
      generator = createGenerator()
    })

    describe('isAvailable', () => {
      it('should return a boolean', () => {
        const available = generator.isAvailable()
        expect(typeof available).toBe('boolean')
      })
      
      if (isAvailable) {
        it('should return true when properly configured', () => {
          expect(generator.isAvailable()).toBe(true)
        })
      } else {
        it('should return false when not configured', () => {
          expect(generator.isAvailable()).toBe(false)
        })
      }
    })

    describe('generateImage', () => {
      it('should accept a string prompt and return a Promise<IImageResult>', async () => {
        if (!generator.isAvailable()) {
          await expect(generator.generateImage('test prompt')).rejects.toThrow()
          return
        }

        const result = await generator.generateImage('test prompt')
        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')
        
        if (result.success) {
          expect(result.buffer).toBeInstanceOf(Buffer)
          expect(result.error).toBeUndefined()
        } else {
          expect(result.buffer).toBeUndefined()
          expect(typeof result.error).toBe('string')
        }
      })

      it('should handle empty prompts gracefully', async () => {
        if (!generator.isAvailable()) {
          await expect(generator.generateImage('')).rejects.toThrow()
          return
        }

        const result = await generator.generateImage('')
        expect(result).toHaveProperty('success')
        
        // Empty prompts should either fail or be handled gracefully
        if (!result.success) {
          expect(result.error).toBeDefined()
        }
      })

      it('should include metadata when available', async () => {
        if (!generator.isAvailable()) {
          return
        }

        const result = await generator.generateImage('test prompt')
        
        if (result.metadata) {
          if (result.metadata.generatedAt) {
            expect(result.metadata.generatedAt).toBeInstanceOf(Date)
          }
          if (result.metadata.processingTime) {
            expect(typeof result.metadata.processingTime).toBe('number')
            expect(result.metadata.processingTime).toBeGreaterThan(0)
          }
        }
      })
    })

    describe('editImage', () => {
      const sampleImageBuffer = Buffer.from('fake image data')

      it('should accept prompt, buffer, and optional mimeType', async () => {
        if (!generator.isAvailable()) {
          await expect(
            generator.editImage('edit prompt', sampleImageBuffer)
          ).rejects.toThrow()
          return
        }

        const result = await generator.editImage('edit prompt', sampleImageBuffer)
        expect(result).toHaveProperty('success')
        expect(typeof result.success).toBe('boolean')
      })

      it('should handle mime type parameter', async () => {
        if (!generator.isAvailable()) {
          return
        }

        const result = await generator.editImage(
          'edit prompt', 
          sampleImageBuffer, 
          'image/jpeg'
        )
        expect(result).toHaveProperty('success')
      })

      it('should validate image buffer parameter', async () => {
        if (!generator.isAvailable()) {
          return
        }

        // Should handle empty or invalid buffers gracefully
        const emptyBuffer = Buffer.alloc(0)
        const result = await generator.editImage('edit prompt', emptyBuffer)
        
        if (!result.success) {
          expect(result.error).toBeDefined()
        }
      })
    })

    describe('getInfo', () => {
      it('should return generator information', () => {
        const info = generator.getInfo()
        
        expect(info).toHaveProperty('name')
        expect(typeof info.name).toBe('string')
        expect(info.name.length).toBeGreaterThan(0)
        
        if (info.version) {
          expect(typeof info.version).toBe('string')
        }
        
        if (info.supportedFormats) {
          expect(Array.isArray(info.supportedFormats)).toBe(true)
        }
        
        if (info.maxPromptLength) {
          expect(typeof info.maxPromptLength).toBe('number')
          expect(info.maxPromptLength).toBeGreaterThan(0)
        }
      })
    })
  })
}

// Mock implementation for standalone testing
class MockImageGenerator implements IImageGenerator {
  constructor(private available: boolean = true) {}

  isAvailable(): boolean {
    return this.available
  }

  async generateImage(prompt: string): Promise<IImageResult> {
    if (!this.available) {
      throw new Error('Generator not available')
    }
    
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: 'Prompt cannot be empty'
      }
    }
    
    return {
      success: true,
      buffer: Buffer.from('mock image data'),
      metadata: {
        model: 'mock-generator',
        generatedAt: new Date(),
        processingTime: 100
      }
    }
  }

  async editImage(prompt: string, imageBuffer: Buffer, mimeType = 'image/png'): Promise<IImageResult> {
    if (!this.available) {
      throw new Error('Generator not available')
    }
    
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: 'Prompt cannot be empty'
      }
    }
    
    if (imageBuffer.length === 0) {
      return {
        success: false,
        error: 'Image buffer cannot be empty'
      }
    }
    
    return {
      success: true,
      buffer: Buffer.from(`mock edited image data (${mimeType})`),
      metadata: {
        model: 'mock-generator',
        generatedAt: new Date(),
        processingTime: 150
      }
    }
  }

  getInfo() {
    return {
      name: 'MockImageGenerator',
      version: '1.0.0',
      supportedFormats: ['png', 'jpeg'],
      maxPromptLength: 1000
    }
  }
}

// Run contract tests with mock implementation
describe('IImageGenerator Interface Tests', () => {
  testImageGeneratorContract(() => new MockImageGenerator(true), true)
  testImageGeneratorContract(() => new MockImageGenerator(false), false)
})