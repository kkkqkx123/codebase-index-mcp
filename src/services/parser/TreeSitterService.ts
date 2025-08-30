import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';
import Cpp from 'tree-sitter-cpp';

export interface ParserLanguage {
  name: string;
  parser: Parser;
  fileExtensions: string[];
  supported: boolean;
}

export interface ParseResult {
  ast: Parser.SyntaxNode;
  language: ParserLanguage;
  parseTime: number;
  success: boolean;
  error?: string;
}

export interface CodeChunk {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  type: string;
  functionName?: string;
  className?: string;
  imports: string[];
  exports: string[];
  metadata: Record<string, any>;
}

export interface SnippetMetadata {
  snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block';
  contextInfo: {
    parentFunction?: string;
    parentClass?: string;
    nestingLevel: number;
    surroundingCode?: string;
  };
  languageFeatures: {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  };
  complexity: number;
  isStandalone: boolean;
  hasSideEffects: boolean;
  commentMarkers?: string[];
}

export interface SnippetChunk extends CodeChunk {
  type: 'snippet';
  snippetMetadata: SnippetMetadata;
}

export class TreeSitterService {
  private parsers: Map<string, ParserLanguage> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    try {
      // For now, let's simplify and just create a basic structure
      // We'll need to properly implement this with correct imports later
      this.parsers.set('typescript', {
        name: 'TypeScript',
        parser: new Parser(),
        fileExtensions: ['.ts', '.tsx'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('javascript', {
        name: 'JavaScript',
        parser: new Parser(),
        fileExtensions: ['.js', '.jsx'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('python', {
        name: 'Python',
        parser: new Parser(),
        fileExtensions: ['.py'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('java', {
        name: 'Java',
        parser: new Parser(),
        fileExtensions: ['.java'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('go', {
        name: 'Go',
        parser: new Parser(),
        fileExtensions: ['.go'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('rust', {
        name: 'Rust',
        parser: new Parser(),
        fileExtensions: ['.rs'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('cpp', {
        name: 'C++',
        parser: new Parser(),
        fileExtensions: ['.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.parsers.set('c', {
        name: 'C',
        parser: new Parser(),
        fileExtensions: ['.c', '.h'],
        supported: false // Mark as not supported until we fix the imports
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tree-sitter parsers:', error);
      this.initialized = false;
    }
  }

  getSupportedLanguages(): ParserLanguage[] {
    return Array.from(this.parsers.values()).filter(lang => lang.supported);
  }

  detectLanguage(filePath: string): ParserLanguage | null {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    
    for (const lang of this.parsers.values()) {
      if (lang.fileExtensions.includes(ext) && lang.supported) {
        return lang;
      }
    }
    
    return null;
  }

  async parseCode(code: string, language: string): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      const parserLang = this.parsers.get(language.toLowerCase());
      if (!parserLang || !parserLang.supported) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const parser = parserLang.parser;
      const ast = parser.parse(code);

      return {
        ast: ast.rootNode,
        language: parserLang,
        parseTime: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      return {
        ast: {} as Parser.SyntaxNode,
        language: this.parsers.get(language.toLowerCase()) || { name: language, parser: new Parser(), fileExtensions: [], supported: false },
        parseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const language = this.detectLanguage(filePath);
    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    return this.parseCode(content, language.name.toLowerCase());
  }

  extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const functions: Parser.SyntaxNode[] = [];
    
    // For now, return empty array as we need to implement proper query logic
    // This would require implementing Tree-sitter queries properly
    return functions;
  }

  extractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const classes: Parser.SyntaxNode[] = [];
    
    // For now, return empty array as we need to implement proper query logic
    // This would require implementing Tree-sitter queries properly
    return classes;
  }

  extractImports(ast: Parser.SyntaxNode): string[] {
    const imports: string[] = [];
    
    // For now, return empty array as we need to implement proper query logic
    // This would require implementing Tree-sitter queries properly
    return imports;
  }

  extractExports(ast: Parser.SyntaxNode): string[] {
    const exports: string[] = [];
    
    // For now, return empty array as we need to implement proper query logic
    // This would require implementing Tree-sitter queries properly
    return exports;
  }

  // Snippet extraction methods
  extractSnippets(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    
    // Extract different types of snippets
    const controlStructures = this.extractControlStructures(ast, sourceCode);
    const errorHandlers = this.extractErrorHandling(ast, sourceCode);
    const functionCallChains = this.extractFunctionCallChains(ast, sourceCode);
    const commentMarkedSnippets = this.extractCommentMarkedSnippets(ast, sourceCode);
    const logicBlocks = this.extractLogicBlocks(ast, sourceCode);
    
    snippets.push(...controlStructures, ...errorHandlers, ...functionCallChains, ...commentMarkedSnippets, ...logicBlocks);
    
    // Filter and deduplicate snippets
    return this.filterAndDeduplicateSnippets(snippets);
  }

  private extractControlStructures(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    const controlStructureTypes = [
      'if_statement', 'else_clause', 'for_statement', 'while_statement', 
      'do_statement', 'switch_statement', 'try_statement', 'catch_clause', 'finally_clause'
    ];

    const findControlStructures = (node: Parser.SyntaxNode, nestingLevel: number = 0) => {
      if (controlStructureTypes.includes(node.type)) {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'control_structure', nestingLevel);
        if (snippet) {
          snippets.push(snippet);
        }
      }

      // Recursively search child nodes
      for (const child of node.children) {
        findControlStructures(child, nestingLevel + 1);
      }
    };

    findControlStructures(ast);
    return snippets;
  }

  private extractErrorHandling(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    const errorHandlingTypes = ['try_statement', 'catch_clause', 'finally_clause', 'throw_statement'];

    const findErrorHandling = (node: Parser.SyntaxNode, nestingLevel: number = 0) => {
      if (errorHandlingTypes.includes(node.type)) {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'error_handling', nestingLevel);
        if (snippet) {
          snippets.push(snippet);
        }
      }

      for (const child of node.children) {
        findErrorHandling(child, nestingLevel + 1);
      }
    };

    findErrorHandling(ast);
    return snippets;
  }

  private extractFunctionCallChains(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    
    const findFunctionCallChains = (node: Parser.SyntaxNode, nestingLevel: number = 0) => {
      // Look for call expressions or sequences of expressions
      if (node.type === 'call_expression' || node.type === 'expression_statement') {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'function_call_chain', nestingLevel);
        if (snippet && this.isMeaningfulFunctionCallChain(node, sourceCode)) {
          snippets.push(snippet);
        }
      }

      for (const child of node.children) {
        findFunctionCallChains(child, nestingLevel + 1);
      }
    };

    findFunctionCallChains(ast);
    return snippets;
  }

  private extractCommentMarkedSnippets(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    const lines = sourceCode.split('\n');
    
    // Look for comment markers like @snippet, SNIPPET, etc.
    const snippetMarkers = ['@snippet', '@code', '@example', 'SNIPPET:', 'EXAMPLE:'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const hasMarker = snippetMarkers.some(marker => line.includes(marker));
      
      if (hasMarker) {
        // Find the code block following the marker
        const snippetLines = this.extractCodeBlockAfterMarker(lines, i + 1);
        if (snippetLines.length > 0) {
          const snippetContent = snippetLines.join('\n');
          const startLine = i + 1;
          const endLine = i + snippetLines.length;
          
          const snippet: SnippetChunk = {
            id: this.generateSnippetId(snippetContent, startLine),
            content: snippetContent,
            startLine,
            endLine,
            startByte: sourceCode.indexOf(snippetContent),
            endByte: sourceCode.indexOf(snippetContent) + snippetContent.length,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'comment_marked',
              contextInfo: {
                nestingLevel: 0,
                surroundingCode: this.getSurroundingCode(lines, startLine, endLine)
              },
              languageFeatures: this.analyzeLanguageFeatures(snippetContent),
              complexity: this.calculateComplexity(snippetContent),
              isStandalone: true,
              hasSideEffects: this.hasSideEffects(snippetContent),
              commentMarkers: [line]
            }
          };
          
          snippets.push(snippet);
        }
      }
    }
    
    return snippets;
  }

  private extractLogicBlocks(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];
    
    const findLogicBlocks = (node: Parser.SyntaxNode, nestingLevel: number = 0) => {
      // Look for block statements or statement lists that represent logical units
      if (node.type === 'block' || node.type === 'statement_block') {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'logic_block', nestingLevel);
        if (snippet && this.isMeaningfulLogicBlock(node, sourceCode)) {
          snippets.push(snippet);
        }
      }

      for (const child of node.children) {
        findLogicBlocks(child, nestingLevel + 1);
      }
    };

    findLogicBlocks(ast);
    return snippets;
  }

  private createSnippetFromNode(
    node: Parser.SyntaxNode, 
    sourceCode: string, 
    snippetType: SnippetMetadata['snippetType'],
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    
    // Basic validation
    if (!this.isValidSnippet(content, snippetType)) {
      return null;
    }

    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    
    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: this.isStandaloneSnippet(content, snippetType),
        hasSideEffects: this.hasSideEffects(content)
      }
    };
  }

  private isValidSnippet(content: string, snippetType: SnippetMetadata['snippetType']): boolean {
    // Minimum length check
    if (content.length < 10) return false;
    
    // Maximum length check to avoid overly large snippets
    if (content.length > 1000) return false;
    
    // Check for meaningful content (not just braces or whitespace)
    const meaningfulContent = content.replace(/[{}[\]()\s;]/g, '');
    if (meaningfulContent.length < 5) return false;
    
    // Type-specific validation
    switch (snippetType) {
      case 'control_structure':
        return /(?:if|for|while|switch|try|catch|finally)\b/.test(content);
      case 'error_handling':
        return /(?:try|catch|throw|finally)\b/.test(content);
      case 'function_call_chain':
        return /\w+\(/.test(content);
      case 'logic_block':
        return content.includes(';') || content.includes('{');
      default:
        return true;
    }
  }

  private extractContextInfo(
    node: Parser.SyntaxNode, 
    sourceCode: string, 
    nestingLevel: number
  ): SnippetMetadata['contextInfo'] {
    const contextInfo: SnippetMetadata['contextInfo'] = {
      nestingLevel
    };

    // Find parent function
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'function_declaration' || parent.type === 'function_definition' || 
          parent.type === 'method_definition' || parent.type === 'arrow_function') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentFunction = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
    }

    // Find parent class
    parent = node.parent;
    while (parent) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentClass = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
    }

    return contextInfo;
  }

  private analyzeLanguageFeatures(content: string): SnippetMetadata['languageFeatures'] {
    return {
      usesAsync: /\basync\b/.test(content) && /\bawait\b/.test(content),
      usesGenerators: /\bfunction\*\b/.test(content) || /\byield\b/.test(content),
      usesDestructuring: /[{[]\s*\w+/.test(content) || /=\s*[{[]/.test(content),
      usesSpread: /\.\.\./.test(content),
      usesTemplateLiterals: /`.*\$\{.*\}`/.test(content)
    };
  }

  private calculateComplexity(content: string): number {
    let complexity = 1;
    
    // Count control structures
    const controlStructures = content.match(/\b(?:if|else|for|while|switch|case|try|catch|finally)\b/g);
    complexity += controlStructures ? controlStructures.length : 0;
    
    // Count logical operators
    const logicalOps = content.match(/&&|\|\|/g);
    complexity += logicalOps ? logicalOps.length : 0;
    
    // Count nested brackets
    const brackets = content.match(/[{}[\]()]/g);
    complexity += brackets ? brackets.length * 0.5 : 0;
    
    // Count function calls
    const functionCalls = content.match(/\w+\s*\(/g);
    complexity += functionCalls ? functionCalls.length * 0.3 : 0;
    
    return Math.round(complexity);
  }

  private isStandaloneSnippet(content: string, snippetType: SnippetMetadata['snippetType']): boolean {
    // Check if the snippet can exist independently
    switch (snippetType) {
      case 'control_structure':
      case 'error_handling':
        return content.includes('{') || content.includes(';');
      case 'function_call_chain':
        return content.endsWith(')');
      case 'logic_block':
        return true;
      default:
        return false;
    }
  }

  private hasSideEffects(content: string): boolean {
    // Check for common side-effect patterns
    const sideEffectPatterns = [
      /\w+\s*=/, // Assignment
      /\+\+|--/,  // Increment/decrement
      /\b(?:delete|new|throw)\b/, // Delete, new, throw
      /\.\w+\s*=/, // Property assignment
      /\b(?:console\.log|process\.exit|process\.kill)\b/ // External calls
    ];
    
    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  private isMeaningfulFunctionCallChain(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    // Should be more than just a simple function call
    return content.length > 15 && (content.includes('.') || content.includes(','));
  }

  private isMeaningfulLogicBlock(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    // Should contain multiple statements or complex logic
    const statements = content.split(';').filter(s => s.trim().length > 0);
    return statements.length >= 2 || content.length > 50;
  }

  private extractCodeBlockAfterMarker(lines: string[], startLine: number): string[] {
    const snippetLines: string[] = [];
    let indentLevel = null;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        continue;
      }
      
      // Determine indentation level from first non-empty line
      if (indentLevel === null) {
        indentLevel = line.length - line.trimStart().length;
      }
      
      // Stop if we encounter a line with less indentation (end of block)
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent < indentLevel && trimmedLine.length > 0) {
        break;
      }
      
      snippetLines.push(line);
    }
    
    return snippetLines;
  }

  private getSurroundingCode(lines: string[], startLine: number, endLine: number): string {
    const contextLines = 2;
    const surroundingLines = [];
    
    // Add lines before
    for (let i = Math.max(0, startLine - contextLines); i < startLine; i++) {
      surroundingLines.push(lines[i]);
    }
    
    // Add lines after
    for (let i = endLine; i < Math.min(lines.length, endLine + contextLines); i++) {
      surroundingLines.push(lines[i]);
    }
    
    return surroundingLines.join('\n');
  }

  private generateSnippetId(content: string, startLine: number): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  private filterAndDeduplicateSnippets(snippets: SnippetChunk[]): SnippetChunk[] {
    const filtered: SnippetChunk[] = [];
    const seen = new Set<string>();
    
    for (const snippet of snippets) {
      // Filter by complexity and quality
      if (snippet.snippetMetadata.complexity < 1 || snippet.snippetMetadata.complexity > 10) {
        continue;
      }
      
      // Filter by length
      if (snippet.content.length < 20 || snippet.content.length > 500) {
        continue;
      }
      
      // Deduplication by content hash
      const contentHash = require('crypto').createHash('md5').update(snippet.content).digest('hex');
      if (seen.has(contentHash)) {
        continue;
      }
      
      seen.add(contentHash);
      filtered.push(snippet);
    }
    
    return filtered;
  }

  getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  getNodeLocation(node: Parser.SyntaxNode): { startLine: number; endLine: number; startColumn: number; endColumn: number } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    // For now, return empty array as we need to implement proper query logic
    // This would require implementing Tree-sitter queries properly
    return nodes;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}