# Framework-Specific Implementation Details

This document provides detailed implementation specifications for each framework rule, including patterns to detect, metadata to extract, and specific implementation considerations.

## React Framework Rule

### Detection Patterns

#### Import-Based Detection
```typescript
// React import patterns
const reactImportPatterns = [
  /import\s+React\s+from\s+['"]react['"]/,
  /import\s+\{\s*[a-zA-Z]+\s*\}\s+from\s+['"]react['"]/,
  /import\s+\{\s*[a-zA-Z]+\s*\}\s+from\s+['"]react\/[a-zA-Z]+['"]/
];

// Hook-specific imports
const hookImportPatterns = [
  /import\s+\{\s*useState\s*\}/,
  /import\s+\{\s*useEffect\s*\}/,
  /import\s+\{\s*useContext\s*\}/,
  /import\s+\{\s*useReducer\s*\}/,
  /import\s+\{\s*useCallback\s*\}/,
  /import\s+\{\s*useMemo\s*\}/
];
```

#### Component Pattern Detection
```typescript
// Functional component patterns
const functionalComponentPatterns = [
  /function\s+[A-Z][a-zA-Z0-9]*\s*\([^)]*\)\s*\{[^}]*return\s*<[^>]+>/,
  /const\s+[A-Z][a-zA-Z0-9]*\s*=\s*\([^)]*\)\s*=>\s*{[^}]*return\s*<[^>]+>/,
  /export\s+function\s+[A-Z][a-zA-Z0-9]*\s*\([^)]*\)/,
  /export\s+const\s+[A-Z][a-zA-Z0-9]*\s*=\s*\([^)]*\)\s*=>/
];

// Class component patterns
const classComponentPatterns = [
  /class\s+[A-Z][a-zA-Z0-9]*\s+extends\s+React\.Component/,
  /class\s+[A-Z][a-zA-Z0-9]*\s+extends\s+Component/,
  /class\s+[A-Z][a-zA-Z0-9]*\s+extends\s+React\.PureComponent/
];
```

#### Hook Pattern Detection
```typescript
// Hook usage patterns
const hookPatterns = {
  useState: /const\s*\[\s*[a-zA-Z_][a-zA-Z0-9_]*\s*,\s*set[a-zA-Z][a-zA-Z0-9_]*\s*\]\s*=\s*useState/,
  useEffect: /useEffect\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[[^]]*\]\s*\)/,
  useContext: /const\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*useContext\s*\([^)]+\)/,
  useReducer: /const\s*\[\s*state\s*,\s*dispatch\s*\]\s*=\s*useReducer\s*\([^)]+\)/,
  useCallback: /const\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*useCallback\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[[^]]*\]\s*\)/,
  useMemo: /const\s+[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*useMemo\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[[^]]*\]\s*\)/
};
```

### Metadata Extraction Schema

```typescript
interface ReactComponentMetadata {
  componentType: 'functional' | 'class';
  hooks: {
    useState: number;
    useEffect: number;
    useContext: number;
    useReducer: number;
    useCallback: number;
    useMemo: number;
    customHooks: string[];
  };
  jsxComplexity: {
    elementCount: number;
    nestedDepth: number;
    conditionalRendering: boolean;
    listRendering: boolean;
  };
  props: {
    destructured: string[];
    defaultValues: Record<string, any>;
    validation: boolean;
  };
  state: {
    stateVariables: string[];
    stateUpdaters: string[];
    complexState: boolean;
  };
  lifecycle: {
    useEffectDeps: string[][];
    cleanupFunctions: number;
  };
  performance: {
    memoizedComponents: boolean;
    memoizedCallbacks: boolean;
    lazyComponents: boolean;
  };
}
```

### Complexity Calculation

```typescript
private calculateReactComplexity(content: string): number {
  let complexity = 0;
  
  // Base component complexity
  complexity += content.match(/function\s+[A-Z]/g)?.length || 0;
  complexity += content.match(/class\s+[A-Z]/g)?.length || 0;
  
  // Hook complexity
  complexity += (content.match(/useState\s*\(/g) || []).length * 2;
  complexity += (content.match(/useEffect\s*\(/g) || []).length * 3;
  complexity += (content.match(/useContext\s*\(/g) || []).length * 2;
  complexity += (content.match(/useCallback\s*\(/g) || []).length * 2;
  complexity += (content.match(/useMemo\s*\(/g) || []).length * 2;
  
  // JSX complexity
  complexity += (content.match(/<[^>]+>/g) || []).length;
  complexity += (content.match(/\{[^}]*\}/g) || []).length * 0.5;
  
  // Nested components
  const nestedDepth = this.calculateJSXNesting(content);
  complexity += nestedDepth * 2;
  
  // Conditional rendering
  if (content.includes('&&') || content.includes('?:') || content.includes('if')) {
    complexity += 2;
  }
  
  // List rendering
  if (content.includes('.map')) {
    complexity += 2;
  }
  
  return complexity;
}
```

## Django Framework Rule

### Detection Patterns

#### Model Definition Patterns
```typescript
const djangoModelPatterns = [
  /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*models\.Model\s*\)/,
  /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*AbstractUser\s*\)/,
  /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*AbstractBaseUser\s*\)/
];

const fieldPatterns = [
  /models\.CharField\(/,
  /models\.IntegerField\(/,
  /models\.TextField\(/,
  /models\.DateField\(/,
  /models\.DateTimeField\(/,
  /models\.ForeignKey\(/,
  /models\.ManyToManyField\(/,
  /models\.OneToOneField\(/
];
```

#### View Patterns
```typescript
const viewPatterns = {
  functionBased: [
    /def\s+[a-z][a-zA-Z0-9_]*\s*\([^)]*\):\s*return\s+render\(/,
    /def\s+[a-z][a-zA-Z0-9_]*\s*\([^)]*\):\s*return\s+JsonResponse\(/,
    /@api_view\(\s*\[['"]GET['"]\]\s*\)/
  ],
  classBased: [
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*[A-Z][a-zA-Z0-9]*\s*\)/,
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*ListView\s*\)/,
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*DetailView\s*\)/,
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*CreateView\s*\)/
  ]
};
```

### Metadata Extraction Schema

```typescript
interface DjangoMetadata {
  models: {
    modelName: string;
    fields: {
      name: string;
      type: string;
      constraints: string[];
      relationships: {
        type: 'ForeignKey' | 'ManyToMany' | 'OneToOne';
        relatedModel: string;
      }[];
    }[];
    meta: {
      dbTable?: string;
      ordering?: string[];
      verboseName?: string;
    };
  }[];
  views: {
    name: string;
    type: 'function' | 'class';
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    authentication: boolean;
    permissions: string[];
    template?: string;
  }[];
  orm: {
    queryComplexity: number;
    relationships: string[];
    optimizedQueries: boolean;
    nPlusOneIssues: boolean;
  };
  patterns: {
    usesSignals: boolean;
    usesMiddleware: boolean;
    usesDecorators: boolean;
    usesGenericViews: boolean;
  };
}
```

## Spring Boot Framework Rule

### Detection Patterns

#### Annotation Patterns
```typescript
const springAnnotationPatterns = {
  application: [
    /@SpringBootApplication/,
    /@SpringBootConfiguration/,
    /@EnableAutoConfiguration/
  ],
  controllers: [
    /@RestController/,
    /@Controller/,
    /@RequestMapping/,
    /@GetMapping/,
    /@PostMapping/,
    /@PutMapping/,
    /@DeleteMapping/
  ],
  dependencyInjection: [
    /@Autowired/,
    /@Component/,
    /@Service/,
    /@Repository/,
    /@Qualifier/
  ],
  data: [
    /@Entity/,
    /@Table/,
    /@Id/,
    /@GeneratedValue/,
    /@Column/,
    /@OneToMany/,
    /@ManyToOne/,
    /@ManyToMany/,
    /@OneToOne/
  ],
  transactions: [
    /@Transactional/,
    /@Transactional\s*\([^)]*readOnly\s*=\s*true[^)]*\)/
  ]
};
```

### Metadata Extraction Schema

```typescript
interface SpringBootMetadata {
  application: {
    mainClass: string;
    packages: string[];
    autoConfigurations: string[];
  };
  controllers: {
    className: string;
    type: 'RestController' | 'Controller';
    endpoints: {
      path: string;
      method: string;
      parameters: string[];
      returnTypes: string;
    }[];
    requestMappings: string[];
  }[];
  dependencyInjection: {
    beans: string[];
    injections: {
      field: string;
      type: string;
      qualifier?: string;
    }[];
    circularDependencies: boolean;
  };
  data: {
    entities: {
      name: string;
      table: string;
      fields: {
        name: string;
        type: string;
        column: string;
        constraints: string[];
      }[];
      relationships: {
        field: string;
        targetEntity: string;
        type: string;
        cascade: string[];
      }[];
    }[];
    repositories: string[];
    queries: string[];
  };
  transactions: {
    transactionalMethods: string[];
    rollbackRules: string[];
    isolationLevels: string[];
  };
  performance: {
    lazyLoading: boolean;
    cachingEnabled: boolean;
    connectionPooling: boolean;
  };
}
```

## PyTorch Framework Rule

### Detection Patterns

#### Neural Network Patterns
```typescript
const pytorchPatterns = {
  moduleDefinition: [
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*nn\.Module\s*\)/,
    /class\s+[A-Z][a-zA-Z0-9]*\s*\(\s*torch\.nn\.Module\s*\)/
  ],
  layerPatterns: [
    /self\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*nn\.Linear\(/,
    /self\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*nn\.Conv2d\(/,
    /self\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*nn\.LSTM\(/,
    /self\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*nn\.Transformer\(/,
    /self\.[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*nn\.Embedding\(/
  ],
  trainingPatterns: [
    /model\.train\s*\(\)/,
    /optimizer\.zero_grad\s*\(\)/,
    /loss\.backward\s*\(\)/,
    /optimizer\.step\s*\(\)/,
    /for\s+epoch\s+in\s+range\s*\([^)]+\):/
  ],
  tensorPatterns: [
    /torch\.tensor\(/,
    /torch\.zeros\(/,
    /torch\.ones\(/,
    /torch\.randn\(/,
    /\.to\s*\([^)]+\)/,
    /\.cuda\s*\(\)/
  ]
};
```

### Metadata Extraction Schema

```typescript
interface PyTorchMetadata {
  neuralNetwork: {
    className: string;
    layers: {
      type: string;
      inputSize: number;
      outputSize: number;
      parameters: Record<string, any>;
    }[];
    totalParameters: number;
    trainableParameters: number;
  };
  training: {
    epochs: number;
    batchSize: number;
    optimizer: string;
    lossFunction: string;
    learningRate: number;
    device: 'cpu' | 'cuda' | 'mps';
  };
  data: {
    inputShape: number[];
    outputShape: number[];
    datasetSize: number;
    dataLoaders: string[];
    augmentation: boolean;
  };
  performance: {
    gpuAcceleration: boolean;
    mixedPrecision: boolean;
    gradientClipping: boolean;
    checkpointing: boolean;
  };
  patterns: {
    usesDistributed: boolean;
    usesCustomLoss: boolean;
    usesScheduler: boolean;
    usesEarlyStopping: boolean;
  };
}
```

## Implementation Guidelines

### 1. Pattern Detection Strategy

#### Multi-level Detection
```typescript
class FrameworkRuleDetector {
  private detectFramework(node: Parser.SyntaxNode, sourceCode: string): boolean {
    // Level 1: Import-based detection
    if (this.detectByImports(sourceCode)) return true;
    
    // Level 2: Pattern-based detection
    if (this.detectByPatterns(node, sourceCode)) return true;
    
    // Level 3: Structural detection
    if (this.detectByStructure(node, sourceCode)) return true;
    
    return false;
  }
  
  private detectByImports(sourceCode: string): boolean {
    const importPatterns = this.getFrameworkImportPatterns();
    return importPatterns.some(pattern => pattern.test(sourceCode));
  }
  
  private detectByPatterns(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    const patterns = this.getFrameworkPatterns();
    return patterns.some(pattern => pattern.test(content));
  }
}
```

### 2. Performance Optimization

#### Caching Strategy
```typescript
class FrameworkRuleCache {
  private patternCache = new Map<string, boolean>();
  private metadataCache = new Map<string, any>();
  
  public isFrameworkPattern(content: string, patterns: RegExp[]): boolean {
    const cacheKey = this.generateCacheKey(content, patterns);
    
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }
    
    const result = patterns.some(pattern => pattern.test(content));
    this.patternCache.set(cacheKey, result);
    
    return result;
  }
}
```

#### Batch Processing
```typescript
class FrameworkRuleBatchProcessor {
  public async processBatch(nodes: Parser.SyntaxNode[], sourceCode: string): Promise<SnippetChunk[]> {
    const results: SnippetChunk[] = [];
    
    // Group nodes by type for efficient processing
    const groupedNodes = this.groupNodesByType(nodes);
    
    // Process each group in parallel
    const processingPromises = Array.from(groupedNodes.entries()).map(
      ([nodeType, nodesOfType]) => this.processNodeGroup(nodeType, nodesOfType, sourceCode)
    );
    
    const batchResults = await Promise.all(processingPromises);
    batchResults.forEach(groupResults => results.push(...groupResults));
    
    return results;
  }
}
```

### 3. Error Handling and Validation

#### Pattern Validation
```typescript
class FrameworkPatternValidator {
  public validatePattern(pattern: RegExp, content: string): ValidationResult {
    try {
      const matches = pattern.exec(content);
      if (!matches) {
        return { isValid: false, error: 'No matches found' };
      }
      
      // Validate match quality
      const matchQuality = this.assessMatchQuality(matches, content);
      if (matchQuality.score < 0.5) {
        return { isValid: false, error: 'Low quality match' };
      }
      
      return { isValid: true, matches, quality: matchQuality };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }
}
```

### 4. Testing Framework

#### Test Data Structure
```typescript
interface FrameworkTestData {
  framework: string;
  testCases: {
    name: string;
    code: string;
    expectedMetadata: any;
    expectedComplexity: number;
  }[];
  edgeCases: {
    name: string;
    code: string;
    expectedBehavior: 'pass' | 'fail' | 'partial';
  }[];
}

// Example test data for React
const reactTestData: FrameworkTestData = {
  framework: 'react',
  testCases: [
    {
      name: 'functional component with hooks',
      code: `
        import React, { useState, useEffect } from 'react';
        
        function MyComponent({ name }) {
          const [count, setCount] = useState(0);
          
          useEffect(() => {
            console.log('Component mounted');
          }, []);
          
          return <div>Hello {name}</div>;
        }
      `,
      expectedMetadata: {
        componentType: 'functional',
        hooks: { useState: 1, useEffect: 1 },
        jsxComplexity: { elementCount: 2 }
      },
      expectedComplexity: 8
    }
  ]
};
```

This detailed implementation guide provides the technical specifications needed to implement each framework rule effectively, ensuring consistent quality and performance across all framework implementations.