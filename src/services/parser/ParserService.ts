import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { TreeSitterService } from './TreeSitterService';
import { SmartCodeParser } from './SmartCodeParser';

export interface ParseResult {
  filePath: string;
  language: string;
  ast: any;
  functions: any[];
  classes: any[];
  imports: any[];
  exports: any[];
  metadata: Record<string, any>;
}

export interface ParseOptions {
  includeComments?: boolean;
  includeAST?: boolean;
  maxDepth?: number;
  focus?: 'functions' | 'classes' | 'imports' | 'all';
}

@injectable()
export class ParserService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private treeSitterService: TreeSitterService;
  private smartCodeParser: SmartCodeParser;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TreeSitterService) treeSitterService: TreeSitterService,
    @inject(SmartCodeParser) smartCodeParser: SmartCodeParser
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.treeSitterService = treeSitterService;
    this.smartCodeParser = smartCodeParser;
  }

  async parseFile(filePath: string, options: ParseOptions = {}): Promise<ParseResult> {
    this.logger.info('Parsing file', { filePath, options });

    try {
      // Read file content
      const fs = await import('fs').then(m => m.promises);
      const content = await fs.readFile(filePath, 'utf-8');

      // Determine the best parser for this file
      const language = this.detectLanguage(filePath);

      let result: ParseResult;

      const parserLanguage = this.treeSitterService.detectLanguage(filePath);
      if (parserLanguage) {
        const parseResult = await this.treeSitterService.parseFile(filePath, content);
        result = {
          filePath,
          language: parseResult.language.name,
          ast: parseResult.ast,
          functions: this.treeSitterService.extractFunctions(parseResult.ast),
          classes: this.treeSitterService.extractClasses(parseResult.ast),
          imports: this.treeSitterService.extractImports(parseResult.ast),
          exports: this.treeSitterService.extractExports(parseResult.ast),
          metadata: {}
        };
      } else {
        const parsedFile = await this.smartCodeParser.parseFile(filePath, content, options);
        result = {
          filePath,
          language: parsedFile.language,
          ast: {} as any,
          functions: [],
          classes: [],
          imports: parsedFile.metadata.imports,
          exports: parsedFile.metadata.exports,
          metadata: {}
        };
      }

      this.logger.debug('File parsed successfully', {
        filePath,
        language,
        functionCount: result.functions.length,
        classCount: result.classes.length
      });

      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to parse file ${filePath}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserService', operation: 'parseFile' }
      );
      throw error;
    }
  }

  async parseFiles(filePaths: string[], options: ParseOptions = {}): Promise<ParseResult[]> {
    this.logger.info('Parsing multiple files', { fileCount: filePaths.length, options });

    const results: ParseResult[] = [];
    const errors: string[] = [];

    // Parse files in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      const batchPromises = batch.map(async (filePath) => {
        try {
          return await this.parseFile(filePath, options);
        } catch (error) {
          const errorMsg = `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is ParseResult => result !== null));
    }

    if (errors.length > 0) {
      this.logger.warn('Some files failed to parse', {
        totalFiles: filePaths.length,
        successCount: results.length,
        errorCount: errors.length
      });
    }

    return results;
  }

  async extractFunctions(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'functions' });
      return result.functions;
    } catch (error) {
      this.logger.error('Failed to extract functions', { filePath, error });
      return [];
    }
  }

  async extractClasses(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'classes' });
      return result.classes;
    } catch (error) {
      this.logger.error('Failed to extract classes', { filePath, error });
      return [];
    }
  }

  async extractImports(filePath: string): Promise<any[]> {
    try {
      const result = await this.parseFile(filePath, { focus: 'imports' });
      return result.imports;
    } catch (error) {
      this.logger.error('Failed to extract imports', { filePath, error });
      return [];
    }
  }

  async getLanguageStats(filePaths: string[]): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    for (const filePath of filePaths) {
      const language = this.detectLanguage(filePath);
      stats[language] = (stats[language] || 0) + 1;
    }

    return stats;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'sh': 'shell',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'sql': 'sql'
    };

    return languageMap[ext || ''] || 'unknown';
  }

  getSupportedLanguages(): string[] {
    const treeSitterLanguages = this.treeSitterService.getSupportedLanguages().map(lang => lang.name.toLowerCase());
    // SmartCodeParser doesn't have a method for this, so we'll return an empty array for now
    const smartParserLanguages: string[] = [];

    return [...new Set([...treeSitterLanguages, ...smartParserLanguages])];
  }

  async validateSyntax(filePath: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      await this.parseFile(filePath, { includeComments: true });
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      };
    }
  }
}