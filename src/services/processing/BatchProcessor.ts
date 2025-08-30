import { injectable } from 'inversify';

export interface BatchOptions {
  batchSize?: number;
  maxConcurrency?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  continueOnError?: boolean;
}

export interface BatchResult<T> {
  success: boolean;
  processedItems: number;
  results: T[];
  errors: string[];
  processingTime: number;
}

@injectable()
export class BatchProcessor {
  private defaultOptions: BatchOptions = {
    batchSize: 50,
    maxConcurrency: 5,
    timeout: 300000,
    retryAttempts: 3,
    retryDelay: 1000,
    continueOnError: false
  };

  constructor(private logger?: any) {}

  async processInBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: BatchOptions = {}
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const config = { ...this.defaultOptions, ...options };
    
    if (items.length === 0) {
      return {
        success: true,
        processedItems: 0,
        results: [],
        errors: [],
        processingTime: Date.now() - startTime
      };
    }

    this.logger?.info('Starting batch processing', {
      totalItems: items.length,
      batchSize: config.batchSize,
      maxConcurrency: config.maxConcurrency
    });

    const results: R[] = [];
    const errors: string[] = [];
    let processedItems = 0;

    try {
      // Process items in batches
      for (let i = 0; i < items.length; i += config.batchSize!) {
        const batch = items.slice(i, i + config.batchSize!);
        
        // Process batch with retry logic
        const batchResult = await this.processBatchWithRetry(
          batch,
          processor,
          config
        );
        
        results.push(...batchResult.results);
        errors.push(...batchResult.errors);
        processedItems += batchResult.processedItems;

        // If continueOnError is false and there are errors, stop processing
        if (!config.continueOnError && batchResult.errors.length > 0) {
          this.logger?.warn('Stopping batch processing due to errors', {
            batchIndex: Math.floor(i / config.batchSize!),
            errors: batchResult.errors
          });
          break;
        }
      }

      const processingTime = Date.now() - startTime;
      
      this.logger?.info('Batch processing completed', {
        totalItems: items.length,
        processedItems,
        successCount: results.length,
        errorCount: errors.length,
        processingTime
      });

      return {
        success: errors.length === 0,
        processedItems,
        results,
        errors,
        processingTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const processingTime = Date.now() - startTime;
      
      this.logger?.error('Batch processing failed', {
        totalItems: items.length,
        processedItems,
        error: errorMessage,
        processingTime
      });

      return {
        success: false,
        processedItems,
        results,
        errors: [...errors, errorMessage],
        processingTime
      };
    }
  }

  private async processBatchWithRetry<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: BatchOptions
  ): Promise<{ results: R[]; errors: string[]; processedItems: number }> {
    let attempts = 0;
    let lastError: string = '';

    while (attempts < options.retryAttempts!) {
      try {
        // Process batch with timeout
        const results = await this.processWithTimeout(
          () => processor(batch),
          options.timeout!
        );

        return {
          results,
          errors: [],
          processedItems: batch.length
        };
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempts < options.retryAttempts!) {
          this.logger?.warn('Batch processing failed, retrying', {
            attempt: attempts,
            maxAttempts: options.retryAttempts,
            batchSize: batch.length,
            error: lastError
          });
          
          // Wait before retry
          await this.delay(options.retryDelay! * attempts);
        } else {
          this.logger?.error('Batch processing failed after all retries', {
            batchSize: batch.length,
            attempts,
            error: lastError
          });
        }
      }
    }

    return {
      results: [],
      errors: [lastError],
      processedItems: 0
    };
  }

  private async processWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}