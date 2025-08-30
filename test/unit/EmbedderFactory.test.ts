import { EmbedderFactory } from '../../src/embedders/EmbedderFactory';
import { BaseEmbedder, EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { OpenAIEmbedder } from '../../src/embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../../src/embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../../src/embedders/GeminiEmbedder';
import { MistralEmbedder } from '../../src/embedders/MistralEmbedder';
import { createTestContainer } from '../setup';

// Mock the embedder classes
jest.mock('../../src/embedders/OpenAIEmbedder');
jest.mock('../../src/embedders/OllamaEmbedder');
jest.mock('../../src/embedders/GeminiEmbedder');
jest.mock('../../src/embedders/MistralEmbedder');

describe('EmbedderFactory', () => {
  let embedderFactory: EmbedderFactory;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockOpenAIEmbedder: jest.Mocked<OpenAIEmbedder>;
  let mockOllamaEmbedder: jest.Mocked<OllamaEmbedder>;
  let mockGeminiEmbedder: jest.Mocked<GeminiEmbedder>;
  let mockMistralEmbedder: jest.Mocked<MistralEmbedder>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockOpenAIEmbedder = {
      embed: jest.fn(),
      getDimensions: jest.fn(),
      getModelName: jest.fn(),
      isAvailable: jest.fn(),
    } as any;

    mockOllamaEmbedder = {
      embed: jest.fn(),
      getDimensions: jest.fn(),
      getModelName: jest.fn(),
      isAvailable: jest.fn(),
    } as any;

    mockGeminiEmbedder = {
      embed: jest.fn(),
      getDimensions: jest.fn(),
      getModelName: jest.fn(),
      isAvailable: jest.fn(),
    } as any;

    mockMistralEmbedder = {
      embed: jest.fn(),
      getDimensions: jest.fn(),
      getModelName: jest.fn(),
      isAvailable: jest.fn(),
    } as any;

    // Set up default mock behavior
    mockConfigService.get.mockReturnValue({
      provider: 'openai',
      openai: { apiKey: 'test-key' },
      ollama: { baseUrl: 'http://localhost:11434' },
      gemini: { apiKey: 'test-gemini-key' },
      mistral: { apiKey: 'test-mistral-key' },
    });

    mockOpenAIEmbedder.isAvailable.mockResolvedValue(true);
    mockOllamaEmbedder.isAvailable.mockResolvedValue(true);
    mockGeminiEmbedder.isAvailable.mockResolvedValue(true);
    mockMistralEmbedder.isAvailable.mockResolvedValue(true);

    mockOpenAIEmbedder.getModelName.mockReturnValue('text-embedding-ada-002');
    mockOllamaEmbedder.getModelName.mockReturnValue('nomic-embed-text');
    mockGeminiEmbedder.getModelName.mockReturnValue('embedding-001');
    mockMistralEmbedder.getModelName.mockReturnValue('mistral-embed');

    mockOpenAIEmbedder.getDimensions.mockReturnValue(1536);
    mockOllamaEmbedder.getDimensions.mockReturnValue(768);
    mockGeminiEmbedder.getDimensions.mockReturnValue(768);
    mockMistralEmbedder.getDimensions.mockReturnValue(1024);

    // Create factory instance
    embedderFactory = new EmbedderFactory(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockOpenAIEmbedder,
      mockOllamaEmbedder,
      mockGeminiEmbedder,
      mockMistralEmbedder
    );
  });

  describe('Constructor', () => {
    it('should initialize with all embedders registered', () => {
      const registeredProviders = embedderFactory['embedders'];
      expect(registeredProviders.has('openai')).toBe(true);
      expect(registeredProviders.has('ollama')).toBe(true);
      expect(registeredProviders.has('gemini')).toBe(true);
      expect(registeredProviders.has('mistral')).toBe(true);
      expect(registeredProviders.size).toBe(4);
    });
  });

  describe('getEmbedder', () => {
    it('should return the configured embedder provider', async () => {
      const embedder = await embedderFactory.getEmbedder();
      expect(embedder).toBe(mockOpenAIEmbedder);
    });

    it('should return the specified embedder provider', async () => {
      const embedder = await embedderFactory.getEmbedder('ollama');
      expect(embedder).toBe(mockOllamaEmbedder);
    });

    it('should throw error for unsupported provider', async () => {
      await expect(embedderFactory.getEmbedder('unsupported')).rejects.toThrow(
        'Unsupported embedder provider: unsupported'
      );
    });

    it('should throw error when embedder is not available', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(false);
      
      await expect(embedderFactory.getEmbedder('openai')).rejects.toThrow(
        'Embedder provider openai is not available'
      );
    });

    it('should check embedder availability', async () => {
      await embedderFactory.getEmbedder('openai');
      expect(mockOpenAIEmbedder.isAvailable).toHaveBeenCalled();
    });
  });

  describe('embed', () => {
    const mockInput: EmbeddingInput = { text: 'test text' };
    const mockResult: EmbeddingResult = {
      vector: [0.1, 0.2, 0.3],
      dimensions: 1536,
      model: 'text-embedding-ada-002',
      processingTime: 100,
    };

    beforeEach(() => {
      mockOpenAIEmbedder.embed.mockResolvedValue(mockResult);
    });

    it('should embed single input using configured provider', async () => {
      const result = await embedderFactory.embed(mockInput);
      
      expect(result).toBe(mockResult);
      expect(mockOpenAIEmbedder.embed).toHaveBeenCalledWith(mockInput);
    });

    it('should embed single input using specified provider', async () => {
      const result = await embedderFactory.embed(mockInput, 'ollama');
      
      expect(result).toBe(mockResult);
      expect(mockOllamaEmbedder.embed).toHaveBeenCalledWith(mockInput);
    });

    it('should embed array of inputs', async () => {
      const mockInputs: EmbeddingInput[] = [mockInput, { text: 'test text 2' }];
      const mockResults: EmbeddingResult[] = [mockResult, { ...mockResult, processingTime: 150 }];
      
      mockOpenAIEmbedder.embed.mockResolvedValue(mockResults);
      
      const result = await embedderFactory.embed(mockInputs);
      
      expect(result).toBe(mockResults);
      expect(mockOpenAIEmbedder.embed).toHaveBeenCalledWith(mockInputs);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return all available providers', async () => {
      const available = await embedderFactory.getAvailableProviders();
      
      expect(available).toEqual(['openai', 'ollama', 'gemini', 'mistral']);
    });

    it('should return only available providers when some are unavailable', async () => {
      mockOllamaEmbedder.isAvailable.mockResolvedValue(false);
      mockGeminiEmbedder.isAvailable.mockResolvedValue(false);
      
      const available = await embedderFactory.getAvailableProviders();
      
      expect(available).toEqual(['openai', 'mistral']);
    });

    it('should handle errors when checking availability', async () => {
      mockGeminiEmbedder.isAvailable.mockRejectedValue(new Error('Network error'));
      
      const available = await embedderFactory.getAvailableProviders();
      
      expect(available).toEqual(['openai', 'ollama', 'mistral']);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Failed to check availability for embedder gemini',
        expect.any(Object)
      );
    });

    it('should return empty array when no providers are available', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(false);
      mockOllamaEmbedder.isAvailable.mockResolvedValue(false);
      mockGeminiEmbedder.isAvailable.mockResolvedValue(false);
      mockMistralEmbedder.isAvailable.mockResolvedValue(false);
      
      const available = await embedderFactory.getAvailableProviders();
      
      expect(available).toEqual([]);
    });
  });

  describe('getProviderInfo', () => {
    it('should return provider info for configured provider', async () => {
      const info = await embedderFactory.getProviderInfo();
      
      expect(info).toEqual({
        name: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        available: true,
      });
    });

    it('should return provider info for specified provider', async () => {
      const info = await embedderFactory.getProviderInfo('ollama');
      
      expect(info).toEqual({
        name: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        available: true,
      });
    });

    it('should include availability status in provider info', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(false);
      
      const info = await embedderFactory.getProviderInfo('openai');
      
      expect(info.available).toBe(false);
    });
  });

  describe('autoSelectProvider', () => {
    it('should return preferred provider when available', async () => {
      const provider = await embedderFactory.autoSelectProvider();
      
      expect(provider).toBe('openai');
    });

    it('should return first available provider when preferred is unavailable', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(false);
      
      const provider = await embedderFactory.autoSelectProvider();
      
      expect(provider).toBe('ollama');
    });

    it('should throw error when no providers are available', async () => {
      mockOpenAIEmbedder.isAvailable.mockResolvedValue(false);
      mockOllamaEmbedder.isAvailable.mockResolvedValue(false);
      mockGeminiEmbedder.isAvailable.mockResolvedValue(false);
      mockMistralEmbedder.isAvailable.mockResolvedValue(false);
      
      await expect(embedderFactory.autoSelectProvider()).rejects.toThrow(
        'No embedder providers available'
      );
    });
  });

  describe('registerProvider', () => {
    it('should register new provider', () => {
      const mockCustomEmbedder = {
        embed: jest.fn(),
        getDimensions: jest.fn(),
        getModelName: jest.fn(),
        isAvailable: jest.fn(),
      } as any;

      embedderFactory.registerProvider('custom', mockCustomEmbedder);
      
      expect(embedderFactory['embedders'].has('custom')).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Registered embedder provider: custom');
    });

    it('should overwrite existing provider', () => {
      const mockNewOpenAI = {
        embed: jest.fn(),
        getDimensions: jest.fn(),
        getModelName: jest.fn(),
        isAvailable: jest.fn(),
      } as any;

      embedderFactory.registerProvider('openai', mockNewOpenAI);
      
      expect(embedderFactory['embedders'].get('openai')).toBe(mockNewOpenAI);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return all registered provider names', () => {
      const providers = embedderFactory.getRegisteredProviders();
      
      expect(providers).toEqual(['openai', 'ollama', 'gemini', 'mistral']);
    });

    it('should include custom registered providers', () => {
      const mockCustomEmbedder = {
        embed: jest.fn(),
        getDimensions: jest.fn(),
        getModelName: jest.fn(),
        isAvailable: jest.fn(),
      } as any;

      embedderFactory.registerProvider('custom', mockCustomEmbedder);
      
      const providers = embedderFactory.getRegisteredProviders();
      
      expect(providers).toContain('custom');
    });
  });
});