import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class MistralEmbedder extends BaseEmbedder implements Embedder {
  private apiKey: string;
  private model: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler);
    
    const config = configService.get('embedding');
    this.apiKey = config.mistral.apiKey;
    this.model = config.mistral.model || 'mistral-embed';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const { result, time } = await this.measureTime(async () => {
        return inputs.map(inp => this.generateMockEmbedding(inp));
      });

      return Array.isArray(input) ? result : result[0];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Mistral embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MistralEmbedder', operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    return 1024; // Mistral embedding dimensions
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  private generateMockEmbedding(input: EmbeddingInput): EmbeddingResult {
    const dimensions = this.getDimensions();
    const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    
    return {
      vector,
      dimensions,
      model: this.model,
      processingTime: Math.floor(Math.random() * 120) + 80
    };
  }
}