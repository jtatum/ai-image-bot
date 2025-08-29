import { 
  RegenerateImageUseCase, 
  RegenerateImageInput, 
  RegenerateImageConfig,
  DEFAULT_REGENERATE_CONFIG 
} from '@/application/use-cases/RegenerateImageUseCase.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { Buffer } from 'node:buffer'

// Mock image generator implementation
class MockImageGenerator implements IImageGenerator {
  private _isAvailable = true
  private _shouldFail = false
  private _shouldThrow = false
  private _result: IImageResult | null = null
  private _callCount = 0
  private _failUntilAttempt = 0

  isAvailable(): boolean {
    return this._isAvailable
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available
  }

  setShouldFail(shouldFail: boolean): void {
    this._shouldFail = shouldFail
  }

  setShouldThrow(shouldThrow: boolean): void {
    this._shouldThrow = shouldThrow
  }

  setResult(result: IImageResult): void {
    this._result = result
  }

  setFailUntilAttempt(attemptNumber: number): void {
    this._failUntilAttempt = attemptNumber
  }

  getCallCount(): number {
    return this._callCount
  }

  resetCallCount(): void {
    this._callCount = 0
  }

  reset(): void {
    this._callCount = 0
    this._isAvailable = true
    this._shouldFail = false
    this._shouldThrow = false
    this._result = null
    this._failUntilAttempt = 0
  }

  async generateImage(_prompt: string): Promise<IImageResult> {
    this._callCount++

    if (this._shouldThrow) {
      throw new Error('Network timeout')
    }

    if (this._result) {
      return this._result
    }

    if (this._failUntilAttempt > 0 && this._callCount <= this._failUntilAttempt) {
      return {
        success: false,
        error: 'Network timeout error occurred'
      }
    }

    if (this._shouldFail) {
      return {
        success: false,
        error: 'Network timeout during generation'
      }
    }

    return {
      success: true,
      buffer: Buffer.from('fake-regenerated-image-data'),
      metadata: {
        model: 'mock-model',
        generatedAt: new Date(),
        processingTime: 200
      }
    }
  }

  async editImage(prompt: string, _imageBuffer: Buffer, _mimeType?: string): Promise<IImageResult> {
    return this.generateImage(prompt)
  }

  getInfo() {
    return {
      name: 'Mock Regenerator',
      version: '1.0.0',
      supportedFormats: ['image/png', 'image/jpeg'],
      maxPromptLength: 1000
    }
  }
}

// Helper to create valid PNG buffer
function createValidPngBuffer(): Buffer {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const additionalData = Buffer.alloc(100)
  return Buffer.concat([pngSignature, additionalData])
}

describe('RegenerateImageUseCase', () => {
  let useCase: RegenerateImageUseCase
  let mockGenerator: MockImageGenerator

  beforeEach(() => {
    jest.useFakeTimers()
    mockGenerator = new MockImageGenerator()
    // Create fresh useCase with a copy of default config to avoid shared state
    const freshConfig = JSON.parse(JSON.stringify(DEFAULT_REGENERATE_CONFIG))
    useCase = new RegenerateImageUseCase(mockGenerator, freshConfig)
    mockGenerator.reset() // Reset all mock state, not just call count
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('execute - generate type', () => {
    it('should successfully regenerate an image on first attempt', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678',
        '987654321098765432'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.imageResult).toBeDefined()
      expect(result.imageResult!.success).toBe(true)
      expect(result.operationType).toBe('generate')
      expect(result.attemptNumber).toBe(1)
      expect(result.previousAttempts).toEqual([])
      expect(result.processedRequest.metadata?.type).toBe('generate') // Final type set by GenerateImageUseCase
      expect(result.processedRequest.metadata?.source).toBe('button')
      expect(result.regenerationMetadata?.trigger).toBe('user')
      expect(mockGenerator.getCallCount()).toBe(1)
    })

    it('should retry on retriable errors and succeed', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setFailUntilAttempt(2) // Fail first 2 attempts, succeed on 3rd

      // Act
      const resultPromise = useCase.execute(input)
      // Advance through 2 retry delays (2 * 1000ms from DEFAULT_REGENERATE_CONFIG)
      await jest.advanceTimersByTimeAsync(2000)
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(true)
      expect(result.attemptNumber).toBe(3)
      expect(result.previousAttempts).toEqual([
        'Network timeout error occurred',
        'Network timeout error occurred'
      ])
      expect(result.regenerationMetadata?.trigger).toBe('automatic') // 3rd attempt is automatic retry
      expect(mockGenerator.getCallCount()).toBe(3)
    })

    it('should fail after maximum retries exceeded', async () => {
      // Arrange
      const config: RegenerateImageConfig = {
        ...DEFAULT_REGENERATE_CONFIG,
        maxRetries: 2
      }
      useCase = new RegenerateImageUseCase(mockGenerator, config)
      
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setShouldFail(true) // Always fail

      // Act
      const resultPromise = useCase.execute(input)
      // Advance through 2 retry delays (2 * 1000ms)
      await jest.advanceTimersByTimeAsync(2000)
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(false)
      expect(result.attemptNumber).toBe(3) // maxRetries + 1
      expect(result.previousAttempts).toEqual([
        'Network timeout during generation',
        'Network timeout during generation',
        'Network timeout during generation'
      ])
      expect(result.error).toBe('Network timeout during generation')
      expect(mockGenerator.getCallCount()).toBe(3)
    })

    it('should not retry on non-retriable errors', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setResult({
        success: false,
        error: 'Content blocked by safety filters' // Non-retriable error
      })

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.attemptNumber).toBe(1)
      expect(result.previousAttempts).toEqual(['Content blocked by safety filters'])
      expect(result.error).toBe('Content blocked by safety filters')
      expect(mockGenerator.getCallCount()).toBe(1) // No retries
    })

    it('should handle thrown errors with retries', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      
      // Make generator stop throwing after 2 attempts
      mockGenerator.setShouldThrow(true)
      
      // Make it stop throwing after 2 attempts
      const originalGenerateImage = mockGenerator.generateImage.bind(mockGenerator)
      mockGenerator.generateImage = async (prompt: string) => {
        if (mockGenerator.getCallCount() >= 2) {
          mockGenerator.setShouldThrow(false)
        }
        return originalGenerateImage(prompt)
      }

      // Act  
      const resultPromise = useCase.execute(input)
      // Advance timers to allow retries to complete (2 retries * 1000ms = 2000ms)
      await jest.advanceTimersByTimeAsync(2000)
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(true)
      expect(result.attemptNumber).toBe(3)
      expect(result.previousAttempts).toEqual([
        'Image generation failed: Network timeout',
        'Image generation failed: Network timeout'
      ])
    })
  })

  describe('execute - edit type', () => {
    it('should successfully regenerate an edited image', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: RegenerateImageInput = {
        type: 'edit',
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.operationType).toBe('edit')
      expect(result.regenerationMetadata?.originalImageInfo).toEqual({
        bufferSize: imageBuffer.length,
        mimeType: 'image/png'
      })
    })

    it('should handle edit retries correctly', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: RegenerateImageInput = {
        type: 'edit',
        request,
        imageBuffer,
        mimeType: 'image/png'
      }
      mockGenerator.setFailUntilAttempt(1) // Fail first attempt, succeed on 2nd

      // Act
      const resultPromise = useCase.execute(input)
      // Advance timers to allow retry to complete (1 retry * 1000ms = 1000ms)
      await jest.advanceTimersByTimeAsync(1000)
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(true)
      expect(result.attemptNumber).toBe(2)
      expect(result.operationType).toBe('edit')
    })
  })

  describe('configuration', () => {
    it('should use default configuration', () => {
      // Act
      const config = useCase.getConfig()

      // Assert
      expect(config).toEqual(DEFAULT_REGENERATE_CONFIG)
    })

    it('should allow custom configuration', () => {
      // Arrange
      const customConfig: RegenerateImageConfig = {
        maxRetries: 5,
        enableAutoRetry: false,
        autoRetryErrorTypes: ['timeout'],
        retryDelayMs: 2000
      }
      useCase = new RegenerateImageUseCase(mockGenerator, customConfig)

      // Act
      const config = useCase.getConfig()

      // Assert
      expect(config).toEqual(customConfig)
    })

    it('should allow configuration updates', () => {
      // Arrange
      const updates = {
        maxRetries: 5,
        retryDelayMs: 2000
      }

      // Act
      useCase.updateConfig(updates)
      const config = useCase.getConfig()

      // Assert
      expect(config.maxRetries).toBe(5)
      expect(config.retryDelayMs).toBe(2000)
      expect(config.enableAutoRetry).toBe(DEFAULT_REGENERATE_CONFIG.enableAutoRetry) // Unchanged
    })

    it('should not retry when autoRetry is disabled', async () => {
      // Arrange
      const config: RegenerateImageConfig = {
        ...DEFAULT_REGENERATE_CONFIG,
        enableAutoRetry: false
      }
      useCase = new RegenerateImageUseCase(mockGenerator, config)
      
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setShouldFail(true)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.attemptNumber).toBe(1)
      expect(mockGenerator.getCallCount()).toBe(1) // No retries
    })
  })

  describe('attempt limits', () => {
    it('should reject execution when attempt number exceeds max retries', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }

      // Act
      const result = await useCase.execute(
        input, 
        5, // attemptNumber > maxRetries + 1
        ['error1', 'error2', 'error3']
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum retry attempts exceeded')
      expect(result.attemptNumber).toBe(5)
      expect(result.previousAttempts).toEqual(['error1', 'error2', 'error3'])
      expect(mockGenerator.getCallCount()).toBe(0) // Should not call generator
    })
  })

  describe('delay mechanism', () => {
    it('should apply retry delay', async () => {
      // Arrange
      const config: RegenerateImageConfig = {
        ...DEFAULT_REGENERATE_CONFIG,
        maxRetries: 1,
        retryDelayMs: 1000 // Use a more realistic delay for testing
      }
      useCase = new RegenerateImageUseCase(mockGenerator, config)
      
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setFailUntilAttempt(1) // Fail first, succeed second

      // Act - Start the async operation
      const resultPromise = useCase.execute(input)
      
      // Fast forward through all timers to complete the delayed retry
      await jest.advanceTimersByTimeAsync(1000)
      
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(true)
      expect(result.attemptNumber).toBe(2)
      expect(mockGenerator.getCallCount()).toBe(2) // Should have been called twice
    })

    it('should skip delay when retryDelayMs is 0', async () => {
      // Arrange
      const config: RegenerateImageConfig = {
        ...DEFAULT_REGENERATE_CONFIG,
        maxRetries: 1,
        retryDelayMs: 0
      }
      useCase = new RegenerateImageUseCase(mockGenerator, config)
      
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      const input: RegenerateImageInput = {
        type: 'generate',
        request
      }
      mockGenerator.setFailUntilAttempt(1)

      // Act
      const resultPromise = useCase.execute(input)
      // With 0 delay, no timer advancement needed, should resolve immediately
      const result = await resultPromise

      // Assert
      expect(result.success).toBe(true)
      // With 0 delay, retry should complete without timer advancement
    })
  })

  describe('utility methods', () => {
    it('should return availability status', () => {
      // Act & Assert
      expect(useCase.isAvailable()).toBe(true)
      
      mockGenerator.setAvailable(false)
      expect(useCase.isAvailable()).toBe(false)
    })

    it('should return generator info', () => {
      // Act
      const info = useCase.getGeneratorInfo()

      // Assert
      expect(info.name).toBe('Mock Regenerator')
      expect(info.version).toBe('1.0.0')
    })
  })
})