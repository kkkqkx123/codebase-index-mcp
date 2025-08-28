import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';

export interface EmbeddingInput {
  text: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  processingTime: number;
}

export interface Embedder {
  embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]>;
  getDimensions(): number;
  getModelName(): string;
  isAvailable(): Promise<boolean>;
}

@injectable()
export abstract class BaseEmbedder implements Embedder {
  protected logger: LoggerService;
  protected errorHandler: ErrorHandlerService;
  protected configService: ConfigService;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  abstract embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]>;
  abstract getDimensions(): number;
  abstract getModelName(): string;
  abstract isAvailable(): Promise<boolean>;

  protected async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; time: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    return { result, time: endTime - startTime };
  }
}