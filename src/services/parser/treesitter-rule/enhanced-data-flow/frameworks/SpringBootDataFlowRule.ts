import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * Spring Boot Framework Data Flow Rule
 * 
 * Specialized data flow analysis for Spring Boot applications, focusing on:
 * - Dependency injection patterns
 * - REST API endpoint handling
 * - Data persistence with JPA/Hibernate
 * - Transaction management
 * - Security and authentication patterns
 * - Aspect-Oriented Programming (AOP) usage
 */
export class SpringBootDataFlowRule extends AbstractSnippetRule {
  readonly name = 'SpringBootDataFlowRule';
  readonly supportedNodeTypes = new Set([
    'class_declaration', 'interface_declaration', 'method_declaration',
    'method_invocation', 'field_declaration', 'variable_declarator',
    'annotation', 'parameter_declaration', 'return_statement',
    'try_statement', 'catch_clause', 'finally_clause'
  ]);

  protected readonly snippetType: 'control_structure' | 'error_handling' | 'function_call_chain' | 'expression_sequence' | 'comment_marked' | 'logic_block' | 'object_array_literal' | 'arithmetic_logical_expression' | 'template_literal' | 'destructuring_assignment' = 'logic_block';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    
    // Check if it's Spring Boot-related code
    return this.isSpringBootCode(content) && this.hasSpringBootDataFlow(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    // Spring Boot-specific data flow analysis
    const springAnalysis = this.analyzeSpringBootDataFlow(node, content, sourceCode);
    const diAnalysis = this.analyzeDependencyInjection(content);
    const securityAnalysis = this.analyzeSpringSecurity(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractSpringImports(node, sourceCode),
      exports: this.extractExports(node, sourceCode),
      metadata: {
        springBoot: springAnalysis,
        dependencyInjection: diAnalysis,
        security: securityAnalysis
      },
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateSpringComplexity(content, springAnalysis, diAnalysis),
        isStandalone: this.isStandaloneSpringComponent(node, content),
        hasSideEffects: this.hasSpringSideEffects(content)
      }
    };
  }

  private isSpringBootCode(content: string): boolean {
    const springPatterns = [
      /@SpringBootApplication/,
      /@RestController/,
      /@Controller/,
      /@Service/,
      /@Repository/,
      /@Component/,
      /@Autowired/,
      /@RequestMapping/,
      /@GetMapping/,
      /@PostMapping/,
      /@PutMapping/,
      /@DeleteMapping/,
      /@Entity/,
      /@Table/,
      /@Id/,
      /@GeneratedValue/,
      /@Column/,
      /@OneToMany/,
      /@ManyToOne/,
      /@ManyToMany/,
      /@OneToOne/,
      /@Transactional/,
      /@Configuration/,
      /@Bean/,
      /@Value/,
      /@Profile/,
      /@ConditionalOn/,
      /org\.springframework/,
      /springframework\./,
      /javax\.persistence/,
      /jakarta\.persistence/,
      /JpaRepository/,
      /CrudRepository/
    ];

    return springPatterns.some(pattern => pattern.test(content));
  }

  private hasSpringBootDataFlow(content: string): boolean {
    const dataFlowPatterns = [
      // REST API endpoints
      /@(Get|Post|Put|Delete)Mapping\(['"]\/?[^'"]*['"]\)/,
      
      // Dependency injection
      /@Autowired\s+\w+\s+\w+/,
      /private\s+\w+\s+\w+;/,
      
      // Request handling
      /public\s+\w+\s+\w+\s*\(\s*[^)]*request[^)]*\)/,
      /@RequestBody\s+\w+\s+\w+/,
      /@PathVariable\s+\w+\s+\w+/,
      /@RequestParam\s+\w+\s+\w+/,
      
      // Response handling
      /return\s+ResponseEntity\./,
      /return\s+new\s+ResponseEntity/,
      
      // Database operations
      /\.save\(/,
      /\.findById\(/,
      /\.findAll\(/,
      /\.deleteById\(/,
      /\.deleteAll\(/,
      
      // Transaction management
      /@Transactional\s*\(/,
      /@Transactional\s*\n/,
      
      // Data binding
      /@Valid/,
      /BindingResult/,
      /Model\s+\w+/,
      /ModelAndView/,
      
      // Security
      /@PreAuthorize/,
      /@PostAuthorize/,
      /@Secured/,
      /@RolesAllowed/,
      
      // Configuration
      /@Configuration/,
      /@Bean\s*\n/,
      /@Value\s*\(\s*['"]\$\{([^}]+)\}/
    ];

    return dataFlowPatterns.some(pattern => pattern.test(content));
  }

  private analyzeSpringBootDataFlow(
    node: Parser.SyntaxNode,
    content: string,
    sourceCode: string
  ): {
    componentType: 'controller' | 'service' | 'repository' | 'entity' | 'configuration' | 'unknown';
    apiEndpoints: Array<{ path: string; method: string; parameters: string[] }>;
    dataFlow: Array<{ from: string; to: string; type: string; annotations: string[] }>;
    databaseOperations: Array<{ type: string; entity: string; transaction: boolean }>;
    configuration: Array<{ type: string; bean: string; properties: string[] }>;
  } {
    const apiEndpoints: Array<{ path: string; method: string; parameters: string[] }> = [];
    const dataFlow: Array<{ from: string; to: string; type: string; annotations: string[] }> = [];
    const databaseOperations: Array<{ type: string; entity: string; transaction: boolean }> = [];
    const configuration: Array<{ type: string; bean: string; properties: string[] }> = [];

    // Determine component type
    let componentType: 'controller' | 'service' | 'repository' | 'entity' | 'configuration' | 'unknown' = 'unknown';
    if (content.includes('@RestController') || content.includes('@Controller')) {
      componentType = 'controller';
    } else if (content.includes('@Service')) {
      componentType = 'service';
    } else if (content.includes('@Repository') || content.includes('JpaRepository')) {
      componentType = 'repository';
    } else if (content.includes('@Entity') || content.includes('@Table')) {
      componentType = 'entity';
    } else if (content.includes('@Configuration') || content.includes('@Bean')) {
      componentType = 'configuration';
    }

    // Analyze API endpoints
    const endpointPatterns = [
      { method: 'GET', regex: /@GetMapping\(['"]([^'"]+)['"]\)\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/ },
      { method: 'POST', regex: /@PostMapping\(['"]([^'"]+)['"]\)\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/ },
      { method: 'PUT', regex: /@PutMapping\(['"]([^'"]+)['"]\)\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/ },
      { method: 'DELETE', regex: /@DeleteMapping\(['"]([^'"]+)['"]\)\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/ }
    ];

    endpointPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const parameters = match[3].split(',').map(p => p.trim()).filter(p => p.length > 0);
        apiEndpoints.push({
          path: match[1],
          method: pattern.method,
          parameters
        });
      }
    });

    // Analyze data flow
    const flowPatterns = [
      {
        regex: /@Autowired\s+private\s+(\w+)\s+(\w+);/,
        type: 'field_injection',
        extractFlow: (match: RegExpMatchArray) => ({ from: 'container', to: match[2], type: match[1] })
      },
      {
        regex: /@RequestMapping\s*\([^)]*\)\s*public\s+\w+\s+(\w+)\s*\([^)]*\)\s*{/,
        type: 'request_handling',
        extractFlow: (match: RegExpMatchArray) => ({ from: 'client', to: match[1], type: 'http_request' })
      },
      {
        regex: /return\s+ResponseEntity\.ok\s*\(\s*(\w+)\s*\)/,
        type: 'response_return',
        extractFlow: (match: RegExpMatchArray) => ({ from: match[1], to: 'client', type: 'http_response' })
      }
    ];

    flowPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const flow = pattern.extractFlow(match);
        const annotations = this.extractAnnotations(content, match.index);
        dataFlow.push({
          from: flow.from,
          to: flow.to,
          type: pattern.type,
          annotations
        });
      }
    });

    // Analyze database operations
    const dbPatterns = [
      { type: 'save', regex: /\.save\s*\(\s*(\w+)\s*\)/ },
      { type: 'findById', regex: /\.findById\s*\(\s*(\w+)\s*\)/ },
      { type: 'findAll', regex: /\.findAll\s*\(\)/ },
      { type: 'deleteById', regex: /\.deleteById\s*\(\s*(\w+)\s*\)/ },
      { type: 'deleteAll', regex: /\.deleteAll\s*\(\)/ }
    ];

    dbPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const transaction = this.isInTransaction(content, match.index);
        databaseOperations.push({
          type: pattern.type,
          entity: match[1] || 'unknown',
          transaction
        });
      }
    });

    // Analyze configuration
    const configPatterns = [
      {
        type: 'bean_definition',
        regex: /@Bean\s*public\s+(\w+)\s+(\w+)\s*\(\s*([^)]*)\s*\)/,
        extractBean: (match: RegExpMatchArray) => match[2]
      },
      {
        type: 'property_injection',
        regex: /@Value\s*\(\s*['"]\$\{([^}]+)\}['"]\s*\)\s*private\s+\w+\s+(\w+)/,
        extractBean: (match: RegExpMatchArray) => match[2],
        extractProps: (match: RegExpMatchArray) => [match[1]]
      }
    ];

    configPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const bean = pattern.extractBean(match);
        const properties = pattern.extractProps ? pattern.extractProps(match) : [];
        configuration.push({
          type: pattern.type,
          bean,
          properties
        });
      }
    });

    return {
      componentType,
      apiEndpoints,
      dataFlow,
      databaseOperations,
      configuration
    };
  }

  private analyzeDependencyInjection(content: string): {
    injections: Array<{ field: string; type: string; method: 'field' | 'constructor' | 'setter'; line: number }>;
    beans: Array<{ name: string; type: string; scope: string }>;
    circularDependencies: Array<{ from: string; to: string }>;
    qualifiers: Array<{ field: string; qualifier: string; line: number }>;
  } {
    const injections: Array<{ field: string; type: string; method: 'field' | 'constructor' | 'setter'; line: number }> = [];
    const beans: Array<{ name: string; type: string; scope: string }> = [];
    const circularDependencies: Array<{ from: string; to: string }> = [];
    const qualifiers: Array<{ field: string; qualifier: string; line: number }> = [];

    // Analyze injection patterns
    const injectionPatterns = [
      {
        method: 'field' as const,
        regex: /@Autowired\s+private\s+(\w+)\s+(\w+)\s*;/,
        extractFields: (match: RegExpMatchArray) => ({ field: match[2], type: match[1] })
      },
      {
        method: 'constructor' as const,
        regex: /public\s+(\w+)\s*\(\s*@Autowired\s*(\w+)\s+(\w+)\s*\)/,
        extractFields: (match: RegExpMatchArray) => ({ field: match[3], type: match[2] })
      },
      {
        method: 'setter' as const,
        regex: /@Autowired\s*public\s+void\s+set(\w+)\s*\(\s*(\w+)\s+(\w+)\s*\)/,
        extractFields: (match: RegExpMatchArray) => ({ field: match[3], type: match[2] })
      }
    ];

    injectionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const fields = pattern.extractFields(match);
        injections.push({
          field: fields.field,
          type: fields.type,
          method: pattern.method,
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Analyze bean definitions
    const beanPatterns = [
      {
        scope: 'singleton',
        regex: /@Bean\s*public\s+(\w+)\s+(\w+)\s*\(/,
        extractBean: (match: RegExpMatchArray) => ({ name: match[2], type: match[1] })
      },
      {
        scope: 'prototype',
        regex: /@Bean\s*@Scope\s*['"]prototype['"]\s*public\s+(\w+)\s+(\w+)\s*\(/,
        extractBean: (match: RegExpMatchArray) => ({ name: match[2], type: match[1] })
      }
    ];

    beanPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const bean = pattern.extractBean(match);
        beans.push({
          name: bean.name,
          type: bean.type,
          scope: pattern.scope
        });
      }
    });

    // Analyze qualifiers
    const qualifierPatterns = [
      { regex: /@Qualifier\s*\(\s*['"]([^'"]+)['"]\s*\)\s*private\s+\w+\s+(\w+)/ },
      { regex: /@Autowired\s*@Qualifier\s*\(\s*['"]([^'"]+)['"]\s*\)\s*private\s+\w+\s+(\w+)/ }
    ];

    qualifierPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        qualifiers.push({
          field: match[2],
          qualifier: match[1],
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Detect potential circular dependencies
    injections.forEach(injection => {
      const targetBean = beans.find(bean => bean.type === injection.type);
      if (targetBean) {
        const targetInjection = injections.find(inj => inj.type === targetBean.type);
        if (targetInjection) {
          circularDependencies.push({
            from: injection.field,
            to: targetInjection.field
          });
        }
      }
    });

    return {
      injections,
      beans,
      circularDependencies,
      qualifiers
    };
  }

  private analyzeSpringSecurity(content: string): {
    authentication: Array<{ method: string; endpoint: string; line: number }>;
    authorization: Array<{ endpoint: string; roles: string[]; line: number }>;
    vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number; description: string }>;
    csrfProtection: boolean;
    cors: { enabled: boolean; origins: string[] };
  } {
    const authentication: Array<{ method: string; endpoint: string; line: number }> = [];
    const authorization: Array<{ endpoint: string; roles: string[]; line: number }> = [];
    const vulnerabilities: Array<{ type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; line: number; description: string }> = [];
    
    let csrfProtection = false;
    let cors = { enabled: false, origins: [] as string[] };

    // Authentication analysis
    const authPatterns = [
      { method: 'jwt', regex: /@PreAuthorize\(['"]isAuthenticated\(\)['"]\)/ },
      { method: 'basic', regex: /httpBasic\(\)/ },
      { method: 'form', regex: /formLogin\(\)/ },
      { method: 'oauth2', regex: /oauth2Login\(\)/ }
    ];

    authPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        authentication.push({
          method: pattern.method,
          endpoint: 'global',
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Authorization analysis
    const authzPatterns = [
      { regex: /@PreAuthorize\(['"]hasRole\s*\(\s*['"]([^'"]+)['"]\s*\)['"]\)/ },
      { regex: /@Secured\s*\(\s*['"]ROLE_([^'"]+)['"]\s*\)/ },
      { regex: /@RolesAllowed\s*\(\s*['"]([^'"]+)['"]\s*\)/ }
    ];

    authzPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        authorization.push({
          endpoint: 'method',
          roles: [match[1]],
          line: this.getLineNumber(content, match.index)
        });
      }
    });

    // Vulnerability detection
    const vulnPatterns = [
      {
        type: 'sql_injection',
        severity: 'HIGH' as const,
        regex: /@Query\s*\(\s*['"]\s*[^'"]*\s*\+\s*[^'"]+\s*['"]\s*\)/,
        description: 'Raw SQL query with string concatenation - potential SQL injection'
      },
      {
        type: 'xss',
        severity: 'HIGH' as const,
        regex: /return\s+['"]\s*[^'"]*\s*\+\s*\w+\s*['"]\s*;/,
        description: 'Direct string concatenation in response - potential XSS'
      },
      {
        type: 'path_traversal',
        severity: 'HIGH' as const,
        regex: /Files\.read\s*\(\s*Paths\.get\s*\(\s*[^,]+,\s*[^)]*\)/,
        description: 'File path constructed from user input - potential path traversal'
      },
      {
        type: 'missing_auth',
        severity: 'MEDIUM' as const,
        regex: /@(Get|Post|Put|Delete)Mapping\([^)]*\)\s*public\s+\w+\s+\w+\s*\([^)]*\)\s*{/,
        description: 'REST endpoint without authentication - ensure this is intended'
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

    // CSRF protection detection
    csrfProtection = content.includes('csrf().disable()') ? false : true;

    // CORS configuration
    if (content.includes('cors()')) {
      cors.enabled = true;
      const corsMatch = content.match(/allowedOrigins\s*\(\s*\[([^\]]+)\]\s*\)/);
      if (corsMatch) {
        cors.origins = corsMatch[1].split(',').map(o => o.trim().replace(/['"]/g, ''));
      }
    }

    return {
      authentication,
      authorization,
      vulnerabilities,
      csrfProtection,
      cors
    };
  }

  private extractAnnotations(content: string, index: number): string[] {
    const annotations: string[] = [];
    const linesBefore = content.substring(0, index).split('\n');
    
    for (let i = linesBefore.length - 1; i >= 0; i--) {
      const line = linesBefore[i].trim();
      if (line.startsWith('@')) {
        annotations.push(line);
      } else if (line.length > 0 && !line.startsWith('*')) {
        break;
      }
    }
    
    return annotations.reverse();
  }

  private isInTransaction(content: string, index: number): boolean {
    const linesAfter = content.substring(index).split('\n');
    
    for (let i = 0; i < Math.min(10, linesAfter.length); i++) {
      if (linesAfter[i].includes('@Transactional')) {
        return true;
      }
    }
    
    return false;
  }

  private calculateSpringComplexity(content: string, springAnalysis: any, diAnalysis: any): number {
    let complexity = this.calculateComplexity(content);
    
    // Spring Boot-specific complexity factors
    complexity += springAnalysis.apiEndpoints.length * 2;
    complexity += springAnalysis.dataFlow.length * 1;
    complexity += springAnalysis.databaseOperations.length * 2;
    complexity += springAnalysis.configuration.length * 1;
    
    // Dependency injection complexity
    complexity += diAnalysis.injections.length * 1;
    complexity += diAnalysis.beans.length * 2;
    complexity += diAnalysis.circularDependencies.length * 5;
    complexity += diAnalysis.qualifiers.length * 1;
    
    // Security complexity
    complexity += springAnalysis.security.authentication.length * 2;
    complexity += springAnalysis.security.authorization.length * 2;
    complexity += springAnalysis.security.vulnerabilities.length * 5;
    
    return Math.round(complexity);
  }

  private isStandaloneSpringComponent(node: Parser.SyntaxNode, content: string): boolean {
    const standalonePatterns = [
      /@RestController/,
      /@Service/,
      /@Repository/,
      /@Entity/,
      /@Configuration/,
      /@SpringBootApplication/,
      /@Component/
    ];

    return standalonePatterns.some(pattern => pattern.test(content));
  }

  private hasSpringSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\.save\s*\(/,
      /\.delete\s*\(/,
      /\.update\s*\(/,
      /ResponseEntity\./,
      /throw new/,
      /log\./,
      /System\.out\.print/,
      /@EventListener/,
      /@Scheduled/,
      /@Async/,
      /@Cacheable/,
      /@CacheEvict/,
      /@CachePut/,
      /@Transactional/
    ];

    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  private extractSpringImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_declaration') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('org.springframework') || 
            importText.includes('javax.persistence') ||
            importText.includes('jakarta.persistence') ||
            importText.includes('org.springframework.data')) {
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
    return []; // Java doesn't use exports in the same way
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return (beforeIndex.match(/\n/g) || []).length + 1;
  }
}