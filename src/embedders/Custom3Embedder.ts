import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { CustomEmbedder } from './CustomEmbedder';

@injectable()
export class Custom3Embedder extends CustomEmbedder {
  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(EmbeddingCacheService) cacheService: EmbeddingCacheService
  ) {
    super(configService, logger, errorHandler, cacheService, 'custom3', 1536);
  }
}