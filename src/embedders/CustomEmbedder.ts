import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class CustomEmbedder extends BaseEmbedder implements Embedder {
  private name: string;
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    name: string,
    dimensions: number = 768
  ) {
    super(configService, logger, errorHandler);
    
    this.name = name;
    this.dimensions = dimensions;
    
    const config = configService.get('embedding');
    const customConfig = (config.custom as Record<string, any>) || {};
    const providerConfig = customConfig[name] || {};
    
    this.apiKey = providerConfig.apiKey || '';
    this.model = providerConfig.model || 'default-model';
  }

  private getBaseUrl(): string {
    const config = this.configService.get('embedding');
    const customConfig = (config.custom as Record<string, any>) || {};
    const providerConfig = customConfig[this.name] || {};
    
    // Custom embedders only read from .env, no default URL
    return providerConfig.baseUrl || '';
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      const { result, time } = await this.measureTime(async () => {
        // Prepare the API request
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) {
          throw new Error(`Custom embedder ${this.name} base URL is not configured. Please set CUSTOM_${this.name.toUpperCase()}_BASE_URL in your .env file.`);
        }
        
        const url = `${baseUrl}/embeddings`;
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
          throw new Error(`Custom embedder ${this.name} API request failed with status ${response.status}: ${await response.text()}`);
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
        new Error(`Custom embedder ${this.name} embedding failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: `CustomEmbedder-${this.name}`, operation: 'embed' }
      );
      throw error;
    }
  }

  getDimensions(): number {
    return this.dimensions;
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
      
      const url = `${baseUrl}/models`;
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
      this.logger.warn(`Custom embedder ${this.name} availability check failed`, { error });
      return false;
    }
  }
}