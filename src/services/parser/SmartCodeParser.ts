import { injectable } from 'inversify';
import { TreeSitterService, CodeChunk, ParseResult, SnippetChunk } from './TreeSitterService';
import { createHash } from 'crypto';
import path from 'path';

export interface ParsedFile {
  id: string;
  filePath: string;
  relativePath: string;
  language: string;
  content: string;
  chunks: CodeChunk[];
  hash: string;
  size: number;
  parseTime: number;
  metadata: {
    functions: number;
    classes: number;
    imports: string[];
    exports: string[];
    linesOfCode: number;
    snippets: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
}

@injectable()
export class SmartCodeParser {
  private treeSitterService: TreeSitterService;
  private defaultOptions: Required<ChunkingOptions>;

  constructor(treeSitterService: TreeSitterService, options?: ChunkingOptions) {
    this.treeSitterService = treeSitterService;
    this.defaultOptions = {
      maxChunkSize: options?.maxChunkSize ?? 1000,
      overlapSize: options?.overlapSize ?? 200,
      preserveFunctionBoundaries: options?.preserveFunctionBoundaries ?? true,
      preserveClassBoundaries: options?.preserveClassBoundaries ?? true,
      includeComments: options?.includeComments ?? false,
      minChunkSize: options?.minChunkSize ?? 100,
      extractSnippets: options?.extractSnippets ?? true
    };
  }

  async parseFile(filePath: string, content: string, options?: ChunkingOptions): Promise<ParsedFile> {
    const startTime = Date.now();
    const hash = this.generateHash(content);
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim().length > 0).length;
    
    let language = 'unknown';
    let snippetCount = 0;
    
    // Try to parse with TreeSitterService if available
    try {
      const parseResult = await this.treeSitterService.parseFile(filePath, content);
      language = parseResult.language.name.toLowerCase();
      
      if (parseResult.success) {
        // Extract syntax-aware chunks
        const syntaxAwareChunks = await this.createSyntaxAwareChunks(content, parseResult, mergedOptions);
        chunks.push(...syntaxAwareChunks);
        
        // Extract snippets if enabled
        if (mergedOptions.extractSnippets) {
          const snippets = this.treeSitterService.extractSnippets(parseResult.ast, content);
          chunks.push(...snippets);
          snippetCount = snippets.length;
        }
      }
    } catch (error) {
      // Fall back to generic chunking if TreeSitterService fails
      console.warn('TreeSitterService failed, falling back to generic chunking:', error);
    }
    
    // If no chunks were created, use generic chunking
    if (chunks.length === 0) {
      const genericChunks = this.createGenericChunks(content, mergedOptions);
      chunks.push(...genericChunks);
    }

    const parsedFile: ParsedFile = {
      id: this.generateFileId(filePath, hash),
      filePath,
      relativePath: path.relative(process.cwd(), filePath),
      language,
      content,
      chunks,
      hash,
      size: content.length,
      parseTime: Date.now() - startTime,
      metadata: {
        functions: 0,
        classes: 0,
        imports: [],
        exports: [],
        linesOfCode,
        snippets: snippetCount
      }
    };

    return parsedFile;
  }

  private async createSyntaxAwareChunks(
    content: string,
    parseResult: ParseResult,
    options: Required<ChunkingOptions>
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    
    // Extract function chunks
    if (options.preserveFunctionBoundaries) {
      const functionChunks = this.createFunctionChunks(content, parseResult, options);
      chunks.push(...functionChunks);
    }
    
    // Extract class chunks
    if (options.preserveClassBoundaries) {
      const classChunks = this.createClassChunks(content, parseResult, options);
      chunks.push(...classChunks);
    }
    
    return chunks;
  }

  private createFunctionChunks(content: string, parseResult: ParseResult, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const functions = this.treeSitterService.extractFunctions(parseResult.ast);
    
    for (const funcNode of functions) {
      const funcContent = this.treeSitterService.getNodeText(funcNode, content);
      const location = this.treeSitterService.getNodeLocation(funcNode);
      
      const chunk: CodeChunk = {
        id: this.generateChunkId(funcContent, location.startLine),
        content: funcContent,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: funcNode.startIndex,
        endByte: funcNode.endIndex,
        type: 'function',
        functionName: this.extractFunctionName(funcNode, content),
        imports: [],
        exports: [],
        metadata: {
          parameters: this.extractParameters(funcNode, content),
          returnType: this.extractReturnType(funcNode, content),
          complexity: this.calculateComplexity(funcContent)
        }
      };
      
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private createClassChunks(content: string, parseResult: ParseResult, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const classes = this.treeSitterService.extractClasses(parseResult.ast);
    
    for (const classNode of classes) {
      const classContent = this.treeSitterService.getNodeText(classNode, content);
      const location = this.treeSitterService.getNodeLocation(classNode);
      
      const chunk: CodeChunk = {
        id: this.generateChunkId(classContent, location.startLine),
        content: classContent,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: classNode.startIndex,
        endByte: classNode.endIndex,
        type: 'class',
        className: this.extractClassName(classNode, content),
        imports: [],
        exports: [],
        metadata: {
          methods: this.extractMethods(classNode, content).length,
          properties: this.extractProperties(classNode, content).length,
          inheritance: this.extractInheritance(classNode, content),
          complexity: this.calculateComplexity(classContent)
        }
      };
      
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private createGenericChunks(content: string, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      if (currentChunk.join('\n').length >= options.maxChunkSize || i === lines.length - 1) {
        const chunkContent = currentChunk.join('\n');
        
        if (chunkContent.length >= options.minChunkSize) {
          const chunk: CodeChunk = {
            id: this.generateChunkId(chunkContent, currentLine),
            content: chunkContent,
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            startByte: content.indexOf(chunkContent),
            endByte: content.indexOf(chunkContent) + chunkContent.length,
            type: 'generic',
            imports: [],
            exports: [],
            metadata: {
              lineCount: currentChunk.length,
              complexity: this.calculateComplexity(chunkContent)
            }
          };
          
          chunks.push(chunk);
        }

        currentChunk = [];
        currentLine = i + 1;
      }
    }

    return chunks;
  }

  private enrichChunks(chunks: CodeChunk[], parseResult: ParseResult): CodeChunk[] {
    // Enrich chunks with additional metadata from the parse result
    return chunks.map(chunk => {
      // Add imports and exports if available
      if (chunk.type === 'function' || chunk.type === 'class') {
        return {
          ...chunk,
          imports: this.treeSitterService.extractImports(parseResult.ast),
          exports: this.treeSitterService.extractExports(parseResult.ast)
        };
      }
      return chunk;
    });
  }

  private extractFunctionName(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.treeSitterService.getNodeText(nameNode, content) : 'anonymous';
  }

  private extractClassName(node: any, content: string): string {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.treeSitterService.getNodeText(nameNode, content) : 'anonymous';
  }

  private extractParameters(node: any, content: string): string[] {
    const paramsNode = node.childForFieldName('parameters');
    if (!paramsNode) return [];
    
    const params: string[] = [];
    for (const child of paramsNode.children) {
      if (child.type === 'identifier' || child.type === 'parameter') {
        params.push(this.treeSitterService.getNodeText(child, content));
      }
    }
    return params;
  }

  private extractReturnType(node: any, content: string): string {
    const typeNode = node.childForFieldName('return_type');
    return typeNode ? this.treeSitterService.getNodeText(typeNode, content) : 'unknown';
  }

  private extractMethods(node: any, content: string): any[] {
    return this.treeSitterService.findNodeByType(node, 'method_definition');
  }

  private extractProperties(node: any, content: string): any[] {
    return this.treeSitterService.findNodeByType(node, 'property_declaration');
  }

  private extractInheritance(node: any, content: string): string[] {
    const inheritance: string[] = [];
    const extendsNode = node.childForFieldName('extends');
    const implementsNode = node.childForFieldName('implements');
    
    if (extendsNode) {
      inheritance.push(this.treeSitterService.getNodeText(extendsNode, content));
    }
    
    if (implementsNode) {
      inheritance.push(this.treeSitterService.getNodeText(implementsNode, content));
    }
    
    return inheritance;
  }

  private calculateComplexity(code: string): number {
    const complexityIndicators = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\btry\b/g,
      /\bcatch\b/g,
      /\?\./g,
      /\|\|/g,
      /&&/g
    ];

    let complexity = 1;
    for (const indicator of complexityIndicators) {
      const matches = code.match(indicator);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private generateFileId(filePath: string, hash: string): string {
    return `file_${createHash('md5').update(filePath).digest('hex').substring(0, 8)}_${hash.substring(0, 8)}`;
  }

  private generateChunkId(content: string, startLine: number): string {
    return `chunk_${startLine}_${createHash('md5').update(content).digest('hex').substring(0, 8)}`;
  }
}