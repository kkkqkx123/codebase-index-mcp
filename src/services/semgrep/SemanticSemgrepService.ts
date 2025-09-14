import { inject, injectable } from 'inversify';
import { SemgrepScanService } from './SemgrepScanService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../types';

export interface EnhancedSemgrepResult {
  ruleId: string;
  findings: EnhancedFinding[];
  metadata: AnalysisMetadata;
}

export interface EnhancedFinding {
  location: Location;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  code: string;
  context: ContextInfo;
  semanticData?: SemanticData;
}

export interface Location {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface ContextInfo {
  function: string;
  class: string;
  complexity: number;
  nestingLevel: number;
}

export interface SemanticData {
  controlFlow?: ControlFlowData;
  dataFlow?: DataFlowData;
  callGraph?: CallGraphData;
}

export interface ControlFlowData {
  complexity: number;
  nestingDepth: number;
  loopPatterns: string[];
  unreachableCode: string[];
}

export interface DataFlowData {
  taintSources: string[];
  sanitizationPoints: string[];
  dataDependencies: Dependency[];
}

export interface CallGraphData {
  functions: string[];
  calls: CallEdge[];
  pureFunctions: string[];
}

export interface CallEdge {
  from: string;
  to: string;
  type: 'direct' | 'indirect';
}

export interface Dependency {
  from: string;
  to: string;
  type: 'data' | 'control';
}

export interface AnalysisMetadata {
  totalFiles: number;
  totalFindings: number;
  analysisTime: number;
  rulesApplied: string[];
}

export interface SemanticAnalysisOptions {
  includeControlFlow: boolean;
  includeDataFlow: boolean;
  includeCallGraph: boolean;
  severityFilter?: string[];
  maxComplexity?: number;
}

@injectable()
export class SemanticSemgrepService {
  private enhancedRulesPath: string;

  constructor(
    @inject(TYPES.SemgrepScanService) private semgrepService: SemgrepScanService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(ConfigService) private configService: ConfigService
  ) {
    this.enhancedRulesPath = this.configService.get('semgrep').enhancedRulesPath;
  }

  async runSemanticAnalysis(
    projectPath: string,
    options: SemanticAnalysisOptions = {
      includeControlFlow: true,
      includeDataFlow: true,
      includeCallGraph: true
    }
  ): Promise<EnhancedSemgrepResult[]> {
    try {
      this.logger.info(`Starting semantic analysis for ${projectPath}`);

      const results: EnhancedSemgrepResult[] = [];
      const rules = this.getSemanticRules(options);

      for (const rule of rules) {
        const scanResult = await this.semgrepService.scanProject(projectPath, {
          rules: [rule.path]
        });

        const enhancedResult = await this.enhanceResults(scanResult, rule.type, options);
        results.push(enhancedResult);
      }

      return results;
    } catch (error) {
      this.logger.error(`Semantic analysis failed: ${error}`);
      throw error;
    }
  }

  async runControlFlowAnalysis(
    projectPath: string,
    options: Partial<SemanticAnalysisOptions> = {}
  ): Promise<EnhancedSemgrepResult> {
    const rules = [
      `${this.enhancedRulesPath}/control-flow/enhanced-cfg-analysis.yml`,
      `${this.enhancedRulesPath}/control-flow/complex-nested-conditions.yml`,
      `${this.enhancedRulesPath}/control-flow/loop-invariant-code.yml`
    ];

    return this.runRuleAnalysis(projectPath, rules, 'control-flow', {
      ...options,
      includeControlFlow: true
    });
  }

  async runDataFlowAnalysis(
    projectPath: string,
    options: Partial<SemanticAnalysisOptions> = {}
  ): Promise<EnhancedSemgrepResult> {
    const rules = [
      `${this.enhancedRulesPath}/data-flow/advanced-taint-analysis.yml`,
      `${this.enhancedRulesPath}/data-flow/cross-function-taint.yml`,
      `${this.enhancedRulesPath}/data-flow/resource-leak-detection.yml`
    ];

    return this.runRuleAnalysis(projectPath, rules, 'data-flow', {
      ...options,
      includeDataFlow: true
    });
  }

  private async runRuleAnalysis(
    projectPath: string,
    rulePaths: string[],
    ruleType: string,
    options: Partial<SemanticAnalysisOptions>
  ): Promise<EnhancedSemgrepResult> {
    const scanResult = await this.semgrepService.scanProject(projectPath, {
      rules: rulePaths
    });

    return this.enhanceResults(scanResult, ruleType, options);
  }

  private getSemanticRules(options: SemanticAnalysisOptions): Array<{path: string, type: string}> {
    const rules = [];

    if (options.includeControlFlow) {
      rules.push(
        { path: `${this.enhancedRulesPath}/control-flow/`, type: 'control-flow' },
        { path: `${this.enhancedRulesPath}/control-flow/enhanced-cfg-analysis.yml`, type: 'cfg' }
      );
    }

    if (options.includeDataFlow) {
      rules.push(
        { path: `${this.enhancedRulesPath}/data-flow/`, type: 'data-flow' },
        { path: `${this.enhancedRulesPath}/data-flow/advanced-taint-analysis.yml`, type: 'taint' }
      );
    }

    return rules;
  }

  private async enhanceResults(
    scanResult: any,
    ruleType: string,
    options: Partial<SemanticAnalysisOptions>
  ): Promise<EnhancedSemgrepResult> {
    const enhancedFindings: EnhancedFinding[] = [];

    for (const finding of scanResult.findings || []) {
      const enhancedFinding: EnhancedFinding = {
        location: {
          file: finding.path,
          startLine: finding.start.line,
          startCol: finding.start.col,
          endLine: finding.end.line,
          endCol: finding.end.col
        },
        severity: this.mapSeverity(finding.extra?.severity || 'info'),
        message: finding.extra?.message || '',
        code: finding.extra?.lines || '',
        context: await this.extractContext(finding),
        semanticData: await this.extractSemanticData(finding, ruleType)
      };

      enhancedFindings.push(enhancedFinding);
    }

    return {
      ruleId: ruleType,
      findings: enhancedFindings,
      metadata: {
        totalFiles: scanResult.summary?.totalFiles || 0,
        totalFindings: enhancedFindings.length,
        analysisTime: scanResult.duration || 0,
        rulesApplied: [ruleType]
      }
    };
  }

  private async extractContext(finding: any): Promise<ContextInfo> {
    // 提取函数和类上下文
    return {
      function: finding.extra?.function || 'global',
      class: finding.extra?.class || 'global',
      complexity: finding.extra?.complexity || 1,
      nestingLevel: finding.extra?.nesting || 1
    };
  }

  private async extractSemanticData(
    finding: any, 
    ruleType: string
  ): Promise<SemanticData | undefined> {
    const semanticData: SemanticData = {};

    if (ruleType === 'control-flow') {
      semanticData.controlFlow = {
        complexity: finding.extra?.cyclomaticComplexity || 1,
        nestingDepth: finding.extra?.nestingDepth || 1,
        loopPatterns: finding.extra?.loopPatterns || [],
        unreachableCode: finding.extra?.unreachableCode || []
      };
    }

    if (ruleType === 'data-flow') {
      semanticData.dataFlow = {
        taintSources: finding.extra?.taintSources || [],
        sanitizationPoints: finding.extra?.sanitizationPoints || [],
        dataDependencies: finding.extra?.dataDependencies || []
      };
    }

    return Object.keys(semanticData).length > 0 ? semanticData : undefined;
  }

  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'info': 'low',
      'warning': 'medium',
      'error': 'high',
      'critical': 'critical'
    };
    return severityMap[severity] || 'medium';
  }

  async getAvailableSemanticRules(): Promise<string[]> {
    const controlFlowRules = [
      `${this.enhancedRulesPath}/control-flow/enhanced-cfg-analysis.yml`,
      `${this.enhancedRulesPath}/control-flow/complex-nested-conditions.yml`,
      `${this.enhancedRulesPath}/control-flow/loop-invariant-code.yml`,
      `${this.enhancedRulesPath}/control-flow/missing-break-in-switch.yml`,
      `${this.enhancedRulesPath}/control-flow/unreachable-code-after-return.yml`
    ];

    const dataFlowRules = [
      `${this.enhancedRulesPath}/data-flow/advanced-taint-analysis.yml`,
      `${this.enhancedRulesPath}/data-flow/cross-function-taint.yml`,
      `${this.enhancedRulesPath}/data-flow/resource-leak-detection.yml`,
      `${this.enhancedRulesPath}/data-flow/null-pointer-dereference.yml`,
      `${this.enhancedRulesPath}/data-flow/buffer-overflow-detection.yml`
    ];

    return [...controlFlowRules, ...dataFlowRules];
  }
}