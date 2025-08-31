import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { HttpEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './CustomEmbedder';

@injectable()
export class MistralEmbedder extends HttpEmbedder implements Embedder {
  private apiKey: string;
  private model: string;

  constructor(
      @inject(ConfigService) configService: ConfigService,
      @inject(LoggerService) logger: LoggerService,
      @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
      @inject(EmbeddingCacheService) cacheService: EmbeddingCacheService
    ) {
      super(configService, logger, errorHandler, cacheService);
      
      const config = configService.get('embedding');
      this.apiKey = config.mistral.apiKey;
      this.model = config.mistral.model || 'mistral-embed';
    }

  protected getBaseUrl(): string {
    const config = this.configService.get('embedding');
    return config.mistral.baseUrl || 'https://api.mistral.ai';
  }

  protected getApiKey(): string {
    return this.apiKey;
  }

  protected getModel(): string {
    return this.model;
  }

  protected getEmbeddingEndpoint(): string {
    return '/v1/embeddings';
  }

  protected getAvailabilityEndpoint(): string {
    return '/v1/models';
  }

  protected getComponentName(): string {
    return 'MistralEmbedder';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    return await this.embedWithCache(input, async (inputs) => {
      return await this.makeEmbeddingRequest(inputs);
    });
  }

  getDimensions(): number {
    return 1024; // Mistral embedding dimensions
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    return await this.checkAvailabilityViaHttp();
  }
}