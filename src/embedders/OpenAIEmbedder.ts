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
      @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
      @inject(EmbeddingCacheService) cacheService: EmbeddingCacheService
    ) {
      super(configService, logger, errorHandler, cacheService);
      
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
      
      // Check cache for existing embeddings
      const cachedResults: EmbeddingResult[] = [];
      const uncachedInputs: EmbeddingInput[] = [];
      
      for (const inp of inputs) {
        const cached = this.cacheService.get(inp.text, this.model);
        if (cached) {
          cachedResults.push(cached);
        } else {
          uncachedInputs.push(inp);
        }
      }
      
      // If all inputs are cached, return cached results
      if (uncachedInputs.length === 0) {
        this.logger.debug('All embeddings found in cache', { count: cachedResults.length });
        return Array.isArray(input) ? cachedResults : cachedResults[0];
      }
      
      try {
        // Wait for available request slot
        await this.waitForAvailableSlot();
        
        const { result, time } = await this.executeWithTimeout(async () => {
          return await this.measureTime(async () => {
            // Prepare the API request
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}/v1/embeddings`;
            const headers = {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            };
            
            // Prepare the input texts
            const inputTexts = uncachedInputs.map(inp => inp.text);
            
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
        });
        
        // Release request slot
        this.releaseSlot();
        
        // Update processingTime with the actual measured time
        const apiResults = Array.isArray(result) ? result : [result];
        apiResults.forEach(embedding => {
          embedding.processingTime = time;
        });
        
        // Cache the new results
        apiResults.forEach((embedding, index) => {
          this.cacheService.set(uncachedInputs[index].text, this.model, embedding);
        });
        
        // Combine cached and new results
        const finalResult = [...cachedResults, ...apiResults];
        
        return Array.isArray(input) ? finalResult : finalResult[0];
      } catch (error) {
        // Release request slot in case of error
        this.releaseSlot();
        
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