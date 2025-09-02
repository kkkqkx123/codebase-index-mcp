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
  snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment';
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