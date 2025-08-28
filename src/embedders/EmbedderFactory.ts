import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { OpenAIEmbedder } from './OpenAIEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';
import { GeminiEmbedder } from './GeminiEmbedder';
import { MistralEmbedder } from './MistralEmbedder';
import { Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class EmbedderFactory {
  private configService: ConfigService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private embedders: Map<string, Embedder> = new Map();

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(OpenAIEmbedder) openAIEmbedder: OpenAIEmbedder,
    @inject(OllamaEmbedder) ollamaEmbedder: OllamaEmbedder,
    @inject(GeminiEmbedder) geminiEmbedder: GeminiEmbedder,
    @inject(MistralEmbedder) mistralEmbedder: MistralEmbedder
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;

    // Register embedders
    this.embedders.set('openai', openAIEmbedder);
    this.embedders.set('ollama', ollamaEmbedder);
    this.embedders.set('gemini', geminiEmbedder);
    this.embedders.set('mistral', mistralEmbedder);
  }

  async getEmbedder(provider?: string): Promise<Embedder> {
    const config = this.configService.get('embedding');
    const selectedProvider = provider || config.provider;

    const embedder = this.embedders.get(selectedProvider);
    if (!embedder) {
      throw new Error(`Unsupported embedder provider: ${selectedProvider}`);
    }

    // Check if the embedder is available
    const isAvailable = await embedder.isAvailable();
    if (!isAvailable) {
      throw new Error(`Embedder provider ${selectedProvider} is not available`);
    }

    return embedder;
  }

  async embed(input: EmbeddingInput | EmbeddingInput[], provider?: string): Promise<EmbeddingResult | EmbeddingResult[]> {
    const embedder = await this.getEmbedder(provider);
    return embedder.embed(input);
  }

  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, embedder] of this.embedders.entries()) {
      try {
        const isAvailable = await embedder.isAvailable();
        if (isAvailable) {
          available.push(name);
        }
      } catch (error) {
        this.logger.warn(`Failed to check availability for embedder ${name}`, { error });
      }
    }

    return available;
  }

  async getProviderInfo(provider?: string): Promise<{
    name: string;
    model: string;
    dimensions: number;
    available: boolean;
  }> {
    const embedder = await this.getEmbedder(provider);
    const available = await embedder.isAvailable();

    return {
      name: provider || this.configService.get('embedding').provider,
      model: embedder.getModelName(),
      dimensions: embedder.getDimensions(),
      available
    };
  }

  async autoSelectProvider(): Promise<string> {
    const available = await this.getAvailableProviders();
    
    if (available.length === 0) {
      throw new Error('No embedder providers available');
    }

    const config = this.configService.get('embedding');
    const preferredProvider = config.provider;

    // Return preferred provider if available
    if (available.includes(preferredProvider)) {
      return preferredProvider;
    }

    // Otherwise return first available provider
    return available[0];
  }

  registerProvider(name: string, embedder: Embedder): void {
    this.embedders.set(name, embedder);
    this.logger.info(`Registered embedder provider: ${name}`);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.embedders.keys());
  }
}