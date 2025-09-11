import Parser from 'tree-sitter';
import { AbstractSnippetRule } from './AbstractSnippetRule';
import { SnippetChunk } from '../types';

export class FunctionCallChainRule extends AbstractSnippetRule {
  readonly name = 'FunctionCallChainRule';
  readonly supportedNodeTypes = new Set(['call_expression', 'expression_statement']);
  protected readonly snippetType = 'function_call_chain' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;
    
    // Ensure meaningful function call chains (not just simple calls)
    return this.isMeaningfulFunctionCallChain(node, sourceCode);
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

  private isMeaningfulFunctionCallChain(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    
    // Should be more than just a simple function call
    // Look for chains, async calls, or complex expressions
    return content.length > 15 && 
           (content.includes('.') || content.includes(',') || 
            content.includes('await') || content.includes('=>'));
  }
}