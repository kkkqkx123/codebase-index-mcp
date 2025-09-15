/**
 * 静态分析相关类型定义
 * 定义Semgrep扫描结果、分析任务、规则配置等数据模型
 */

import { CodeMetadata } from './IndexTypes';

/**
 * 增强分析结果接口
 * 在基础扫描结果上增加控制流、数据流、安全分析等深度功能
 */
export interface EnhancedAnalysisResult extends SemgrepScanResult {
  enhancedAnalysis?: {
    controlFlow: {
      nodes: Array<{
        id: string;
        type: string;
        location: {
          file: string;
          line: number;
          column: number;
        };
        content: string;
      }>;
      edges: Array<{
        from: string;
        to: string;
        type: string;
        condition?: string;
      }>;
      entryPoint: string;
      exitPoints: string[];
      functions: string[];
    };
    dataFlow: {
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
    };
    securityIssues: {
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
    };
    metrics: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      maintainabilityIndex: number;
    };
    enhancedRules: {
      controlFlowRules: number;
      dataFlowRules: number;
      securityRules: number;
      languages: string[];
      coverage: string;
    };
  };
  summary: {
    totalFiles: number;
    totalFindings: number;
    errorCount: number;
    rulesRun: number;
    targetBytes: number;
    enhancedFindings: number;
    controlFlowAnalyzed: number;
    dataFlowTracked: number;
    complexity: number;
    timing: ScanTiming;
  };
}

/**
 * 增强Semgrep配置
 */
export interface EnhancedSemgrepConfig extends SemgrepConfig {
  enhancedRulesPath: string;
  enableControlFlow: boolean;
  enableDataFlow: boolean;
  enableTaintAnalysis: boolean;
  securitySeverity: string[];
}

/**
 * 静态分析配置
 */
export interface StaticAnalysisConfig {
  enabled: boolean;
  defaultTool: 'semgrep';
  scanOnChange: boolean;
  batchSize: number;
  resultRetentionDays: number;
  semgrep: SemgrepConfig;
}

/**
 * Semgrep配置
 */
export interface SemgrepConfig {
  enabled: boolean;
  cliPath: string;
  rulesDir: string;
  defaultRules: string[];
  timeout: number;
  maxTargetBytes: number;
  maxConcurrentScans: number;
  cacheEnabled: boolean;
  cacheTtl: number;
}

/**
 * Semgrep扫描结果类型
 */
export interface SemgrepScanResult {
  id: string;
  projectPath: string;
  scanTime: Date;
  duration: number;
  summary: ScanSummary;
  findings: SemgrepFinding[];
  errors: SemgrepError[];
  metadata: ScanMetadata;
}

/**
 * 扫描摘要信息
 */
export interface ScanSummary {
  totalFiles: number;
  totalFindings: number;
  errorCount: number;
  rulesRun: number;
  targetBytes: number;
  timing: ScanTiming;
}

/**
 * 扫描性能时间
 */
export interface ScanTiming {
  totalTime: number;
  configTime: number;
  coreTime: number;
  parsingTime: number;
  matchingTime: number;
  ruleParseTime: number;
  fileParseTime: number;
}

/**
 * Semgrep发现的问题
 */
export interface SemgrepFinding {
  id: string;
  ruleId: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  cwe?: string[];
  owasp?: string[];
  references?: string[];
  fix?: string;
  location: FindingLocation;
  extra?: Record<string, any>;
  codeContext: CodeMetadata;
}

/**
 * 问题位置信息
 */
export interface FindingLocation {
  file: string;
  start: Position;
  end: Position;
  lines: string[];
}

/**
 * 位置坐标
 */
export interface Position {
  line: number;
  col: number;
  offset: number;
}

/**
 * Semgrep错误信息
 */
export interface SemgrepError {
  type: string;
  message: string;
  level: string;
  details?: Record<string, any>;
  path?: string;
}

/**
 * 扫描元数据
 */
export interface ScanMetadata {
  semgrepVersion: string;
  configHash: string;
  projectHash: string;
  branch?: string;
  commit?: string;
  author?: string;
}

/**
 * Semgrep规则定义
 */
export interface SemgrepRule {
  id: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  languages: string[];
  patterns?: Pattern[];
  pattern?: string;
  patternEither?: Pattern[];
  patternInside?: string;
  patternNot?: string;
  metadata?: RuleMetadata;
  fix?: string;
  options?: Record<string, any>;
}

/**
 * 规则模式
 */
export interface Pattern {
  pattern?: string;
  patternEither?: Pattern[];
  patternInside?: string;
  patternNot?: string;
  patternNotInside?: string;
  metavariable?: string;
  regex?: string;
}

/**
 * 规则元数据
 */
export interface RuleMetadata {
  category?: string;
  cwe?: string[];
  owasp?: string[];
  references?: string[];
  technology?: string[];
  likelihood?: string;
  impact?: string;
  confidence?: string;
  subcategory?: string;
  source?: string;
  composite?: boolean;
  patterns?: number;
  originalRule?: any;
  originalKey?: string;
  type?: string;
}

/**
 * 扫描选项
 */
export interface SemgrepScanOptions {
  rules?: string[];
  config?: string;
  severity?: ('ERROR' | 'WARNING' | 'INFO')[];
  timeout?: number;
  maxTargetBytes?: number;
  maxMemory?: number;
  jobs?: number;
  exclude?: string[];
  include?: string[];
  baselineCommit?: string;
  dryRun?: boolean;
  quiet?: boolean;
  jsonOutput?: boolean;
  sarifOutput?: boolean;
}

/**
 * 静态分析任务
 */
export interface StaticAnalysisTask {
  id: string;
  projectId: string;
  projectPath: string;
  type: 'semgrep';
  status: TaskStatus;
  options: SemgrepScanOptions;
  priority: TaskPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: SemgrepScanResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * 任务状态
 */
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * 任务优先级
 */
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/**
 * 分析结果融合
 */
export interface AnalysisResultFusion {
  id: string;
  projectId: string;
  scanResult: SemgrepScanResult;
  graphData?: any;
  vectorData?: any;
  fusionScore: number;
  relevanceFactors: RelevanceFactor[];
  createdAt: Date;
}

/**
 * 相关性因子
 */
export interface RelevanceFactor {
  type: 'semantic' | 'structural' | 'security' | 'performance';
  score: number;
  weight: number;
  description: string;
}

/**
 * 规则验证结果
 */
export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 批量扫描结果
 */
export interface BatchScanResult {
  batchId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  results: SemgrepScanResult[];
  errors: string[];
  summary: BatchSummary;
}

/**
 * 批次摘要
 */
export interface BatchSummary {
  totalFiles: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  totalDuration: number;
  averageDuration: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface AnalysisTask {
  id: string;
  projectPath: string;
  type: 'semgrep';
  options?: SemgrepScanOptions;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: SemgrepScanResult;
  error?: string;
}

// Additional utility types for static analysis
export interface ErrorInfo {
  type: string;
  message: string;
  level: string;
  details?: Record<string, any>;
  path?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships: string[];
}

export interface VectorDocument {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  score?: number;
}

export interface SemgrepError {
  type: string;
  message: string;
  level: string;
  details?: Record<string, any>;
  path?: string;
}
