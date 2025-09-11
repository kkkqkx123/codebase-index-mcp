import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * React Framework Data Flow Rule
 * 
 * Specialized data flow analysis for React applications, focusing on:
 * - Component state management (useState, useReducer)
 * - Props drilling and composition
 * - Hook dependencies and effects
 * - Context API usage patterns
 * - Component lifecycle and memoization
 */
export class ReactDataFlowRule extends AbstractSnippetRule {
  readonly name = 'ReactDataFlowRule';
  readonly supportedNodeTypes = new Set([
    'function_declaration', 'function_definition', 'arrow_function',
    'call_expression', 'method_call', 'jsx_element', 'jsx_self_closing_element',
    'variable_declaration', 'assignment_expression', 'return_statement'
  ]);

  protected readonly snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment' = 'logic_block';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    
    // Check if it's React-related code
    return this.isReactCode(content) && this.hasReactDataFlow(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    // React-specific data flow analysis
    const reactAnalysis = this.analyzeReactDataFlow(node, content, sourceCode);
    const performanceAnalysis = this.analyzeReactPerformance(content);
    const stateAnalysis = this.analyzeStateManagement(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractReactImports(node, sourceCode),
      exports: this.extractExports(node, sourceCode),
      metadata: {
        react: reactAnalysis,
        performance: performanceAnalysis,
        stateManagement: stateAnalysis
      },
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateReactComplexity(content, reactAnalysis),
        isStandalone: this.isStandaloneReactComponent(node, content),
        hasSideEffects: this.hasReactSideEffects(content)
      }
    };
  }

  private isReactCode(content: string): boolean {
    const reactPatterns = [
      /import\s+.*\s+from\s+['"]react['"]/,
      /useState\(/, /useEffect\(/, /useContext\(/, /useReducer\(/,
      /useCallback\(/, /useMemo\(/, /useRef\(/,
      /React\.Component/, /React\.PureComponent/,
      /extends\s+Component/, /extends\s+React\.Component/,
      /<[^>]+>/, /className\s*=/, /props\./, /setState/
    ];

    return reactPatterns.some(pattern => pattern.test(content));
  }

  private hasReactDataFlow(content: string): boolean {
    const dataFlowPatterns = [
      // State management
      /const\s*\[.*\]\s*=\s*useState\(/,
      /const\s*\[.*\]\s*=\s*useReducer\(/,
      /dispatch\(/,
      
      // Props usage
      /props\.\w+/,
      /const\s*\{\s*\w+\s*\}\s*=\s*props/,
      /{...props}/,
      
      // Context usage
      /useContext\(/,
      /<\w+\.Provider/,
      /Context\.Consumer/,
      
      // Effect dependencies
      /useEffect\s*\([^)]*,\s*\[[^]]*\]\)/,
      /useCallback\s*\([^)]*,\s*\[[^]]*\]\)/,
      /useMemo\s*\([^)]*,\s*\[[^]]*\]\)/,
      
      // Event handlers
      /onClick\s*=/, /onChange\s*=/, /onSubmit\s*=/,
      /handle\w+\s*=/,
      
      // Rendering patterns
      /return\s*<[^>]+>/,
      /\.map\([^)]*\)\s*=>\s*<[^>]+>/,
      /condition\s*\?\s*<[^>]+>\s*:\s*<[^>]+>/
    ];

    return dataFlowPatterns.some(pattern => pattern.test(content));
  }

  private analyzeReactDataFlow(
    node: Parser.SyntaxNode,
    content: string,
    sourceCode: string
  ): {
    componentType: 'functional' | 'class' | 'hook' | 'unknown';
    hooks: Array<{ name: string; dependencies: string[]; line: number }>;
    props: Array<{ name: string; type: string; isRequired: boolean }>;
    stateVariables: Array<{ name: string; type: 'state' | 'reducer'; dependencies: string[] }>;
    contextUsage: Array<{ context: string; line: number }>;
    renderPatterns: Array<{ type: string; complexity: number }>;
  } {
    const hooks: Array<{ name: string; dependencies: string[]; line: number }> = [];
    const props: Array<{ name: string; type: string; isRequired: boolean }> = [];
    const stateVariables: Array<{ name: string; type: 'state' | 'reducer'; dependencies: string[] }> = [];
    const contextUsage: Array<{ context: string; line: number }> = [];
    const renderPatterns: Array<{ type: string; complexity: number }> = [];

    // Determine component type
    let componentType: 'functional' | 'class' | 'hook' | 'unknown' = 'unknown';
    if (content.includes('function') && content.includes('return') && content.includes('<')) {
      componentType = 'functional';
    } else if (content.includes('class') && content.includes('extends')) {
      componentType = 'class';
    } else if (content.includes('useState') || content.includes('useEffect')) {
      componentType = 'hook';
    }

    // Analyze hooks
    const hookPatterns = [
      { name: 'useState', regex: /useState\s*<[^>]*>?\s*\(([^)]*)\)/ },
      { name: 'useEffect', regex: /useEffect\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\)/ },
      { name: 'useContext', regex: /useContext\s*\(([^)]*)\)/ },
      { name: 'useReducer', regex: /useReducer\s*\(([^)]*),\s*([^)]*)\)/ },
      { name: 'useCallback', regex: /useCallback\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\)/ },
      { name: 'useMemo', regex: /useMemo\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\)/ }
    ];

    hookPatterns.forEach(hookPattern => {
      let match;
      while ((match = hookPattern.regex.exec(content)) !== null) {
        const dependencies = match[1] ? 
          match[1].split(',').map(d => d.trim()).filter(d => d.length > 0) : 
          [];
        
        hooks.push({
          name: hookPattern.name,
          dependencies,
          line: this.getLineNumber(content, match.index)
        });

        // Extract state variables
        if (hookPattern.name === 'useState' || hookPattern.name === 'useReducer') {
          const stateMatch = content.match(/const\s*\[([a-zA-Z_$][a-zA-Z0-9_$]*)/);
          if (stateMatch) {
            stateVariables.push({
              name: stateMatch[1],
              type: hookPattern.name === 'useState' ? 'state' : 'reducer',
              dependencies: []
            });
          }
        }
      }
    });

    // Analyze props
    const propPatterns = [
      { regex: /props\.(\w+)/, type: 'direct' },
      { regex: /const\s*\{\s*(\w+)\s*\}\s*=\s*props/, type: 'destructured' },
      { regex: /(\w+)\s*:\s*PropTypes\./, type: 'propType' },
      { regex: /interface\s+\w+\s*{\s*(\w+)[^;]*;/, type: 'typescript' }
    ];

    propPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        props.push({
          name: match[1],
          type: pattern.type,
          isRequired: !content.includes(`${match[1]}?`)
        });
      }
    });

    // Analyze context usage
    const contextPatterns = [
      /useContext\s*\(([^)]*)\)/,
      /<(\w+)\.Provider/,
      /(\w+)\.Consumer/
    ];

    contextPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        contextUsage.push({
          context: match[1],
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Analyze render patterns
    if (content.includes('.map(')) {
      renderPatterns.push({ type: 'list_rendering', complexity: 2 });
    }
    if (content.includes('&&') && content.includes('<')) {
      renderPatterns.push({ type: 'conditional_rendering', complexity: 1 });
    }
    if (content.includes('?:') && content.includes('<')) {
      renderPatterns.push({ type: 'ternary_rendering', complexity: 1 });
    }
    if (content.includes('<')) {
      renderPatterns.push({ type: 'jsx_rendering', complexity: 1 });
    }

    return {
      componentType,
      hooks,
      props,
      stateVariables,
      contextUsage,
      renderPatterns
    };
  }

  private analyzeReactPerformance(content: string): {
    memoization: Array<{ type: 'useMemo' | 'useCallback'; variables: string[]; line: number }>;
    unnecessaryRenders: Array<{ cause: string; line: number }>;
    largeComponents: Array<{ reason: string; complexity: number }>;
    propDrilling: Array<{ path: string; depth: number }>;
  } {
    const memoization: Array<{ type: 'useMemo' | 'useCallback'; variables: string[]; line: number }> = [];
    const unnecessaryRenders: Array<{ cause: string; line: number }> = [];
    const largeComponents: Array<{ reason: string; complexity: number }> = [];
    const propDrilling: Array<{ path: string; depth: number }> = [];

    // Analyze memoization
    const memoPatterns = [
      { type: 'useMemo', regex: /useMemo\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\)/ },
      { type: 'useCallback', regex: /useCallback\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\)/ }
    ];

    memoPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const dependencies = match[1] ? 
          match[1].split(',').map(d => d.trim()).filter(d => d.length > 0) : [];
        
        memoization.push({
          type: pattern.type,
          variables: dependencies,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Detect unnecessary renders
    if (content.includes('useState') && !content.includes('useMemo') && !content.includes('useCallback')) {
      unnecessaryRenders.push({
        cause: 'missing_memoization',
        line: this.getLineNumber(content, content.indexOf('useState'))
      });
    }

    // Detect large components
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 100) {
      largeComponents.push({
        reason: 'too_many_lines',
        complexity: lines.length
      });
    }

    // Detect prop drilling
    const propDrillingPattern = /props\.(\w+)\s*=\s*\{props\.(\w+)\}/;
    let match;
    while ((match = propDrillingPattern.exec(content)) !== null) {
      propDrilling.push({
        path: `${match[1]} -> ${match[2]}`,
        depth: 2
      });
    }

    return {
      memoization,
      unnecessaryRenders,
      largeComponents,
      propDrilling
    };
  }

  private analyzeStateManagement(content: string): {
    stateUpdates: Array<{ variable: string; pattern: string; line: number }>;
    derivedState: Array<{ from: string; to: string; computation: string }>;
    sideEffects: Array<{ hook: string; dependencies: string[]; line: number }>;
    stateShape: { complexity: number; variables: number; dependencies: number };
  } {
    const stateUpdates: Array<{ variable: string; pattern: string; line: number }> = [];
    const derivedState: Array<{ from: string; to: string; computation: string }> = [];
    const sideEffects: Array<{ hook: string; dependencies: string[]; line: number }> = [];

    // Analyze state update patterns
    const updatePatterns = [
      { pattern: /set(\w+)\s*\(/, type: 'setter' },
      { pattern: /dispatch\s*\(/, type: 'dispatch' },
      { pattern: /(\w+)\s*=\s*\{.*\.\.\.\1.*\}/, type: 'spread_update' }
    ];

    updatePatterns.forEach(updatePattern => {
      let match;
      while ((match = updatePattern.pattern.exec(content)) !== null) {
        stateUpdates.push({
          variable: match[1] || 'state',
          pattern: updatePattern.type,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Analyze derived state
    const derivedPatterns = [
      /const\s+(\w+)\s*=\s*(\w+)\s*\.\w+\s*\([^)]*\)/,
      /const\s+(\w+)\s*=\s*(\w+)\s*\.\w+\s*\([^)]*\)\s*\.\w+\s*\([^)]*\)/
    ];

    derivedPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        derivedState.push({
          from: match[2],
          to: match[1],
          computation: 'computation'
        });
      }
    });

    // Analyze side effects
    const effectPatterns = [
      { hook: 'useEffect', regex: /useEffect\s*\([^)]*,\s*\[([^]]*)\]\)/ }
    ];

    effectPatterns.forEach(effectPattern => {
      let match;
      while ((match = effectPattern.regex.exec(content)) !== null) {
        const dependencies = match[1] ? 
          match[1].split(',').map(d => d.trim()).filter(d => d.length > 0) : [];
        
        sideEffects.push({
          hook: effectPattern.hook,
          dependencies,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Calculate state shape complexity
    const stateVariables = (content.match(/useState\s*\(/g) || []).length;
    const stateDependencies = (content.match(/useState\s*\([^)]*\)/g) || []).length;
    const stateComplexity = stateVariables * 2 + stateDependencies;

    return {
      stateUpdates,
      derivedState,
      sideEffects,
      stateShape: {
        complexity: stateComplexity,
        variables: stateVariables,
        dependencies: stateDependencies
      }
    };
  }

  private calculateReactComplexity(content: string, reactAnalysis: any): number {
    let complexity = this.calculateComplexity(content);
    
    // Add React-specific complexity factors
    complexity += reactAnalysis.hooks.length * 2;
    complexity += reactAnalysis.props.length * 1;
    complexity += reactAnalysis.stateVariables.length * 3;
    complexity += reactAnalysis.contextUsage.length * 2;
    complexity += reactAnalysis.renderPatterns.reduce((sum: number, pattern: any) => sum + pattern.complexity, 0);
    
    // Performance factors
    complexity += reactAnalysis.performance.memoization.length * 1;
    complexity += reactAnalysis.performance.unnecessaryRenders.length * 3;
    complexity += reactAnalysis.performance.largeComponents.length * 5;
    complexity += reactAnalysis.performance.propDrilling.length * 2;
    
    // State management complexity
    complexity += reactAnalysis.stateManagement.stateUpdates.length * 1;
    complexity += reactAnalysis.stateManagement.derivedState.length * 2;
    complexity += reactAnalysis.stateManagement.sideEffects.length * 2;
    complexity += reactAnalysis.stateManagement.stateShape.complexity;
    
    return Math.round(complexity);
  }

  private isStandaloneReactComponent(node: Parser.SyntaxNode, content: string): boolean {
    const componentPatterns = [
      /export\s+(default\s+)?function\s+[A-Z]/,
      /export\s+(default\s+)?const\s+[A-Z]\s*=\s*\(/,
      /class\s+[A-Z]\s+extends\s+(React\.)?Component/,
      /export\s+class\s+[A-Z]/
    ];

    return componentPatterns.some(pattern => pattern.test(content));
  }

  private hasReactSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /useEffect\s*\([^,]+,\s*\[\]\)/,  // Effect with empty dependencies (mount only)
      /useEffect\s*\([^,]+,\s*\[.*\]\)/, // Effect with dependencies
      /localStorage\./,
      /sessionStorage\./,
      /fetch\(/,
      /axios\./,
      /XMLHttpRequest/,
      /window\./,
      /document\./,
      /console\./,
      /alert\(/,
      /confirm\(/
    ];

    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  private extractReactImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('react') || 
            importText.includes('@testing-library/react') ||
            importText.includes('react-dom')) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private extractExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'export_statement' || n.type === 'export_named_declaration') {
        const exportText = this.getNodeText(n, sourceCode);
        exports.push(exportText);
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return exports;
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return (beforeIndex.match(/\n/g) || []).length + 1;
  }
}