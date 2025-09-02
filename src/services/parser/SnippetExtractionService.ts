import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { SnippetChunk } from './types';
import { TreeSitterCoreService } from './TreeSitterCoreService';
import { TYPES } from '../../types';

export interface SnippetExtractionRule {
  name: string;
  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[];
  supportedNodeTypes: Set<string>;
}

@injectable()
export class SnippetExtractionService {
  private snippetMarkerRegex: RegExp;
  private snippetHashCache: Map<string, string> = new Map();

  constructor(
    @inject(TYPES.TreeSitterCoreService)
    private readonly coreService: TreeSitterCoreService,
    @inject(TYPES.SnippetExtractionRules)
    private readonly rules: SnippetExtractionRule[]
  ) {
    const snippetMarkers = ['@snippet', '@code', '@example', 'SNIPPET:', 'EXAMPLE:'];
    this.snippetMarkerRegex = new RegExp(snippetMarkers.map(marker => 
      marker.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&')).join('|')
    );
  }

  extractSnippets(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const allSnippets: SnippetChunk[] = [];

    for (const rule of this.rules) {
      try {
        const snippets = rule.extract(ast, sourceCode);
        allSnippets.push(...snippets);
      } catch (error) {
        console.error(`Error applying rule ${rule.name}:`, error);
      }
    }

    return this.filterAndDeduplicateSnippets(allSnippets);
  }

  createSnippetFromNode(
    node: Parser.SyntaxNode, 
    sourceCode: string, 
    snippetType: SnippetChunk['snippetMetadata']['snippetType'],
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.coreService.getNodeText(node, sourceCode);
    const location = this.coreService.getNodeLocation(node);
    
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

  private isValidSnippet(content: string, snippetType: SnippetChunk['snippetMetadata']['snippetType']): boolean {
    if (content.length < 5) return false;
    if (content.length > 1500) return false;
    
    const meaningfulContent = content.replace(/[{}[\]()\s;]/g, '');
    if (meaningfulContent.length < 3) return false;
    
    switch (snippetType) {
      case 'control_structure':
        return /(?:if|for|while|switch|try|catch|finally)\b/.test(content);
      case 'error_handling':
        return /(?:try|catch|throw|finally)\b/.test(content);
      case 'function_call_chain':
        return /\w+\(/.test(content);
      case 'logic_block':
        return content.includes(';') || content.includes('{') || content.includes('function');
      case 'comment_marked':
        return true;
      default:
        return true;
    }
  }

  private extractContextInfo(
    node: Parser.SyntaxNode, 
    sourceCode: string, 
    nestingLevel: number
  ): SnippetChunk['snippetMetadata']['contextInfo'] {
    const contextInfo: SnippetChunk['snippetMetadata']['contextInfo'] = {
      nestingLevel
    };

    let parent = node.parent;
    let depth = 0;
    while (parent && depth < 50) {
      if (parent.type === 'function_declaration' || parent.type === 'function_definition' ||
          parent.type === 'method_definition' || parent.type === 'arrow_function') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentFunction = this.coreService.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    parent = node.parent;
    depth = 0;
    while (parent && depth < 50) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentClass = this.coreService.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    return contextInfo;
  }

  private analyzeLanguageFeatures(content: string): SnippetChunk['snippetMetadata']['languageFeatures'] {
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
    
    const controlStructures = content.match(/\b(?:if|else|for|while|switch|case|try|catch|finally)\b/g);
    complexity += controlStructures ? controlStructures.length : 0;
    
    const logicalOps = content.match(/&&|\|\|/g);
    complexity += logicalOps ? logicalOps.length : 0;
    
    const brackets = content.match(/[{}[\]()]/g);
    complexity += brackets ? brackets.length * 0.5 : 0;
    
    const functionCalls = content.match(/\w+\s*\(/g);
    complexity += functionCalls ? functionCalls.length * 0.3 : 0;
    
    return Math.round(complexity);
  }

  private isStandaloneSnippet(content: string, snippetType: SnippetChunk['snippetMetadata']['snippetType']): boolean {
    switch (snippetType) {
      case 'control_structure':
      case 'error_handling':
        return content.includes('{') || content.includes(';');
      case 'function_call_chain':
        return content.endsWith(')');
      case 'expression_sequence':
        return content.includes(',');
      case 'logic_block':
        return true;
      default:
        return false;
    }
  }

  private hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\+\+|--/,
      /\b(?:delete|new|throw)\b/,
      /\.\w+\s*=/,
      /\b(?:console\.log|process\.exit|process\.kill)\b/
    ];
    
    const hasSideEffect = sideEffectPatterns.some(pattern => pattern.test(content));
    
    if (!hasSideEffect && /=/.test(content)) {
      if (/\.\w+\s*=/.test(content)) {
        return true;
      }
      
      if (/\b(?:window|global|document|console|process|module|exports)\.\w+\s*=/.test(content)) {
        return true;
      }
    }
    
    return hasSideEffect;
  }

  private generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private filterAndDeduplicateSnippets(snippets: SnippetChunk[]): SnippetChunk[] {
    const filtered: SnippetChunk[] = [];
    const seen = new Set<string>();
    
    for (const snippet of snippets) {
      if (snippet.snippetMetadata.complexity < 1 || snippet.snippetMetadata.complexity > 15) {
        continue;
      }
      
      if (snippet.content.length < 20 || snippet.content.length > 1000) {
        continue;
      }
      
      let contentHash = this.snippetHashCache.get(snippet.content);
      if (!contentHash) {
        contentHash = this.simpleHash(snippet.content);
        this.snippetHashCache.set(snippet.content, contentHash);
      }
      
      if (seen.has(contentHash)) {
        continue;
      }
      
      seen.add(contentHash);
      filtered.push(snippet);
    }
    
    if (this.snippetHashCache.size > 1000) {
      this.snippetHashCache.clear();
    }
    
    seen.clear();
    
    return filtered;
  }

  getSnippetMarkerRegex(): RegExp {
    return this.snippetMarkerRegex;
  }

  extractCodeBlockAfterMarker(lines: string[], startLine: number): string[] {
    const snippetLines: string[] = [];
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (i > startLine && this.snippetMarkerRegex.test(trimmedLine)) {
        break;
      }
      
      if (trimmedLine === '') {
        break;
      }
      
      snippetLines.push(line);
    }
    
    return snippetLines;
  }

  getSurroundingCode(lines: string[], startLine: number, endLine: number): string {
    const contextLines = 2;
    const surroundingLines = [];
    
    for (let i = Math.max(0, startLine - contextLines); i < startLine; i++) {
      surroundingLines.push(lines[i]);
    }
    
    for (let i = endLine; i < Math.min(lines.length, endLine + contextLines); i++) {
      surroundingLines.push(lines[i]);
    }
    
    return surroundingLines.join('\n');
  }
}