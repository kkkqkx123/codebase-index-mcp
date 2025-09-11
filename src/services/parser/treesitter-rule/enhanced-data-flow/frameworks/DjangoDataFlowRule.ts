import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * Django Framework Data Flow Rule
 * 
 * Specialized data flow analysis for Django applications, focusing on:
 * - Model relationships and ORM queries
 * - View patterns and request handling
 * - Template rendering and context passing
 * - Form processing and validation
 * - Authentication and authorization patterns
 */
export class DjangoDataFlowRule extends AbstractSnippetRule {
  readonly name = 'DjangoDataFlowRule';
  readonly supportedNodeTypes = new Set([
    'class_definition', 'function_definition', 'decorated_definition',
    'call_expression', 'assignment_expression', 'return_statement',
    'import_statement', 'import_from_statement', 'decorator'
  ]);

  protected readonly snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment' = 'logic_block';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    
    // Check if it's Django-related code
    return this.isDjangoCode(content) && this.hasDjangoDataFlow(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    // Django-specific data flow analysis
    const djangoAnalysis = this.analyzeDjangoDataFlow(node, content, sourceCode);
    const ormAnalysis = this.analyzeORMPatterns(content);
    const securityAnalysis = this.analyzeDjangoSecurity(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractDjangoImports(node, sourceCode),
      exports: this.extractExports(node, sourceCode),
      metadata: {
        django: djangoAnalysis,
        orm: ormAnalysis,
        security: securityAnalysis
      },
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateDjangoComplexity(content, djangoAnalysis, ormAnalysis),
        isStandalone: this.isStandaloneDjangoComponent(node, content),
        hasSideEffects: this.hasDjangoSideEffects(content)
      }
    };
  }

  private isDjangoCode(content: string): boolean {
    const djangoPatterns = [
      /from\s+django\./,
      /import\s+django\./,
      /models\.Model/,
      /models\.Manager/,
      /@login_required/,
      /@api_view/,
      /@permission_required/,
      /@csrf_exempt/,
      /render\(/,
      /HttpResponse\(/,
      /JsonResponse\(/,
      /redirect\(/,
      /get_object_or_404\(/,
      /get_list_or_404\(/,
      /QuerySet/,
      /ModelForm/,
      /Form/,
      /User\.objects/,
      /request\.(user|POST|GET|method)/,
      /self\.(get|post|put|delete)/,
      /class\s+\w+View/,
      /class\s+\w+(View|Mixin)/
    ];

    return djangoPatterns.some(pattern => pattern.test(content));
  }

  private hasDjangoDataFlow(content: string): boolean {
    const dataFlowPatterns = [
      // Model field definitions
      /[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*models\.[a-zA-Z]+\(/,
      
      // ORM queries
      /\.objects\.(all|filter|exclude|get|create|update|delete|order_by|values|values_list)\(/,
      /\.objects\.(first|last|count|exists|aggregate|annotate)\(/,
      
      // View request handling
      /def\s+(get|post|put|delete|patch)\s*\(\s*self,\s*request/,
      /request\.(GET|POST|FILES|user|method)/,
      
      // Template rendering
      /render\s*\([^)]*context\s*=\s*{/,
      /return\s+render\(/,
      
      // Form processing
      /form\.(is_valid|save|cleaned_data)/,
      /request\.POST\.get\(/,
      
      // Database relationships
      /ForeignKey\(/, /ManyToManyField\(/, /OneToOneField\(/,
      /\.set\(/, /\.add\(/, /\.remove\(/, /\.clear\(/,
      
      // Query optimization patterns
      /\.select_related\(/, /\.prefetch_related\(/, /\.defer\(/, /\.only\(/,
      
      // Authentication
      /login\(/, /logout\(/, /authenticate\(/,
      /@login_required/, /@permission_required/,
      /request\.user\.(is_authenticated|is_staff|is_superuser)/
    ];

    return dataFlowPatterns.some(pattern => pattern.test(content));
  }

  private analyzeDjangoDataFlow(
    node: Parser.SyntaxNode,
    content: string,
    sourceCode: string
  ): {
    componentType: 'model' | 'view' | 'form' | 'middleware' | 'admin' | 'unknown';
    requestFlow: Array<{ from: string; to: string; type: string }>;
    databaseOperations: Array<{ type: string; table: string; optimization: string[] }>;
    templateContext: Array<{ variable: string; source: string; line: number }>;
    authenticationFlow: Array<{ method: string; protected: string; line: number }>;
  } {
    const requestFlow: Array<{ from: string; to: string; type: string }> = [];
    const databaseOperations: Array<{ type: string; table: string; optimization: string[] }> = [];
    const templateContext: Array<{ variable: string; source: string; line: number }> = [];
    const authenticationFlow: Array<{ method: string; protected: string; line: number }> = [];

    // Determine component type
    let componentType: 'model' | 'view' | 'form' | 'middleware' | 'admin' | 'unknown' = 'unknown';
    if (content.includes('class') && content.includes('models.Model')) {
      componentType = 'model';
    } else if (content.includes('def ') && (content.includes('request') || content.includes('self.'))) {
      componentType = 'view';
    } else if (content.includes('class') && content.includes('forms.Form')) {
      componentType = 'form';
    } else if (content.includes('class') && content.includes('Middleware')) {
      componentType = 'middleware';
    } else if (content.includes('class') && content.includes('admin.ModelAdmin')) {
      componentType = 'admin';
    }

    // Analyze request flow
    const requestPatterns = [
      { regex: /request\.(\w+)\s*=\s*([^;]+)/, type: 'request_assignment' },
      { regex: /(\w+)\s*=\s*request\.(\w+)/, type: 'request_extraction' },
      { regex: /context\s*\[\s*['"](\w+)['"]\s*\]\s*=\s*request\.(\w+)/, type: 'context_population' },
      { regex: /return\s+render\([^,]*,\s*['"]([^'"]+)['"]\s*,\s*context/, type: 'template_rendering' }
    ];

    requestPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        requestFlow.push({
          from: match[1] || match[2],
          to: match[2] || match[1],
          type: pattern.type
        });
      }
    });

    // Analyze database operations
    const dbPatterns = [
      { 
        regex: /\.objects\.(create|update|delete)\s*\(\s*([^)]*)\)/, 
        type: 'modification',
        extractTable: (match: RegExpMatchArray) => match[0].match(/(\w+)\.objects/)?.[1] || 'unknown'
      },
      { 
        regex: /\.objects\.(filter|exclude|get)\s*\(\s*([^)]*)\)/, 
        type: 'query',
        extractTable: (match: RegExpMatchArray) => match[0].match(/(\w+)\.objects/)?.[1] || 'unknown'
      },
      { 
        regex: /\.objects\.(all|first|last|count|exists)\s*\(/, 
        type: 'retrieval',
        extractTable: (match: RegExpMatchArray) => match[0].match(/(\w+)\.objects/)?.[1] || 'unknown'
      }
    ];

    dbPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const table = pattern.extractTable(match);
        const optimizations = this.extractQueryOptimizations(match[0]);
        
        databaseOperations.push({
          type: pattern.type,
          table,
          optimization: optimizations
        });
      }
    });

    // Analyze template context
    const contextPatterns = [
      { regex: /context\s*\[\s*['"](\w+)['"]\s*\]\s*=\s*(\w+)/, source: 'variable' },
      { regex: /context\s*\[\s*['"](\w+)['"]\s*\]\s*=\s*([^,]+)/, source: 'expression' },
      { regex: /{'\w+':\s*(\w+)},?\s*}/, source: 'dict_literal' }
    ];

    contextPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        templateContext.push({
          variable: match[1],
          source: pattern.source,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Analyze authentication flow
    const authPatterns = [
      { regex: /@login_required/, method: 'decorator', protected: 'entire_view' },
      { regex: /@permission_required\(['"]([^'"]+)['"]\)/, method: 'permission_check', protected: 'specific_permission' },
      { regex: /if\s+request\.user\.is_authenticated:/, method: 'manual_check', protected: 'conditional' },
      { regex: /login\s*\(\s*request\s*,\s*(\w+)\s*\)/, method: 'login_function', protected: 'user_session' },
      { regex: /logout\s*\(\s*request\s*\)/, method: 'logout_function', protected: 'session_clear' }
    ];

    authPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        authenticationFlow.push({
          method: pattern.method,
          protected: pattern.protected,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    return {
      componentType,
      requestFlow,
      databaseOperations,
      templateContext,
      authenticationFlow
    };
  }

  private analyzeORMPatterns(content: string): {
    relationships: Array<{ from: string; to: string; type: 'fk' | 'm2m' | 'o2o' }>;
    queries: Array<{ type: string; complexity: number; optimizations: string[] }>;
    nPlusOneIssues: Array<{ query: string; variable: string; line: number }>;
    indexes: Array<{ field: string; type: string; table: string }>;
  } {
    const relationships: Array<{ from: string; to: string; type: 'fk' | 'm2m' | 'o2o' }> = [];
    const queries: Array<{ type: string; complexity: number; optimizations: string[] }> = [];
    const nPlusOneIssues: Array<{ query: string; variable: string; line: number }> = [];
    const indexes: Array<{ field: string; type: string; table: string }> = [];

    // Analyze relationships
    const relationshipPatterns = [
      { type: 'fk', regex: /(\w+)\s*=\s*models\.ForeignKey\s*\(\s*['"]([^'"]+)['"]/ },
      { type: 'm2m', regex: /(\w+)\s*=\s*models\.ManyToManyField\s*\(\s*['"]([^'"]+)['"]/ },
      { type: 'o2o', regex: /(\w+)\s*=\s*models\.OneToOneField\s*\(\s*['"]([^'"]+)['"]/ }
    ];

    relationshipPatterns.forEach(relPattern => {
      let match;
      while ((match = relPattern.regex.exec(content)) !== null) {
        relationships.push({
          from: match[1],
          to: match[2],
          type: relPattern.type
        });
      }
    });

    // Analyze query complexity
    const queryPatterns = [
      { type: 'simple_filter', complexity: 1, regex: /\.objects\.filter\([^)]*\)/ },
      { type: 'chained_filter', complexity: 2, regex: /\.objects\.filter\([^)]*\)\.filter\([^)]*\)/ },
      { type: 'complex_filter', complexity: 3, regex: /\.objects\.filter\(.*Q\(.+\).*\)/ },
      { type: 'aggregate', complexity: 2, regex: /\.aggregate\([^)]*\)/ },
      { type: 'annotate', complexity: 2, regex: /\.annotate\([^)]*\)/ },
      { type: 'prefetch_related', complexity: 1, regex: /\.prefetch_related\([^)]*\)/ },
      { type: 'select_related', complexity: 1, regex: /\.select_related\([^)]*\)/ }
    ];

    queryPatterns.forEach(queryPattern => {
      let match;
      while ((match = queryPattern.regex.exec(content)) !== null) {
        const optimizations = this.extractQueryOptimizations(match[0]);
        queries.push({
          type: queryPattern.type,
          complexity: queryPattern.complexity,
          optimizations
        });
      }
    });

    // Detect N+1 issues
    const nPlusOnePatterns = [
      { regex: /for\s+(\w+)\s+in\s+(\w+)\.objects\.all\(\):/, variable: '$1', query: '$2.objects.all()' },
      { regex: /for\s+(\w+)\s+in\s+(\w+)\.objects\.filter\([^)]*\):/, variable: '$1', query: '$2.objects.filter()' },
      { regex: /for\s+(\w+)\s+in\s+(\w+)\.set\.all\(\):/, variable: '$1', query: '$2.set.all()' }
    ];

    nPlusOnePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        nPlusOneIssues.push({
          query: pattern.query.replace(/\$(\d+)/g, (m, num) => match[parseInt(num)]),
          variable: pattern.variable.replace(/\$(\d+)/g, (m, num) => match[parseInt(num)]),
          line
        });
      }
    });

    // Analyze indexes
    const indexPatterns = [
      { regex: /class\s+Meta:\s*indexes\s*=\s*\[([^\]]+)\]/, type: 'composite' },
      { regex: /db_index\s*=\s*True/, type: 'single_field' }
    ];

    indexPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const table = this.extractTableName(content);
        indexes.push({
          field: match[1] || 'unknown',
          type: pattern.type,
          table
        });
      }
    });

    return {
      relationships,
      queries,
      nPlusOneIssues,
      indexes
    };
  }

  private analyzeDjangoSecurity(content: string): {
    vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number; description: string }>;
    protections: Array<{ type: string; method: string; line: number }>;
    dataValidation: Array<{ field: string; validator: string; line: number }>;
  } {
    const vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number; description: string }> = [];
    const protections: Array<{ type: string; method: string; line: number }> = [];
    const dataValidation: Array<{ field: string; validator: string; line: number }> = [];

    // Security vulnerability detection
    const vulnPatterns = [
      {
        type: 'sql_injection',
        severity: 'HIGH' as const,
        regex: /\.raw\s*\(\s*['"]\s*[^'"]*\s*\+\s*[^'"]+\s*['"]\s*\)/,
        description: 'Raw SQL query with string concatenation - potential SQL injection'
      },
      {
        type: 'xss',
        severity: 'HIGH' as const,
        regex: /return\s+HttpResponse\s*\(\s*[^)]*\+\s*request\.(GET|POST)\.get\(/,
        description: 'Direct output of user input without sanitization - potential XSS'
      },
      {
        type: 'csrf_missing',
        severity: 'MEDIUM' as const,
        regex: /@csrf_exempt/,
        description: 'CSRF protection disabled - ensure this is intentional'
      },
      {
        type: 'mass_assignment',
        severity: 'MEDIUM' as const,
        regex: /form\s*=\s*\w+Form\s*\(\s*request\.POST\s*,\s*instance=\w+\)/,
        description: 'Form bound to model instance without proper field restriction'
      },
      {
        type: 'directory_traversal',
        severity: 'HIGH' as const,
        regex: /open\s*\(\s*['"]\s*\+\s*request\.(GET|POST)\.get\(/,
        description: 'File path constructed from user input - potential directory traversal'
      }
    ];

    vulnPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        vulnerabilities.push({
          type: pattern.type,
          severity: pattern.severity,
          line: this.getLineNumber(content, match.index),
          description: pattern.description
        });
      }
    });

    // Security protection detection
    const protectionPatterns = [
      { type: 'csrf', method: 'default_protection', regex: /from\s+django\.middleware\.csrf/ },
      { type: 'xss', method: 'auto_escaping', regex: /{% autoescape on %}/ },
      { type: 'auth', method: 'login_required', regex: /@login_required/ },
      { type: 'auth', method: 'permission_check', regex: /@permission_required/ },
      { type: 'validation', method: 'form_validation', regex: /form\.is_valid\(\)/ },
      { type: 'sanitization', method: 'escape_filter', regex: /\|escape/ }
    ];

    protectionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        protections.push({
          type: pattern.type,
          method: pattern.method,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Data validation analysis
    const validationPatterns = [
      { regex: /def\s+clean_(\w+)\s*\(/, field: '$1', validator: 'custom_clean' },
      { regex: /(\w+)\s*=\s*models\.CharField\s*\([^)]*validators=\[([^\]]+)\]/, field: '$1', validator: 'custom_validators' },
      { regex: /(\w+)\s*=\s*models\.EmailField\s*\(/, field: '$1', validator: 'email_validation' },
      { regex: /(\w+)\s*=\s*models\.URLField\s*\(/, field: '$1', validator: 'url_validation' }
    ];

    validationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        dataValidation.push({
          field: pattern.field.replace(/\$(\d+)/g, (m, num) => match[parseInt(num)]),
          validator: pattern.validator,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    return {
      vulnerabilities,
      protections,
      dataValidation
    };
  }

  private extractQueryOptimizations(query: string): string[] {
    const optimizations: string[] = [];
    
    if (query.includes('.select_related(')) optimizations.push('select_related');
    if (query.includes('.prefetch_related(')) optimizations.push('prefetch_related');
    if (query.includes('.only(')) optimizations.push('only_fields');
    if (query.includes('.defer(')) optimizations.push('defer_fields');
    if (query.includes('.annotate(')) optimizations.push('annotate');
    if (query.includes('.aggregate(')) optimizations.push('aggregate');
    if (query.includes('Q(')) optimizations.push('q_objects');
    if (query.includes('F(')) optimizations.push('f_expressions');
    
    return optimizations;
  }

  private extractTableName(content: string): string {
    const modelMatch = content.match(/class\s+(\w+)\s*\([^)]*models\.Model[^)]*\)/);
    return modelMatch ? modelMatch[1].toLowerCase() : 'unknown';
  }

  private calculateDjangoComplexity(content: string, djangoAnalysis: any, ormAnalysis: any): number {
    let complexity = this.calculateComplexity(content);
    
    // Django-specific complexity factors
    complexity += djangoAnalysis.requestFlow.length * 1;
    complexity += djangoAnalysis.databaseOperations.length * 2;
    complexity += djangoAnalysis.templateContext.length * 1;
    complexity += djangoAnalysis.authenticationFlow.length * 2;
    
    // ORM complexity
    complexity += ormAnalysis.relationships.length * 2;
    complexity += ormAnalysis.queries.reduce((sum: number, q: any) => sum + q.complexity, 0);
    complexity += ormAnalysis.nPlusOneIssues.length * 5;
    complexity += ormAnalysis.indexes.length * 1;
    
    // Security complexity
    complexity += djangoAnalysis.security.vulnerabilities.length * 5;
    complexity += djangoAnalysis.security.protections.length * 1;
    complexity += djangoAnalysis.security.dataValidation.length * 1;
    
    return Math.round(complexity);
  }

  private isStandaloneDjangoComponent(node: Parser.SyntaxNode, content: string): boolean {
    const standalonePatterns = [
      /class\s+\w+\s*\(\s*models\.Model\s*\)/,
      /class\s+\w+View\s*\(/,
      /class\s+\w+Form\s*\(/,
      /def\s+\w+\s*\(\s*request\s*,/,
      /@csrf_exempt/,
      /@login_required/
    ];

    return standalonePatterns.some(pattern => pattern.test(content));
  }

  private hasDjangoSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\.save\(\)/,
      /\.delete\(\)/,
      /\.create\(\)/,
      /\.update\(\)/,
      /render\(/,
      /redirect\(/,
      /HttpResponse\(/,
      /JsonResponse\(/,
      /login\(/,
      /logout\(/,
      /messages\.(success|error|warning|info)\(/,
      /send_mail\(/,
      /cache\.(set|get|delete)\(/
    ];

    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  private extractDjangoImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement' || n.type === 'import_from_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('django')) {
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
    return []; // Django typically doesn't use exports in the same way
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return (beforeIndex.match(/\n/g) || []).length + 1;
  }
}