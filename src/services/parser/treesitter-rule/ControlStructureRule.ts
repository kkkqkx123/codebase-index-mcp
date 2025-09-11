import Parser from 'tree-sitter';
import { SnippetExtractionRule } from './SnippetExtractionRule';
import { SnippetChunk, SnippetMetadata } from '../types';
import { SnippetValidationService } from '../SnippetValidationService';

export class ControlStructureRule implements SnippetExtractionRule {
  name = 'ControlStructureRule';
  supportedNodeTypes = new Set([
    'if_statement', 'else_clause', 'for_statement', 'while_statement',
    'do_statement', 'switch_statement'
  ]);

  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];

    const findControlStructures = (node: Parser.SyntaxNode, nestingLevel: number = 0, depth: number = 0) => {
      // Limit traversal depth to prevent excessive recursion
      if (depth > 50) return;

      if (this.supportedNodeTypes.has(node.type)) {
        const snippet = this.createSnippetFromNode(node, sourceCode, 'control_structure', nestingLevel);
        if (snippet) {
          snippets.push(snippet);
        }
      }

      // Traverse child nodes with proper depth tracking
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          findControlStructures(child, nestingLevel + 1, depth + 1);
        }
      }
    };

    findControlStructures(ast);
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
    return SnippetValidationService.enhancedIsValidSnippet(content, snippetType);
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
      parent = parent.parent;
      depth++;
    }

    return contextInfo;
  }

  private analyzeLanguageFeatures(content: string): SnippetMetadata['languageFeatures'] {
    return SnippetValidationService.analyzeLanguageFeatures(content);
  }

  private calculateComplexity(content: string): number {
    return SnippetValidationService.calculateComplexity(content);
  }

  private isStandaloneSnippet(content: string, snippetType: SnippetMetadata['snippetType']): boolean {
    return SnippetValidationService.isStandaloneSnippet(content, snippetType);
  }

  private hasSideEffects(content: string): boolean {
    return SnippetValidationService.hasSideEffects(content);
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