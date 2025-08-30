import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { CustomEmbedder } from './CustomEmbedder';

@injectable()
export class Custom2Embedder extends CustomEmbedder {
  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    super(configService, logger, errorHandler, 'custom2', 1024);
  }
}