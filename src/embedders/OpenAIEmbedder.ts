import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class OpenAIEmbedder extends BaseEmbedder implements Embedder {
  private apiKey: string;
  private model: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler);
    
    const config = configService.get('embedding');
    this.apiKey = config.openai.apiKey;
    this.model = config.openai.model || 'text-embedding-ada-002';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      // For now, simulate embedding generation
      const { result, time } = await this.measureTime(async () => {
        return inputs.map(inp => this.generateMockEmbedding(inp));
      });

      return Array.isArray(input) ? result : result[0];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`OpenAI embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'OpenAIEmbedder', operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    return 1536; // text-embedding-ada-002 dimensions
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  private generateMockEmbedding(input: EmbeddingInput): EmbeddingResult {
    // Generate a mock embedding vector for demonstration
    const dimensions = this.getDimensions();
    const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    
    return {
      vector,
      dimensions,
      model: this.model,
      processingTime: Math.floor(Math.random() * 100) + 50
    };
  }
}