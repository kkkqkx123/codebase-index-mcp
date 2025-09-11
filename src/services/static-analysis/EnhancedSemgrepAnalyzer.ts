import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';

export interface CFGNode {
  id: string;
  type: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  content: string;
}

export interface CFGEdge {
  from: string;
  to: string;
  type: string;
  condition?: string;
}

export interface CFGResult {
  nodes: CFGNode[];
  edges: CFGEdge[];
  entryPoint: string;
  exitPoints: string[];
  functions: string[];
}

export interface DataFlowResult {
  variables: Array<{
    name: string;
    type: string;
    scope: string;
    definitions: Array<{
      file: string;
      line: number;
      column: number;
    }>;
    uses: Array<{
      file: string;
      line: number;
      column: number;
    }>;
  }>;
  flows: Array<{
    from: string;
    to: string;
    variable: string;
    type: string;
  }>;
  taintSources: string[];
  taintSinks: string[];
}

export interface SecurityResult {
  issues: Array<{
    type: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    location: {
      file: string;
      line: number;
      column: number;
    };
    code: string;
    remediation?: string;
  }>;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface AnalysisResult {
  controlFlow: CFGResult;
  dataFlow: DataFlowResult;
  securityIssues: SecurityResult;
  metrics: {
    linesOfCode: number;
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
  };
}

@injectable()
export class EnhancedSemgrepAnalyzer {
  private readonly logger: LoggerService;
  private readonly config: ConfigService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ConfigService) config?: ConfigService
  ) {
    this.logger = logger || {
      info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
      debug: (message: string, meta?: any) => console.log(`[DEBUG] ${message}`, meta || ''),
      warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
      error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
    } as LoggerService;
    
    this.config = config || {
      get: (key: string) => {
        const defaults: Record<string, any> = {
          'analysis.maxFileSize': 1048576,
          'analysis.timeout': 30000,
          'analysis.ignorePatterns': ['node_modules', 'dist', 'coverage'],
          'analysis.severityThreshold': 'medium'
        };
        return defaults[key];
      }
    } as ConfigService;
  }

  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    this.logger.info(`Starting enhanced analysis for project: ${projectPath}`);
    
    try {
      const [controlFlow, dataFlow, securityIssues] = await Promise.all([
        this.analyzeControlFlow(projectPath),
        this.analyzeDataFlow(projectPath),
        this.detectSecurityPatterns(projectPath)
      ]);

      const metrics = await this.calculateMetrics(projectPath);

      return {
        controlFlow,
        dataFlow,
        securityIssues,
        metrics
      };
    } catch (error) {
      this.logger.error('Enhanced analysis failed', { error, projectPath });
      throw error;
    }
  }

  async analyzeControlFlow(projectPath: string): Promise<CFGResult> {
    const rules = [
      'control-flow/basic-cfg.yml',
      'control-flow/cross-function-analysis.yml'
    ];

    this.logger.debug('Running control flow analysis', { rules, projectPath });
    
    const rawResults = await this.runAdvancedScan(projectPath, rules);
    return this.processCFGResults(rawResults);
  }

  async analyzeDataFlow(variablePattern?: string): Promise<DataFlowResult> {
    const rules = [
      'data-flow/taint-analysis.yml'
    ];

    this.logger.debug('Running data flow analysis', { rules, variablePattern });
    
    const rawResults = await this.runAdvancedScan('.', rules, variablePattern);
    return this.processDataFlowResults(rawResults);
  }

  async detectSecurityPatterns(projectPath?: string): Promise<SecurityResult> {
    const rules = [
      'security/sql-injection.yml',
      'security/xss-detection.yml',
      'security/path-traversal.yml',
      'security/command-injection.yml',
      'security/authentication-bypass.yml',
      'security/authorization-flaws.yml',
      'security/cryptographic-issues.yml',
      'security/insecure-deserialization.yml'
    ];

    this.logger.debug('Running security pattern detection', { rules, projectPath });
    
    const rawResults = await this.runAdvancedScan(projectPath || '.', rules);
    return this.processSecurityResults(rawResults);
  }

  private async runAdvancedScan(
    projectPath: string, 
    rules: string[], 
    variablePattern?: string
  ): Promise<any[]> {
    const semgrepPath = (this.config.get('staticAnalysis' as any) as any)?.semgrep?.cliPath || 'semgrep';
    const enhancedRulesPath = './enhanced-rules';
    
    const rulePaths = rules.map(rule => `${enhancedRulesPath}/${rule}`);
    
    const { execSync } = require('child_process');
    const command = [
      semgrepPath,
      '--config=' + rulePaths.join(','),
      '--json',
      '--time',
      '--timeout=300',
      variablePattern ? `--pattern=${variablePattern}` : '',
      projectPath
    ].filter(Boolean).join(' ');

    try {
      const output = execSync(command, { 
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      });
      
      const result = JSON.parse(output);
      return result.results || [];
    } catch (error) {
      this.logger.error('Semgrep scan failed', { error, command });
      return [];
    }
  }

  private processCFGResults(rawResults: any[]): CFGResult {
    const nodes: CFGNode[] = [];
    const edges: CFGEdge[] = [];
    const functions: string[] = [];
    const entryPoints: string[] = [];
    const exitPoints: string[] = [];

    rawResults.forEach(result => {
      if (result.extra && result.extra.metavars) {
        const node: CFGNode = {
          id: result.check_id + '_' + result.path + '_' + result.start.line,
          type: result.check_id,
          location: {
            file: result.path,
            line: result.start.line,
            column: result.start.col
          },
          content: result.extra.lines || ''
        };
        nodes.push(node);

        if (result.check_id.includes('function')) {
          functions.push(result.extra.metavars.$FUNCTION_NAME?.abstract_content || 'unknown');
        }
      }
    });

    return {
      nodes,
      edges,
      entryPoint: entryPoints[0] || 'main',
      exitPoints,
      functions
    };
  }

  private processDataFlowResults(rawResults: any[]): DataFlowResult {
    const variables = new Map<string, any>();
    const flows: Array<{
      from: string;
      to: string;
      variable: string;
      type: string;
    }> = [];
    const taintSources: string[] = [];
    const taintSinks: string[] = [];

    rawResults.forEach(result => {
      if (result.extra && result.extra.metavars) {
        const varName = result.extra.metavars.$VARIABLE?.abstract_content ||
                       result.extra.metavars.$SOURCE?.abstract_content ||
                       'unknown';
        
        if (!variables.has(varName)) {
          variables.set(varName, {
            name: varName,
            type: 'unknown',
            scope: result.path,
            definitions: [],
            uses: []
          });
        }

        const variable = variables.get(varName);
        
        if (result.check_id.includes('source')) {
          variable.definitions.push({
            file: result.path,
            line: result.start.line,
            column: result.start.col
          });
          taintSources.push(varName);
        } else if (result.check_id.includes('sink')) {
          variable.uses.push({
            file: result.path,
            line: result.start.line,
            column: result.start.col
          });
          taintSinks.push(varName);
        }
      }
    });

    return {
      variables: Array.from(variables.values()),
      flows,
      taintSources: Array.from(taintSources),
      taintSinks: Array.from(taintSinks)
    };
  }

  private processSecurityResults(rawResults: any[]): SecurityResult {
    const issues: SecurityResult['issues'] = [];

    rawResults.forEach(result => {
      const issue = {
        type: result.check_id,
        severity: this.mapSeverity(result.extra?.severity || 'MEDIUM'),
        message: result.extra?.message || result.check_id,
        location: {
          file: result.path,
          line: result.start.line,
          column: result.start.col
        },
        code: result.extra?.lines || '',
        remediation: result.extra?.remediation
      };
      issues.push(issue);
    });

    const summary = {
      total: issues.length,
      high: issues.filter(i => i.severity === 'HIGH').length,
      medium: issues.filter(i => i.severity === 'MEDIUM').length,
      low: issues.filter(i => i.severity === 'LOW').length
    };

    return { issues, summary };
  }

  private mapSeverity(severity: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    const mapping: Record<string, 'HIGH' | 'MEDIUM' | 'LOW'> = {
      'ERROR': 'HIGH',
      'WARNING': 'MEDIUM',
      'INFO': 'LOW'
    };
    return mapping[severity.toUpperCase()] || 'MEDIUM';
  }

  private async calculateMetrics(projectPath: string): Promise<{
    linesOfCode: number;
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
  }> {
    // 简化的代码度量计算
    return {
      linesOfCode: 0,
      cyclomaticComplexity: 0,
      maintainabilityIndex: 0
    };
  }
}