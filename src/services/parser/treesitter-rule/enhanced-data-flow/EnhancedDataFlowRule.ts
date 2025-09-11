import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../types';
import { AbstractSnippetRule } from '../AbstractSnippetRule';

/**
 * Enhanced Data Flow Analysis Rule
 * 
 * This rule identifies and analyzes data flow patterns across different frameworks,
 * focusing on variable tracking, scope analysis, and dependency relationships.
 * It extends the existing data-flow analysis with framework-specific patterns.
 */
export class EnhancedDataFlowRule extends AbstractSnippetRule {
  readonly name = 'EnhancedDataFlowRule';
  readonly supportedNodeTypes = new Set([
    // Variable definitions and assignments
    'variable_declaration', 'variable_declarator', 'assignment_expression',
    'lexical_declaration', 'const_declaration', 'let_declaration',
    
    // Function and method definitions
    'function_declaration', 'function_definition', 'method_definition',
    'arrow_function', 'function_expression',
    
    // Control flow structures
    'if_statement', 'for_statement', 'while_statement', 'switch_statement',
    'try_statement', 'catch_clause', 'finally_clause',
    
    // Expressions that affect data flow
    'call_expression', 'method_call', 'return_statement', 'yield_expression',
    
    // Property access and object patterns
    'property_access_expression', 'member_expression', 'object_pattern',
    'array_pattern', 'spread_element', 'rest_pattern'
  ]);

  protected readonly snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment' = 'logic_block';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    
    // Filter out trivial expressions
    if (content.length < 20) return false;
    
    // Check for meaningful data flow patterns
    return this.hasDataFlowPatterns(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    
    // Enhanced data flow analysis
    const dataFlowAnalysis = this.analyzeDataFlowPatterns(node, content, sourceCode);
    const frameworkAnalysis = this.detectFrameworkPatterns(content);
    const securityAnalysis = this.analyzeSecurityPatterns(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractImports(node, sourceCode),
      exports: this.extractExports(node, sourceCode),
      metadata: {
        // Enhanced metadata with data flow information
        dataFlow: dataFlowAnalysis,
        framework: frameworkAnalysis,
        security: securityAnalysis
      },
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateDataFlowComplexity(content, dataFlowAnalysis),
        isStandalone: this.isStandaloneDataFlow(node),
        hasSideEffects: this.hasSideEffects(content)
      }
    };
  }

  private hasDataFlowPatterns(content: string): boolean {
    const patterns = [
      // Variable assignments and modifications
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*[^;]+/,
      
      // Function calls with parameters
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)/,
      
      // Property access chains
      /[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+/,
      
      // Control flow with variable usage
      /if\s*\([^)]+\).*\{[^}]*[a-zA-Z_$]/,
      
      // Array/object operations
      /\.(push|pop|shift|unshift|splice|map|filter|reduce|find)/,
      
      // Template literals with variables
      /`[^`]*\${[^}]+}[^`]*`/,
      
      // Spread/rest operations
      /\.\.\.|...\s*[a-zA-Z_$]/,
      
      // Destructuring
      /const\s*{\s*[a-zA-Z_$]/,
      /const\s*\[\s*[a-zA-Z_$]/
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  private analyzeDataFlowPatterns(
    node: Parser.SyntaxNode,
    content: string,
    sourceCode: string
  ): {
    variables: string[];
    dependencies: Array<{ from: string; to: string; type: string }>;
    scopes: Array<{ name: string; type: string; variables: string[] }>;
    transformations: Array<{ variable: string; operation: string; line: number }>;
  } {
    const variables: string[] = [];
    const dependencies: Array<{ from: string; to: string; type: string }> = [];
    const scopes: Array<{ name: string; type: string; variables: string[] }> = [];
    const transformations: Array<{ variable: string; operation: string; line: number }> = [];

    // Extract variable declarations
    const varDeclarations = content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    varDeclarations.forEach(decl => {
      const match = decl.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (match) variables.push(match[1]);
    });

    // Analyze function parameter dependencies
    const functionMatches = content.match(/(?:function|=>)\s*\([^)]*\)/g) || [];
    functionMatches.forEach((funcMatch, index) => {
      const paramMatch = funcMatch.match(/\(([^)]*)\)/);
      if (paramMatch) {
        const params = paramMatch[1].split(',').map(p => p.trim()).filter(p => p);
        params.forEach(param => {
          if (param && !variables.includes(param)) {
            variables.push(param);
          }
        });
      }
    });

    // Extract data transformations
    const transformPatterns = [
      { regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\.(\w+)/, type: 'method_call' },
      { regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([+\-*/%^])/, type: 'arithmetic' },
      { regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\[.*\]\.(\w+)/, type: 'array_operation' },
      { regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\{.*\}\.(\w+)/, type: 'object_operation' }
    ];

    transformPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        transformations.push({
          variable: match[1],
          operation: `${pattern.type}:${match[2] || match[3]}`,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Identify function scope
    const functionTypes = ['function_declaration', 'function_definition', 'arrow_function'];
    let currentScope = node;
    while (currentScope) {
      if (functionTypes.includes(currentScope.type)) {
        const scopeName = this.getScopeName(currentScope, sourceCode);
        if (scopeName) {
          scopes.push({
            name: scopeName,
            type: currentScope.type,
            variables: variables.slice() // Copy current variables
          });
        }
        break;
      }
      currentScope = currentScope.parent;
    }

    return {
      variables,
      dependencies,
      scopes,
      transformations
    };
  }

  private detectFrameworkPatterns(content: string): {
    framework?: string;
    patterns: string[];
    features: Record<string, boolean>;
  } {
    const frameworks = {
      react: {
        patterns: [
          /useState\(/, /useEffect\(/, /useContext\(/, /useReducer\(/,
          /import\s+.*\s+from\s+['"]react['"]/,
          /<[^>]+>/, /className\s*=/, /props\./, /setState/
        ],
        features: ['hooks', 'jsx', 'props', 'state']
      },
      vue: {
        patterns: [
          /ref\(/, /reactive\(/, /computed\(/, /watch\(/,
          /import\s+.*\s+from\s+['"]vue['"]/,
          /v-/, /@click/, /:class/, /setup\(\)/
        ],
        features: ['reactivity', 'directives', 'composition-api']
      },
      angular: {
        patterns: [
          /@Component\(/, /@Injectable\(/, /ngOnInit\(/, /ngOnChanges\(/,
          /import\s+.*\s+from\s+['"]@angular\/core['"]/,
          /this\.\w+\s*=/, /private\s+\w+:\s*\w+/
        ],
        features: ['decorators', 'dependency-injection', 'lifecycle-hooks']
      },
      express: {
        patterns: [
          /app\.(get|post|put|delete)\(/, /router\.(get|post|put|delete)\(/,
          /req\.(body|params|query)/, /res\.(send|json|status)/,
          /import\s+.*\s+from\s+['"]express['"]/
        ],
        features: ['routing', 'middleware', 'request-handling']
      },
      'django': {
        patterns: [
          /def\s+\w+\(request/, /models\.Model/, /render\(/, /HttpResponse\(/,
          /from\s+django\.import/,
          /@login_required/, /@api_view/
        ],
        features: ['orm', 'views', 'decorators', 'request-handling']
      },
      'spring-boot': {
        patterns: [
          /@RestController/, /@Service/, /@Autowired/, /@Entity/,
          /@RequestMapping/, /@GetMapping/, /@PostMapping/,
          /public\s+class\s+\w+Controller/
        ],
        features: ['annotations', 'dependency-injection', 'rest-api']
      }
    };

    let detectedFramework: string | undefined;
    let detectedPatterns: string[] = [];
    const detectedFeatures: Record<string, boolean> = {};

    for (const [framework, config] of Object.entries(frameworks)) {
      const matches = config.patterns.filter(pattern => pattern.test(content));
      if (matches.length >= 2) { // Require at least 2 patterns to detect framework
        detectedFramework = framework;
        detectedPatterns = matches;
        config.features.forEach(feature => {
          detectedFeatures[feature] = true;
        });
        break;
      }
    }

    return {
      framework: detectedFramework,
      patterns: detectedPatterns,
      features: detectedFeatures
    };
  }

  private analyzeSecurityPatterns(content: string): {
    vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number }>;
    sanitization: Array<{ method: string; line: number }>;
    dataSources: Array<{ source: string; line: number }>;
  } {
    const vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number }> = [];
    const sanitization: Array<{ method: string; line: number }> = [];
    const dataSources: Array<{ source: string; line: number }> = [];

    // SQL Injection detection
    const sqlInjectionPatterns = [
      /execute\(['"][^'"]*\+[^'"]*['"]/,  // execute("query + " + variable)
      /query\s*\([^)]*\+[^)]*\)/,       // query("... + " + user_input)
      /\+\s*['"][^'"]*\$\{[^}]+\}/      // string + `${user_input}`
    ];
    
    sqlInjectionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        vulnerabilities.push({
          type: 'sql_injection',
          severity: 'HIGH',
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // XSS detection
    const xssPatterns = [
      /innerHTML\s*=\s*['"][^'"]*\+/,    // innerHTML = user_input
      /document\.write\([^)]*\+/,        // document.write(user_input)
      /eval\([^)]*\+[^)]*\)/             // eval(user_input)
    ];

    xssPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        vulnerabilities.push({
          type: 'xss',
          severity: 'HIGH',
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Sanitization detection
    const sanitizePatterns = [
      /(?:sanitize|escape|encodeURI|encodeURIComponent|htmlspecialchars)\s*\(/,
      /\.trim\(\)/, /\.replace\(/, /\.toLowerCase\(\)/
    ];

    sanitizePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[0].match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/)?.[1] || 'unknown';
        sanitization.push({
          method,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Data source identification
    const sourcePatterns = [
      { regex: /req\.(body|params|query|headers)\.(\w+)/, source: 'http_request' },
      { regex: /localStorage\.getItem\(([^)]+)\)/, source: 'local_storage' },
      { regex: /sessionStorage\.getItem\(([^)]+)\)/, source: 'session_storage' },
      { regex: /document\.getElementById\(([^)]+)\)/, source: 'dom' },
      { regex: /process\.env\.(\w+)/, source: 'environment' },
      { regex: /config\.get\(([^)]+)\)/, source: 'configuration' }
    ];

    sourcePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        dataSources.push({
          source: pattern.source,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    return {
      vulnerabilities,
      sanitization,
      dataSources
    };
  }

  private calculateDataFlowComplexity(
    content: string,
    dataFlowAnalysis: any
  ): number {
    let complexity = this.calculateComplexity(content);
    
    // Add complexity for data flow factors
    complexity += dataFlowAnalysis.variables.length * 0.5;
    complexity += dataFlowAnalysis.dependencies.length * 1;
    complexity += dataFlowAnalysis.transformations.length * 1.5;
    complexity += dataFlowAnalysis.scopes.length * 2;
    
    // Add complexity for framework features
    if (dataFlowAnalysis.framework) {
      complexity += 3;
    }
    
    // Add complexity for security considerations
    complexity += dataFlowAnalysis.security?.vulnerabilities.length * 5 || 0;
    
    return Math.round(complexity);
  }

  private isStandaloneDataFlow(node: Parser.SyntaxNode): boolean {
    const standaloneTypes = [
      'function_declaration', 'function_definition', 'arrow_function',
      'method_definition', 'class_declaration', 'try_statement'
    ];
    
    return standaloneTypes.includes(node.type) || 
           this.hasDataFlowDependencies(node);
  }

  private hasDataFlowDependencies(node: Parser.SyntaxNode): boolean {
    // Check if the node represents a meaningful data flow unit
    const content = this.getNodeText(node, this.sourceCode || '');
    
    // Look for patterns that indicate data flow dependencies
    const dependencyPatterns = [
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[+\-*/%]/,  // Arithmetic assignment
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*function\s*\(/,                      // Function assignment
      /return\s+[a-zA-Z_$][a-zA-Z0-9_$]*/,                                   // Return variable
      /[a-zA-Z_$][a-zA-Z0-9_$]*\.\w+\s*\([^)]*\)/                           // Method call
    ];
    
    return dependencyPatterns.some(pattern => pattern.test(content));
  }

  private getScopeName(node: Parser.SyntaxNode, sourceCode: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return this.getNodeText(nameNode, sourceCode);
    }
    
    // For arrow functions and anonymous functions, try to infer from assignment
    if (node.type === 'arrow_function') {
      const parent = node.parent;
      if (parent && parent.type === 'assignment_expression') {
        const left = parent.childForFieldName('left');
        if (left) {
          return this.getNodeText(left, sourceCode);
        }
      }
    }
    
    return 'anonymous';
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return (beforeIndex.match(/\n/g) || []).length + 1;
  }

  private sourceCode: string = '';

  private extractImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    this.sourceCode = sourceCode; // Store for later use
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        imports.push(importText);
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
}