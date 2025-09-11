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
  snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment' | 'generic_pattern' | 'decorator_pattern' | 'async_pattern' | 'python_comprehension' | 'java_stream' | 'java_lambda' | 'functional_programming' | 'go_goroutine' | 'go_interface';
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
  // Extended properties for specific snippet types
  genericInfo?: {
    typeParameters: string[];
    constraints: string[];
    usesWildcards: boolean;
    genericPurpose?: string;
    nestingLevel: number;
  };
  decoratorInfo?: {
    decoratorCount: number;
    decoratorTypes: string[];
    hasClassDecorators: boolean;
    hasMethodDecorators: boolean;
    hasPropertyDecorators: boolean;
    decorators: string[];
    annotationTypes: string[];
    hasParameterizedDecorators: boolean;
    decoratorPurpose?: string;
  };
  asyncPattern?: string;
  comprehensionInfo?: {
    type: 'list' | 'dict' | 'set' | 'generator';
    conditions: number;
    loops: number;
    isNested: boolean;
    complexity: number;
  };
  javaStreamInfo?: {
    operations: string[];
    collectors: string[];
    usesParallelStream: boolean;
    usesMethodReferences: boolean;
    usesLambdas: boolean;
    chainingDepth: number;
    streamType?: 'sequential' | 'parallel';
    purpose?: string;
  };
  javaLambdaInfo?: {
    lambdaExpressions: string[];
    methodReferences: string[];
    functionalInterfaces: string[];
    lambdaParameters: number[];
    hasBlockBody: boolean;
    hasExpressionBody: boolean;
    purpose?: string;
  };
  goConcurrencyInfo?: {
    goroutines: number;
    channels: string[];
    usesSelect: boolean;
    usesWaitGroup: boolean;
    usesMutex: boolean;
    communicationPatterns: string[];
    purpose?: string;
  };
  goInterfaceInfo?: {
    interfaces: string[];
    embeddedInterfaces: string[];
    methodSignatures: string[];
    implementations: string[];
    usesEmptyInterface: boolean;
    interfaceSize: number;
    purpose?: string;
  };
  callChainInfo?: {
    chainLength: number;
    hasAsyncOperations: boolean;
    hasCallbacks: boolean;
    hasComplexArguments: boolean;
    callType?: 'simple' | 'chained' | 'async' | 'callback_based';
  };
  functionalInfo?: {
    usesArrowFunctions: boolean;
    usesFunctionComposition: boolean;
    usesHigherOrderFunctions: boolean;
    usesCurrying: boolean;
    usesRecursion: boolean;
    usesImmutability: boolean;
    complexity: number;
  };
}

export interface SnippetChunk extends CodeChunk {
  type: 'snippet';
  snippetMetadata: SnippetMetadata;
}