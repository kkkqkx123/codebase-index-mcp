import Parser from 'tree-sitter';
import { SnippetExtractionRule } from './SnippetExtractionRule';
import { SnippetChunk, SnippetMetadata } from '../types';

export class ErrorHandlingRule implements SnippetExtractionRule {
  name = 'ErrorHandlingRule';
  supportedNodeTypes = new Set(['try_statement', 'throw_statement']);

  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];

    const findErrorHandling = (node: Parser.SyntaxNode, nestingLevel: number = 0, depth: number = 0) => {
      // Limit traversal depth to prevent excessive recursion
      if (depth > 50) return;

      if (this.supportedNodeTypes.has(node.type)) {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'error_handling', nestingLevel);
        if (snippet) {
          snippets.push(snippet);
        }
      } else if (node.type === 'catch_clause' || node.type === 'finally_clause') {
        // For catch and finally clauses, we want to include the parent try statement
        // but we don't want to process them individually
        return;
      }

      // Traverse child nodes with proper depth tracking
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          findErrorHandling(child, nestingLevel + 1, depth + 1);
        }
      }
    };

    findErrorHandling(ast);
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

  private getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  private getNodeLocation(node: Parser.SyntaxNode): { startLine: number; endLine: number; startColumn: number; endColumn: number } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  private isValidSnippet(content: string, snippetType: SnippetMetadata['snippetType']): boolean {
    // Less restrictive minimum length check for testing
    if (content.length < 5) return false;

    // Less restrictive maximum length check for testing
    if (content.length > 1500) return false;

    // Check for meaningful content (not just braces or whitespace)
    const meaningfulContent = content.replace(/[{}[\]()\s;]/g, '');
    if (meaningfulContent.length < 3) return false;

    // Type-specific validation - less restrictive for testing
    switch (snippetType) {
      case 'error_handling':
        return /(?:try|catch|throw|finally)\b/.test(content);
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
    let depth = 0;
    while (parent && depth < 50) {
      if (parent.type === 'function_declaration' || parent.type === 'function_definition' ||
          parent.type === 'method_definition' || parent.type === 'arrow_function') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentFunction = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    // Find parent class
    parent = node.parent;
    depth = 0;
    while (parent && depth < 50) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          contextInfo.parentClass = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = node.parent;
      depth++;
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
      default:
        return false;
    }
  }

  private hasSideEffects(content: string): boolean {
    // Check for common side-effect patterns
    const sideEffectPatterns = [
      /\+\+|--/,  // Increment/decrement
      /\b(?:delete|new|throw)\b/, // Delete, new, throw
      /\.\w+\s*=/, // Property assignment
      /\b(?:console\.log|process\.exit|process\.kill)\b/ // External calls
    ];

    // Special handling for assignments - only consider property assignments or assignments to undeclared variables as side effects
    if (!sideEffectPatterns.some(pattern => pattern.test(content)) && /=/.test(content)) {
      // Check for property assignments (more specific than the general pattern)
      if (/\.\w+\s*=/.test(content)) {
        return true;
      }

      // Check for assignments that look like they might be to global variables
      // This is a heuristic - we can't know for sure without more context
      if (/\b(?:window|global|document|console|process|module|exports)\.\w+\s*=/.test(content)) {
        return true;
      }
    }

    return sideEffectPatterns.some(pattern => pattern.test(content));
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
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}