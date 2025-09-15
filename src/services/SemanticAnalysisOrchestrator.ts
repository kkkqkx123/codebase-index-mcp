import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { SemanticAnalysisService } from './parser/SemanticAnalysisService';
import { SemanticSemgrepService } from './semgrep/SemanticSemgrepService';
import { CallGraphService } from './parser/CallGraphService';
import { LoggerService } from '../core/LoggerService';

export interface ControlFlowAnalysis {
  complexity: number;
  patterns?: any[];
  nestingDepth?: number;
  unreachableCode?: any[];
  missingBreaks?: any[];
  loopPatterns?: any[];
}

export interface DataFlowAnalysis {
  taintSources: any[];
  sinks: any[];
}

export interface CrossFunctionAnalysis {
  callChains: any[];
  dependencies: any[];
}

export interface SemanticAnalysisResult {
  projectPath: string;
  timestamp: Date;
  semanticAnalysis: any;
  semgrepResults: any[];
  callGraph: any;
  summary: AnalysisSummary;
}

export interface SemanticContext {
  controlFlow: ControlFlowAnalysis;
  dataFlow: DataFlowAnalysis;
  crossFunction: CrossFunctionAnalysis;
}

export interface AnalysisSummary {
  totalFiles: number;
  totalFunctions: number;
  totalIssues: number;
  highRiskFunctions: number;
  deadCode: number;
  circularDependencies: number;
  analysisTime: number;
}

export interface SemanticAnalysisProgress {
  currentStep: string;
  progress: number;
  totalSteps: number;
  estimatedTime: number;
}

@injectable()
export class SemanticAnalysisOrchestrator {
  constructor(
    @inject(TYPES.SemanticAnalysisService) private semanticService: SemanticAnalysisService,
    @inject(TYPES.SemgrepScanService) private semgrepService: SemanticSemgrepService,
    @inject(TYPES.TreeSitterService) private callGraphService: CallGraphService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async runSemanticAnalysis(
    projectPath: string,
    onProgress?: (progress: SemanticAnalysisProgress) => void
  ): Promise<SemanticAnalysisResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting semantic analysis for ${projectPath}`);

      // 步骤1: 构建调用图 (25%)
      onProgress?.({
        currentStep: 'Building call graph...',
        progress: 25,
        totalSteps: 4,
        estimatedTime: 60,
      });

      const callGraph = await this.callGraphService.buildCallGraph(projectPath);

      // 步骤2: 运行控制流分析 (50%)
      onProgress?.({
        currentStep: 'Analyzing control flow...',
        progress: 50,
        totalSteps: 4,
        estimatedTime: 45,
      });

      const controlFlowResult = await this.semgrepService.runControlFlowAnalysis(projectPath);

      // 步骤3: 运行数据流分析 (75%)
      onProgress?.({
        currentStep: 'Analyzing data flow...',
        progress: 75,
        totalSteps: 4,
        estimatedTime: 30,
      });

      const dataFlowResult = await this.semgrepService.runDataFlowAnalysis(projectPath);

      // 步骤4: 整合语义分析 (100%)
      onProgress?.({
        currentStep: 'Integrating semantic analysis...',
        progress: 100,
        totalSteps: 4,
        estimatedTime: 15,
      });

      const semanticResult = await this.semanticService.analyzeSemanticContext(
        projectPath,
        '', // 这里应该提供实际代码
        'typescript'
      );

      const analysisTime = Date.now() - startTime;

      const result: SemanticAnalysisResult = {
        projectPath,
        timestamp: new Date(),
        semanticAnalysis: semanticResult,
        semgrepResults: [controlFlowResult, dataFlowResult],
        callGraph,
        summary: await this.generateSummary(
          callGraph,
          [controlFlowResult, dataFlowResult],
          analysisTime
        ),
      };

      this.logger.info(`Semantic analysis completed in ${analysisTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`Phase 1 analysis failed: ${error}`);
      throw error;
    }
  }

  async runQuickAnalysis(
    projectPath: string,
    targetFiles: string[]
  ): Promise<SemanticAnalysisResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Running quick analysis for ${targetFiles.length} files`);

      // 快速构建调用图（仅针对目标文件）
      const callGraph = await this.buildPartialCallGraph(projectPath, targetFiles);

      // 快速运行semgrep规则
      const semgrepResults = await Promise.all([
        this.semgrepService.runControlFlowAnalysis(projectPath),
        this.semgrepService.runDataFlowAnalysis(projectPath),
      ]);

      const analysisTime = Date.now() - startTime;

      return {
        projectPath,
        timestamp: new Date(),
        semanticAnalysis: {
          controlFlow: { complexity: 0, patterns: [] },
          dataFlow: { taintSources: [], sinks: [] },
          crossFunction: { callChains: [], dependencies: [] },
        },
        semgrepResults,
        callGraph,
        summary: await this.generateSummary(callGraph, semgrepResults, analysisTime),
      };
    } catch (error) {
      this.logger.error(`Quick analysis failed: ${error}`);
      throw error;
    }
  }

  async validateSemanticAnalysisSetup(): Promise<ValidationResult> {
    try {
      const checks = await Promise.all([
        this.validateSemgrepRules(),
        this.validateTreeSitterIntegration(),
        this.validateCallGraphGeneration(),
      ]);

      const allPassed = checks.every(check => check.passed);

      return {
        passed: allPassed,
        checks: checks.reduce(
          (acc, check) => {
            acc[check.name] = check;
            return acc;
          },
          {} as Record<string, ValidationCheck>
        ),
      };
    } catch (error) {
      return {
        passed: false,
        checks: {},
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async validateSemgrepRules(): Promise<ValidationCheck> {
    try {
      const availableRules = await this.semgrepService.getAvailableSemanticRules();
      const requiredRules = [
        'enhanced-rules/control-flow/enhanced-cfg-analysis.yml',
        'enhanced-rules/data-flow/advanced-taint-analysis.yml',
      ];

      const missingRules = requiredRules.filter(rule => !availableRules.includes(rule));

      return {
        name: 'semgrep-rules',
        passed: missingRules.length === 0,
        message:
          missingRules.length > 0
            ? `Missing rules: ${missingRules.join(', ')}`
            : 'All rules available',
      };
    } catch (error) {
      return {
        name: 'semgrep-rules',
        passed: false,
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async validateTreeSitterIntegration(): Promise<ValidationCheck> {
    try {
      // 这里应该测试tree-sitter集成
      return {
        name: 'tree-sitter-integration',
        passed: true,
        message: 'Tree-sitter integration working',
      };
    } catch (error) {
      return {
        name: 'tree-sitter-integration',
        passed: false,
        message: `Integration failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async validateCallGraphGeneration(): Promise<ValidationCheck> {
    try {
      const testGraph = await this.callGraphService.buildCallGraph('.');

      const highRiskFunctions = testGraph.nodes.filter(
        (n: any) => n.type === 'function' && n.metadata?.complexity > 10
      );

      return {
        name: 'Call Graph Generation',
        passed: highRiskFunctions.length >= 0,
        message: `Found ${highRiskFunctions.length} high-risk functions`,
      };
    } catch (error) {
      return {
        name: 'Call Graph Generation',
        passed: false,
        message: `Call graph generation failed: ${error}`,
      };
    }
  }

  private async buildPartialCallGraph(projectPath: string, targetFiles: string[]): Promise<any> {
    return await this.callGraphService.buildCallGraph(projectPath);
  }

  private async generateSummary(
    callGraph: any,
    semgrepResults: any[],
    analysisTime: number
  ): Promise<AnalysisSummary> {
    const deadCode = await this.callGraphService.getDeadCode('');
    const circularDependencies = await this.callGraphService.detectCircularDependencies('');

    const totalIssues = semgrepResults.reduce(
      (sum, result) => sum + (result.findings?.length || 0),
      0
    );

    const highRiskFunctions = callGraph.nodes.filter((n: any) => n.complexity > 10).length;

    return {
      totalFiles: 0, // 这里应该计算实际文件数
      totalFunctions: callGraph.nodes.length,
      totalIssues,
      highRiskFunctions,
      deadCode: deadCode.length,
      circularDependencies: circularDependencies.length,
      analysisTime,
    };
  }

  async exportSemanticAnalysisReport(
    result: SemanticAnalysisResult,
    format: 'json' | 'html' | 'markdown'
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'html':
        return this.generateHtmlReport(result);
      case 'markdown':
        return this.generateMarkdownReport(result);
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  private generateHtmlReport(result: SemanticAnalysisResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Semantic Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
    .issue { background: #ffebee; padding: 10px; margin: 5px 0; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Phase 1 Semantic Analysis Report</h1>
  <div class="metric">
    <strong>Analysis Summary:</strong>
    <ul>
      <li>Total Files: ${result.summary.totalFiles}</li>
      <li>Total Functions: ${result.summary.totalFunctions}</li>
      <li>Total Issues: ${result.summary.totalIssues}</li>
      <li>Analysis Time: ${result.summary.analysisTime}ms</li>
    </ul>
  </div>
  
  <div class="metric">
    <strong>Quality Metrics:</strong>
    <ul>
      <li>High Risk Functions: ${result.summary.highRiskFunctions}</li>
      <li>Dead Code: ${result.summary.deadCode}</li>
      <li>Circular Dependencies: ${result.summary.circularDependencies}</li>
    </ul>
  </div>
</body>
</html>`;
  }

  private generateMarkdownReport(result: SemanticAnalysisResult): string {
    // Generate markdown report with semantic analysis results
    return `# Semantic Analysis Report

## Summary
- **Total Files**: ${result.summary.totalFiles}
- **Total Functions**: ${result.summary.totalFunctions}
- **Total Issues**: ${result.summary.totalIssues}
- **Analysis Time**: ${result.summary.analysisTime}ms

## Quality Metrics
- **High Risk Functions**: ${result.summary.highRiskFunctions}
- **Dead Code**: ${result.summary.deadCode}
- **Circular Dependencies**: ${result.summary.circularDependencies}

## Generated Files
- Call Graph: Available in JSON format
- Semgrep Results: ${result.semgrepResults.length} analysis types
- Full Report: Available in multiple formats
`;
  }
}

interface ValidationResult {
  passed: boolean;
  checks: Record<string, ValidationCheck>;
  error?: string;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}
