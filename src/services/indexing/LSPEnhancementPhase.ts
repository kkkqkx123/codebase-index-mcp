import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { EnhancedParserService } from '../parser/EnhancedParserService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { LSPEnhancedParseResult } from '../lsp/types';

export interface LSPPhaseOptions {
  enableLSP?: boolean;
  lspTimeout?: number;
  includeTypes?: boolean;
  includeReferences?: boolean;
  includeDiagnostics?: boolean;
  cacheLSP?: boolean;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface LSPPhaseResult {
  enhancedResults: LSPEnhancedParseResult[];
  processingTime: number;
  filesWithLSP: number;
  totalSymbols: number;
  totalDiagnostics: number;
  errors: string[];
}

@injectable()
export class LSPEnhancementPhase {
  private enhancedParserService: EnhancedParserService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.EnhancedParserService) enhancedParserService: EnhancedParserService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.enhancedParserService = enhancedParserService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  async execute(parseResults: any[], options: LSPPhaseOptions = {}): Promise<LSPPhaseResult> {
    const startTime = Date.now();

    // 检查是否启用LSP
    const enableLSP = options.enableLSP ?? this.configService.get('lsp')?.enabled ?? false;

    if (!enableLSP) {
      this.logger.debug('LSP enhancement disabled, skipping phase');
      return {
        enhancedResults: parseResults as LSPEnhancedParseResult[],
        processingTime: 0,
        filesWithLSP: 0,
        totalSymbols: 0,
        totalDiagnostics: 0,
        errors: [],
      };
    }

    this.logger.info('Starting LSP enhancement phase', {
      fileCount: parseResults.length,
      options,
    });

    try {
      // 提取文件路径
      const filePaths = parseResults.map(result => result.filePath).filter(Boolean);

      if (filePaths.length === 0) {
        this.logger.warn('No valid file paths for LSP enhancement');
        return {
          enhancedResults: parseResults as LSPEnhancedParseResult[],
          processingTime: 0,
          filesWithLSP: 0,
          totalSymbols: 0,
          totalDiagnostics: 0,
          errors: ['No valid file paths provided'],
        };
      }

      // 使用增强的解析服务处理文件
      const enhancedOptions = {
        enableLSP: true,
        lspTimeout: options.lspTimeout || (this.configService.get('lsp')?.timeout ?? 30000),
        includeTypes: options.includeTypes ?? true,
        includeReferences: options.includeReferences ?? true,
        includeDiagnostics: options.includeDiagnostics ?? true,
        cacheLSP: options.cacheLSP ?? this.configService.get('lsp')?.cacheEnabled ?? true,
      };

      const enhancedResults = await this.enhancedParserService.parseFiles(
        filePaths,
        enhancedOptions
      );

      // 统计结果
      const filesWithLSP = enhancedResults.filter(
        r => r.lspSymbols && r.lspSymbols.length > 0
      ).length;

      const totalSymbols = enhancedResults.reduce((sum, r) => sum + (r.lspSymbols?.length || 0), 0);

      const totalDiagnostics = enhancedResults.reduce(
        (sum, r) => sum + (r.lspDiagnostics?.length || 0),
        0
      );

      const processingTime = Date.now() - startTime;

      this.logger.info('LSP enhancement phase completed', {
        fileCount: enhancedResults.length,
        filesWithLSP,
        totalSymbols,
        totalDiagnostics,
        processingTime,
        averageTimePerFile: processingTime / enhancedResults.length,
      });

      return {
        enhancedResults,
        processingTime,
        filesWithLSP,
        totalSymbols,
        totalDiagnostics,
        errors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(new Error(`LSP enhancement phase failed: ${errorMessage}`), {
        component: 'LSPEnhancementPhase',
        operation: 'execute',
      });

      // 降级处理：返回原始结果
      this.logger.warn('LSP enhancement failed, returning basic results', {
        error: errorMessage,
      });

      return {
        enhancedResults: parseResults as LSPEnhancedParseResult[],
        processingTime: Date.now() - startTime,
        filesWithLSP: 0,
        totalSymbols: 0,
        totalDiagnostics: 0,
        errors: [errorMessage],
      };
    }
  }

  async validatePreconditions(): Promise<{
    canExecute: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const result = {
      canExecute: false,
      warnings: [] as string[],
      errors: [] as string[],
    };

    try {
      // 检查LSP是否启用
      if (!(this.configService.get('lsp')?.enabled ?? false)) {
        result.warnings.push('LSP is disabled in configuration');
        return result;
      }

      // 检查增强解析服务健康状态
      const healthCheck = await this.enhancedParserService.healthCheck();
      if (!healthCheck.healthy) {
        result.errors.push(
          `Enhanced parser service unhealthy: ${JSON.stringify(healthCheck.details)}`
        );
        return result;
      }

      // 检查LSP管理器状态
      const lspEnabled = this.enhancedParserService.isLSPEnabled();
      if (!lspEnabled) {
        result.warnings.push('LSP enhancement is not enabled');
        return result;
      }

      result.canExecute = true;
      return result;
    } catch (error) {
      result.errors.push(
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return result;
    }
  }

  getPhaseMetrics(): Record<string, any> {
    return {
      phase: 'lsp_enhancement',
      enabled: this.configService.get('lsp')?.enabled ?? false,
      supportedLanguages: this.enhancedParserService.getSupportedLanguages(),
      timeout: this.configService.get('lsp')?.timeout ?? 30000,
      batchSize: this.configService.get('lsp')?.batchSize ?? 20,
    };
  }
}
