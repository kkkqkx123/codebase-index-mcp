import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class OllamaEmbedder extends BaseEmbedder implements Embedder {
  private baseUrl: string;
  private model: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler);
    
    const config = configService.get('embedding');
    this.baseUrl = config.ollama.baseUrl || 'http://localhost:11434';
    this.model = config.ollama.model || 'nomic-embed-text';
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
        new Error(`Ollama embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'OllamaEmbedder', operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    return 768; // nomic-embed-text dimensions
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    // For now, return true as a placeholder
    // In a real implementation, this would check if Ollama is running
    return true;
  }

  private generateMockEmbedding(input: EmbeddingInput): EmbeddingResult {
    const dimensions = this.getDimensions();
    const vector = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    
    return {
      vector,
      dimensions,
      model: this.model,
      processingTime: Math.floor(Math.random() * 150) + 100
    };
  }
}