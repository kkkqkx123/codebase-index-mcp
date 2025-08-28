import { TreeSitterService, CodeChunk, ParseResult } from './TreeSitterService';
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
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
}

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
      minChunkSize: options?.minChunkSize ?? 100
    };
  }

  async parseFile(filePath: string, content: string, options?: ChunkingOptions): Promise<ParsedFile> {
    const startTime = Date.now();
    const hash = this.generateHash(content);
    
    const parseResult = await this.treeSitterService.parseFile(filePath, content);
    
    if (!parseResult.success) {
      throw new Error(`Failed to parse file ${filePath}: ${parseResult.error}`);
    }

    const chunks = await this.createSyntaxAwareChunks(content, parseResult, options);
    
    const functions = this.treeSitterService.extractFunctions(parseResult.ast);
    const classes = this.treeSitterService.extractClasses(parseResult.ast);
    const imports = this.treeSitterService.extractImports(parseResult.ast);
    const exports = this.treeSitterService.extractExports(parseResult.ast);

    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim().length > 0).length;

    const parsedFile: ParsedFile = {
      id: this.generateFileId(filePath, hash),
      filePath,
      relativePath: path.relative(process.cwd(), filePath),
      language: parseResult.language.name.toLowerCase(),
      content,
      chunks,
      hash,
      size: content.length,
      parseTime: Date.now() - startTime,
      metadata: {
        functions: functions.length,
        classes: classes.length,
        imports,
        exports,
        linesOfCode
      }
    };

    return parsedFile;
  }

  private async createSyntaxAwareChunks(
    content: string, 
    parseResult: ParseResult, 
    options?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const chunkingOptions = { ...this.defaultOptions, ...options };
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    if (chunkingOptions.preserveFunctionBoundaries || chunkingOptions.preserveClassBoundaries) {
      const functionChunks = this.createFunctionChunks(content, parseResult, chunkingOptions);
      const classChunks = this.createClassChunks(content, parseResult, chunkingOptions);
      
      chunks.push(...functionChunks, ...classChunks);
    }

    if (chunks.length === 0) {
      const genericChunks = this.createGenericChunks(content, chunkingOptions);
      chunks.push(...genericChunks);
    }

    return this.enrichChunks(chunks, parseResult);
  }

  private createFunctionChunks(content: string, parseResult: ParseResult, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const functions = this.treeSitterService.extractFunctions(parseResult.ast);

    for (const func of functions) {
      const funcContent = this.treeSitterService.getNodeText(func, content);
      const location = this.treeSitterService.getNodeLocation(func);
      
      if (funcContent.length > options.minChunkSize) {
        const chunk: CodeChunk = {
          id: this.generateChunkId(funcContent, location.startLine),
          content: funcContent,
          startLine: location.startLine,
          endLine: location.endLine,
          startByte: func.startIndex,
          endByte: func.endIndex,
          type: 'function',
          functionName: this.extractFunctionName(func, content),
          imports: this.treeSitterService.extractImports(func),
          exports: this.treeSitterService.extractExports(func),
          metadata: {
            complexity: this.calculateComplexity(funcContent),
            parameters: this.extractParameters(func, content),
            returnType: this.extractReturnType(func, content)
          }
        };
        
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private createClassChunks(content: string, parseResult: ParseResult, options: Required<ChunkingOptions>): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const classes = this.treeSitterService.extractClasses(parseResult.ast);

    for (const cls of classes) {
      const clsContent = this.treeSitterService.getNodeText(cls, content);
      const location = this.treeSitterService.getNodeLocation(cls);
      
      if (clsContent.length > options.minChunkSize) {
        const chunk: CodeChunk = {
          id: this.generateChunkId(clsContent, location.startLine),
          content: clsContent,
          startLine: location.startLine,
          endLine: location.endLine,
          startByte: cls.startIndex,
          endByte: cls.endIndex,
          type: 'class',
          className: this.extractClassName(cls, content),
          imports: this.treeSitterService.extractImports(cls),
          exports: this.treeSitterService.extractExports(cls),
          metadata: {
            methods: this.extractMethods(cls, content).length,
            properties: this.extractProperties(cls, content).length,
            inheritance: this.extractInheritance(cls, content)
          }
        };
        
        chunks.push(chunk);
      }
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
              lineCount: currentChunk.length
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
    return chunks.map(chunk => ({
      ...chunk,
      imports: this.treeSitterService.extractImports(parseResult.ast),
      exports: this.treeSitterService.extractExports(parseResult.ast)
    }));
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