import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class GeminiEmbedder extends BaseEmbedder implements Embedder {
  private apiKey: string;
  private model: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler);
    
    const config = configService.get('embedding');
    this.apiKey = config.gemini.apiKey;
    this.model = config.gemini.model || 'embedding-001';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const { result, time } = await this.measureTime(async () => {
        // Prepare the API request
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Process each input separately as Gemini API expects single input
        const embeddings = [];
        for (const inp of inputs) {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              content: {
                parts: [{
                  text: inp.text
                }]
              }
            })
          });
          
          if (!response.ok) {
            throw new Error(`Gemini API request failed with status ${response.status}: ${await response.text()}`);
          }
          
          const data = await response.json() as { embedding: { values: number[] } };
          embeddings.push({
            vector: data.embedding.values,
            dimensions: data.embedding.values.length,
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
        new Error(`Gemini embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GeminiEmbedder', operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    return 768; // Gemini embedding dimensions
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'GET'
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn('Gemini availability check failed', { error });
      return false;
    }
  }


}