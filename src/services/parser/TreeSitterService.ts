import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { TreeSitterCoreService, ParserLanguage, ParseResult } from './TreeSitterCoreService';

// Re-export for backward compatibility
export type { ParserLanguage, ParseResult };
import { SnippetExtractionService } from './SnippetExtractionService';
import { CodeChunk, SnippetChunk } from './types';
import { TYPES } from '../../types';

@injectable()
export class TreeSitterService {
  constructor(
    @inject(TYPES.TreeSitterCoreService)
    private readonly coreService: TreeSitterCoreService,
    @inject(TYPES.SnippetExtractionService)
    private readonly snippetExtractionService: SnippetExtractionService
  ) {}

  getSupportedLanguages(): ParserLanguage[] {
    return this.coreService.getSupportedLanguages();
  }

  detectLanguage(filePath: string): ParserLanguage | null {
    return this.coreService.detectLanguage(filePath);
  }

  async parseCode(code: string, language: string): Promise<ParseResult> {
    return this.coreService.parseCode(code, language);
  }

  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    return this.coreService.parseFile(filePath, content);
  }

  extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return this.coreService.extractFunctions(ast);
  }

  extractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return this.coreService.extractClasses(ast);
  }

  extractImports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    return this.coreService.extractImports(ast, sourceCode);
  }

  extractExports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    return this.coreService.extractExports(ast, sourceCode);
  }

  extractSnippets(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    return this.snippetExtractionService.extractSnippets(ast, sourceCode);
  }

  isInitialized(): boolean {
    return this.coreService.isInitialized();
  }

  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return this.coreService.getNodeText(node, sourceCode);
  }

  getNodeLocation(node: Parser.SyntaxNode): { 
    startLine: number; 
    endLine: number; 
    startColumn: number; 
    endColumn: number 
  } {
    return this.coreService.getNodeLocation(node);
  }

  findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    return this.coreService.findNodeByType(ast, type);
  }

  queryTree(ast: Parser.SyntaxNode, pattern: string): Array<{ captures: Array<{ name: string; node: Parser.SyntaxNode }> }> {
    return this.coreService.queryTree(ast, pattern);
  }
}