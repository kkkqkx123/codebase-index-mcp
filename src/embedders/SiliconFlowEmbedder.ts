import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class SiliconFlowEmbedder extends BaseEmbedder implements Embedder {
  private apiKey: string;
  private model: string;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler);
    
    const config = configService.get('embedding');
    this.apiKey = config.siliconflow.apiKey;
    this.model = config.siliconflow.model || 'BAAI/bge-large-en-v1.5';
  }

  private getBaseUrl(): string {
    const config = this.configService.get('embedding');
    // SiliconFlow URL will be set in .env file by the user
    return config.siliconflow.baseUrl || '';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const { result, time } = await this.measureTime(async () => {
        // Prepare the API request
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) {
          throw new Error('SiliconFlow base URL is not configured. Please set SILICONFLOW_BASE_URL in your .env file.');
        }
        
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
          throw new Error(`SiliconFlow API request failed with status ${response.status}: ${await response.text()}`);
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
        new Error(`SiliconFlow embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SiliconFlowEmbedder', operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    // Default dimensions for BAAI/bge-large-en-v1.5
    return 1024;
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        return false;
      }
      
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
      this.logger.warn('SiliconFlow availability check failed', { error });
      return false;
    }
  }
}