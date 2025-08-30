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
        // Prepare the API request
        const url = `${this.baseUrl}/api/embeddings`;
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Process each input separately as Ollama API expects single input
        const embeddings = [];
        for (const inp of inputs) {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              prompt: inp.text,
              model: this.model
            })
          });
          
          if (!response.ok) {
            throw new Error(`Ollama API request failed with status ${response.status}: ${await response.text()}`);
          }
          
          const data = await response.json() as { embedding: number[] };
          embeddings.push({
            vector: data.embedding,
            dimensions: data.embedding.length,
            model: this.model,
            processingTime: 0 // Will be updated after timing
          });
        }
        
        return embeddings as EmbeddingResult[];
      });

      // Update processingTime with the actual measured time
      const finalResult = Array.isArray(result) ? result : [result];
      finalResult.forEach(embedding => {
        embedding.processingTime = time;
      });

      return Array.isArray(input) ? finalResult : finalResult[0];
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
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url, {
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama availability check failed', { error });
      return false;
    }
  }


}