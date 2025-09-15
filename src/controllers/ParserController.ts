import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ParserService, ParseResult, ParseOptions } from '../services/parser/ParserService';

export interface ParseFileRequest {
  filePath: string;
  options?: ParseOptions;
}

export interface ParseFilesRequest {
  filePaths: string[];
  options?: ParseOptions;
}

export interface ASTQueryRequest {
  filePath: string;
  query: string;
}

export interface ASTSearchRequest {
  filePath: string;
  pattern: {
    type?: string;
    name?: string;
    contains?: string;
  };
}

export interface ASTCompareRequest {
  filePath1: string;
  filePath2: string;
}

export interface SupportedLanguagesResponse {
  languages: string[];
  count: number;
}

@injectable()
export class ParserController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private parserService: ParserService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ParserService) parserService: ParserService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.parserService = parserService;
  }

  /**
   * Parse a single file
   */
  async parseFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath, options }: ParseFileRequest = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Parsing file', { filePath, options });

      const result = await this.parserService.parseFile(filePath, options);

      res.json({
        success: true,
        data: {
          ...result,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'parseFile' }
      );
      next(error);
    }
  }

  /**
   * Parse multiple files
   */
  async parseFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePaths, options }: ParseFilesRequest = req.body;

      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        res.status(400).json({
          success: false,
          error: 'File paths array is required and cannot be empty'
        });
        return;
      }

      this.logger.info('Parsing multiple files', { fileCount: filePaths.length, options });

      const results = await this.parserService.parseFiles(filePaths, options);

      res.json({
        success: true,
        data: {
          results,
          totalFiles: filePaths.length,
          parsedFiles: results.length,
          failedFiles: filePaths.length - results.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to parse files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'parseFiles' }
      );
      next(error);
    }
  }

  /**
   * Extract functions from a file
   */
  async extractFunctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Extracting functions from file', { filePath });

      const functions = await this.parserService.extractFunctions(filePath);

      res.json({
        success: true,
        data: {
          filePath,
          functions,
          count: functions.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to extract functions: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'extractFunctions' }
      );
      next(error);
    }
  }

  /**
   * Extract classes from a file
   */
  async extractClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Extracting classes from file', { filePath });

      const classes = await this.parserService.extractClasses(filePath);

      res.json({
        success: true,
        data: {
          filePath,
          classes,
          count: classes.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to extract classes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'extractClasses' }
      );
      next(error);
    }
  }

  /**
   * Extract imports from a file
   */
  async extractImports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Extracting imports from file', { filePath });

      const imports = await this.parserService.extractImports(filePath);

      res.json({
        success: true,
        data: {
          filePath,
          imports,
          count: imports.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to extract imports: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'extractImports' }
      );
      next(error);
    }
  }

  /**
   * Validate file syntax
   */
  async validateSyntax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Validating syntax', { filePath });

      const result = await this.parserService.validateSyntax(filePath);

      res.json({
        success: true,
        data: {
          filePath,
          ...result,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to validate syntax: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'validateSyntax' }
      );
      next(error);
    }
  }

  /**
   * Query AST nodes
   */
  async queryAST(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath, query }: ASTQueryRequest = req.body;

      if (!filePath || !query) {
        res.status(400).json({
          success: false,
          error: 'File path and query are required'
        });
        return;
      }

      this.logger.info('Querying AST', { filePath, query });

      const nodes = await this.parserService.queryAST(filePath, query);

      res.json({
        success: true,
        data: {
          filePath,
          query,
          nodes,
          count: nodes.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to query AST: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'queryAST' }
      );
      next(error);
    }
  }

  /**
   * Get AST summary
   */
  async getASTSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Getting AST summary', { filePath });

      const summary = await this.parserService.getASTSummary(filePath);

      res.json({
        success: true,
        data: {
          ...summary,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get AST summary: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'getASTSummary' }
      );
      next(error);
    }
  }

  /**
   * Compare two ASTs
   */
  async compareASTs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath1, filePath2 }: ASTCompareRequest = req.body;

      if (!filePath1 || !filePath2) {
        res.status(400).json({
          success: false,
          error: 'Both file paths are required'
        });
        return;
      }

      this.logger.info('Comparing ASTs', { filePath1, filePath2 });

      const result = await this.parserService.compareASTs(filePath1, filePath2);

      res.json({
        success: true,
        data: {
          ...result,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to compare ASTs: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'compareASTs' }
      );
      next(error);
    }
  }

  /**
   * Search in AST
   */
  async searchInAST(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath, pattern }: ASTSearchRequest = req.body;

      if (!filePath || !pattern) {
        res.status(400).json({
          success: false,
          error: 'File path and search pattern are required'
        });
        return;
      }

      this.logger.info('Searching in AST', { filePath, pattern });

      const nodes = await this.parserService.searchInAST(filePath, pattern);

      res.json({
        success: true,
        data: {
          filePath,
          pattern,
          nodes,
          count: nodes.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to search in AST: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'searchInAST' }
      );
      next(error);
    }
  }

  /**
   * Get language statistics
   */
  async getLanguageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePaths } = req.body;

      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        res.status(400).json({
          success: false,
          error: 'File paths array is required and cannot be empty'
        });
        return;
      }

      this.logger.info('Getting language statistics', { fileCount: filePaths.length });

      const stats = await this.parserService.getLanguageStats(filePaths);

      res.json({
        success: true,
        data: {
          stats,
          totalFiles: filePaths.length,
          languages: Object.keys(stats),
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get language statistics: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'getLanguageStats' }
      );
      next(error);
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Getting supported languages');

      const languages = this.parserService.getSupportedLanguages();

      const response: SupportedLanguagesResponse = {
        languages,
        count: languages.length
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date()
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get supported languages: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'getSupportedLanguages' }
      );
      next(error);
    }
  }

  /**
   * Detect language from file path
   */
  async detectLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        });
        return;
      }

      this.logger.info('Detecting language', { filePath });

      // Use private method, we need to expose it or create a public one
      const language = this.detectLanguageFromFile(filePath);

      res.json({
        success: true,
        data: {
          filePath,
          language,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to detect language: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ParserController', operation: 'detectLanguage' }
      );
      next(error);
    }
  }

  /**
   * Helper method to detect language (duplicate of private method in ParserService)
   */
  private detectLanguageFromFile(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sh: 'shell',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      sql: 'sql',
    };

    return languageMap[ext || ''] || 'unknown';
  }
}