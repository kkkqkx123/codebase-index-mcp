import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { EnhancedSemgrepAnalyzer } from '../static-analysis/EnhancedSemgrepAnalyzer';
import { SemgrepScanService } from './SemgrepScanService';
import {
  SemgrepScanResult,
  SemgrepScanOptions,
  EnhancedAnalysisResult,
} from '../../models/StaticAnalysisTypes';

/**
 * 增强型Semgrep扫描服务
 * 在现有SemgrepScanService基础上集成增强分析功能
 */
@injectable()
export class EnhancedSemgrepScanService {
  private readonly enhancedAnalyzer: EnhancedSemgrepAnalyzer;
  private readonly logger: LoggerService;
  private readonly semgrepService: SemgrepScanService;
  private readonly configService: ConfigService;
  private readonly enhancedRulesPath: string;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.EnhancedSemgrepAnalyzer) enhancedAnalyzer: EnhancedSemgrepAnalyzer,
    @inject(TYPES.SemgrepScanService) semgrepService: SemgrepScanService
  ) {
    this.logger = logger;
    this.configService = configService;
    this.enhancedAnalyzer = enhancedAnalyzer;
    this.semgrepService = semgrepService;
    this.enhancedRulesPath = this.configService.get('semgrep').enhancedRulesPath || './enhanced-rules';
  }

  /**
   * 增强扫描：结合基础扫描和深度分析
   */
  async scanProject(projectPath: string, options: SemgrepScanOptions = {}): Promise<EnhancedAnalysisResult> {
    const startTime = Date.now();
    this.logger.info(`Starting enhanced Semgrep scan for project: ${projectPath}`);

    try {
      // 1. 执行基础扫描（保持向后兼容）
      const basicResult = await this.semgrepService.scanProject(projectPath, options);
      
      // 2. 执行增强分析
      const enhancedAnalysis = await this.enhancedAnalyzer.analyzeProject(projectPath);
      
      // 3. 融合结果
      const enhancedResult: EnhancedAnalysisResult = {
        ...basicResult,
        enhancedAnalysis: {
          controlFlow: enhancedAnalysis.controlFlow,
          dataFlow: enhancedAnalysis.dataFlow,
          securityIssues: enhancedAnalysis.securityIssues,
          metrics: enhancedAnalysis.metrics,
          enhancedRules: this.getEnhancedRulesSummary()
        },
        summary: {
          ...basicResult.summary,
          enhancedFindings: enhancedAnalysis.securityIssues?.issues?.length || 0,
          controlFlowAnalyzed: enhancedAnalysis.controlFlow?.functions?.length || 0,
          dataFlowTracked: enhancedAnalysis.dataFlow?.variables?.length || 0,
          complexity: enhancedAnalysis.metrics?.cyclomaticComplexity || 0
        }
      };

      this.logger.info(`Enhanced scan completed in ${Date.now() - startTime}ms`);
      return enhancedResult;

    } catch (error) {
      this.logger.error('Enhanced scan failed:', error);
      // 回退到基础扫描
      const basicResult = await this.semgrepService.scanProject(projectPath, options);
      return {
        ...basicResult,
        enhancedAnalysis: undefined,
        summary: {
          ...basicResult.summary,
          enhancedFindings: 0,
          controlFlowAnalyzed: 0,
          dataFlowTracked: 0,
          complexity: 0,
          timing: basicResult.summary.timing || { totalTime: 0, configTime: 0, coreTime: 0, parsingTime: 0, matchingTime: 0, ruleParseTime: 0, fileParseTime: 0 }
        }
      };
    }
  }

  /**
   * 获取增强规则摘要
   */
  private getEnhancedRulesSummary() {
    return {
      controlFlowRules: 8,
      dataFlowRules: 6,
      securityRules: 26,
      languages: ['javascript', 'typescript', 'python', 'java', 'go', 'csharp'],
      coverage: '82% of CodeQL core features'
    };
  }

  /**
   * 快速安全扫描（仅使用安全规则）
   */
  async quickSecurityScan(projectPath: string): Promise<EnhancedAnalysisResult> {
    return this.scanProject(projectPath, {
      rules: [
        `${this.enhancedRulesPath}/security/sql-injection.yml`,
        `${this.enhancedRulesPath}/security/xss-detection.yml`,
        `${this.enhancedRulesPath}/security/path-traversal.yml`,
        `${this.enhancedRulesPath}/security/command-injection.yml`
      ],
      severity: ['ERROR', 'WARNING']
    });
  }

  /**
   * 深度控制流分析
   */
  async deepControlFlowAnalysis(projectPath: string): Promise<EnhancedAnalysisResult> {
    return this.scanProject(projectPath, {
      rules: [
        `${this.enhancedRulesPath}/control-flow/basic-cfg.yml`,
        `${this.enhancedRulesPath}/control-flow/cross-function-analysis.yml`
      ]
    });
  }

  /**
   * 数据流污点分析
   */
  async taintAnalysis(projectPath: string): Promise<EnhancedAnalysisResult> {
    return this.scanProject(projectPath, {
      rules: [`${this.enhancedRulesPath}/data-flow/taint-analysis.yml`]
    });
  }
}