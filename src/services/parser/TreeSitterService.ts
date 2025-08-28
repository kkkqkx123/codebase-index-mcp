import * as Parser from 'tree-sitter';
import * as TypeScript from 'tree-sitter-typescript';
import * as JavaScript from 'tree-sitter-javascript';
import * as Python from 'tree-sitter-python';
import * as Java from 'tree-sitter-java';
import * as Go from 'tree-sitter-go';
import * as Rust from 'tree-sitter-rust';
import * as Cpp from 'tree-sitter-cpp';

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

export class TreeSitterService {
  private parsers: Map<string, ParserLanguage> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    try {
      this.parsers.set('typescript', {
        name: 'TypeScript',
        parser: new Parser(),
        fileExtensions: ['.ts', '.tsx'],
        supported: true
      });

      this.parsers.set('javascript', {
        name: 'JavaScript',
        parser: new Parser(),
        fileExtensions: ['.js', '.jsx'],
        supported: true
      });

      this.parsers.set('python', {
        name: 'Python',
        parser: new Parser(),
        fileExtensions: ['.py'],
        supported: true
      });

      this.parsers.set('java', {
        name: 'Java',
        parser: new Parser(),
        fileExtensions: ['.java'],
        supported: true
      });

      this.parsers.set('go', {
        name: 'Go',
        parser: new Parser(),
        fileExtensions: ['.go'],
        supported: true
      });

      this.parsers.set('rust', {
        name: 'Rust',
        parser: new Parser(),
        fileExtensions: ['.rs'],
        supported: true
      });

      this.parsers.set('cpp', {
        name: 'C++',
        parser: new Parser(),
        fileExtensions: ['.cpp', '.cc', '.cxx', '.c++', '.h', '.hpp'],
        supported: true
      });

      this.parsers.set('c', {
        name: 'C',
        parser: new Parser(),
        fileExtensions: ['.c', '.h'],
        supported: true
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
      
      let languageModule: any;
      switch (language.toLowerCase()) {
        case 'typescript':
          languageModule = TypeScript;
          break;
        case 'javascript':
          languageModule = JavaScript;
          break;
        case 'python':
          languageModule = Python;
          break;
        case 'java':
          languageModule = Java;
          break;
        case 'go':
          languageModule = Go;
          break;
        case 'rust':
          languageModule = Rust;
          break;
        case 'cpp':
        case 'c':
          languageModule = Cpp;
          break;
        default:
          throw new Error(`Language module not found: ${language}`);
      }

      parser.setLanguage(languageModule);
      const ast = parser.parse(code);

      return {
        ast,
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
    
    const query = ast.tree.language.query(`
      (function_declaration) @function
      (method_definition) @function
      (arrow_function) @function
      (function_item) @function
    `);

    const captures = query.captures(ast.rootNode);
    for (const capture of captures) {
      functions.push(capture.node);
    }

    return functions;
  }

  extractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const classes: Parser.SyntaxNode[] = [];
    
    const query = ast.tree.language.query(`
      (class_declaration) @class
      (class_definition) @class
      (interface_declaration) @interface
    `);

    const captures = query.captures(ast.rootNode);
    for (const capture of captures) {
      classes.push(capture.node);
    }

    return classes;
  }

  extractImports(ast: Parser.SyntaxNode): string[] {
    const imports: string[] = [];
    
    const query = ast.tree.language.query(`
      (import_statement) @import
      (import_declaration) @import
      (require) @import
    `);

    const captures = query.captures(ast.rootNode);
    for (const capture of captures) {
      imports.push(capture.node.text);
    }

    return imports;
  }

  extractExports(ast: Parser.SyntaxNode): string[] {
    const exports: string[] = [];
    
    const query = ast.tree.language.query(`
      (export_statement) @export
      (export_declaration) @export
    `);

    const captures = query.captures(ast.rootNode);
    for (const capture of captures) {
      exports.push(capture.node.text);
    }

    return exports;
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
    
    const query = ast.tree.language.query(`(${type}) @node`);
    const captures = query.captures(ast.rootNode);
    
    for (const capture of captures) {
      nodes.push(capture.node);
    }

    return nodes;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}