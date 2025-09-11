import Parser from 'tree-sitter';
import { AbstractSnippetRule } from './AbstractSnippetRule';
import { SnippetChunk } from '../types';

export class ControlStructureRule extends AbstractSnippetRule {
  readonly name = 'ControlStructureRule';
  readonly supportedNodeTypes = new Set([
    'if_statement', 'else_clause', 'for_statement', 'while_statement',
    'do_statement', 'switch_statement'
  ]);
  protected readonly snippetType = 'control_structure' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;
    
    const content = this.getNodeText(node, sourceCode);
    
    // Filter out overly simple control structures (KISS principle)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines.length > 1 || content.length > 30;
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
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
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content)
      }
    };
  }
}