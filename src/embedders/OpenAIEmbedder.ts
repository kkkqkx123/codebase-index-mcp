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

  private getBaseUrl(): string {
    const config = this.configService.get('embedding');
    return config.openai.baseUrl || 'https://api.openai.com';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const { result, time } = await this.measureTime(async () => {
        // Prepare the API request
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/v1/embeddings`;
        const headers = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        };
        
        // Prepare the input texts
        const inputTexts = inputs.map(inp => inp.text);
        
        // Make the API request
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            input: inputTexts,
            model: this.model
          })
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API request failed with status ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json() as { data: Array<{ embedding: number[] }> };
        
        // Process the response
        return data.data.map((item, index: number) => ({
          vector: item.embedding,
          dimensions: item.embedding.length,
          model: this.model,
          processingTime: 0 // Will be updated after timing
        })) as EmbeddingResult[];
      });

      // Update processingTime with the actual measured time
      const finalResult = Array.isArray(result) ? result : [result];
      finalResult.forEach(embedding => {
        embedding.processingTime = time;
      });

      return Array.isArray(input) ? finalResult : finalResult[0];
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
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/v1/models`;
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn('OpenAI availability check failed', { error });
      return false;
    }
  }
}