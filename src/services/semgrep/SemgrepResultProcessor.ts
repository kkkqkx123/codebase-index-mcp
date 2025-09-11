import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { SemgrepScanResult, SemgrepFinding, SemgrepError, ErrorInfo, GraphNode, VectorDocument } from '../../models/StaticAnalysisTypes';

/**
 * Semgrep结果处理器
 * 负责处理和转换Semgrep扫描结果
 */
@injectable()
export class SemgrepResultProcessor {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 处理原始Semgrep结果
   */
  processRawResult(rawResult: any, projectPath: string): SemgrepScanResult {
    try {
      const findings = this.extractFindings(rawResult);
      const summary = this.calculateSummary(rawResult, findings);
      const errors = this.extractErrors(rawResult);

      return {
        id: `scan-${Date.now()}`,
        projectPath,
        scanTime: new Date(),
        duration: rawResult.time?.duration || 0,
        findings,
        errors,
        summary,
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        }
      };
    } catch (error) {
      this.logger.error('Failed to process Semgrep result:', error);
      return {
        id: `scan-${Date.now()}`,
        projectPath,
        scanTime: new Date(),
        duration: 0,
        findings: [],
        errors: [{
          type: 'ProcessingError',
          message: error instanceof Error ? error.message : String(error),
          level: 'ERROR'
        }],
        summary: {
          totalFiles: 0,
          totalFindings: 0,
          errorCount: 1,
          rulesRun: 0,
          targetBytes: 0,
          timing: {
            totalTime: 0,
            configTime: 0,
            coreTime: 0,
            parsingTime: 0,
            matchingTime: 0,
            ruleParseTime: 0,
            fileParseTime: 0,
          }
        },
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        }
      };
    }
  }

  /**
   * 提取发现的问题
   */
  private extractFindings(rawResult: any): SemgrepFinding[] {
    if (!rawResult.findings) {
      return [];
    }

    return rawResult.findings.map((result: any) => {
      return this.transformFinding(result);
    }).filter(Boolean);
  }

  /**
   * 转换单个发现项
   */
  private transformFinding(result: any): SemgrepFinding | null {
    try {
      const finding: SemgrepFinding = {
        id: `${result.check_id || 'unknown-rule'}-${result.path || 'unknown'}-${result.start?.line || 1}`,
        ruleId: result.check_id || 'unknown-rule',
        message: result.extra?.message || result.message || 'No message provided',
        severity: this.mapSemgrepSeverity(result.extra?.severity || 'INFO'),
        confidence: 'HIGH',
        category: 'security',
        location: {
          file: result.path || 'unknown-file',
          start: {
            line: result.start?.line || 1,
            col: result.start?.col || 1,
            offset: 0
          },
          end: {
            line: result.end?.line || result.start?.line || 1,
            col: result.end?.col || result.start?.col || 1,
            offset: 0
          },
          lines: result.extra?.lines || []
        },
        extra: result.extra || {},
        codeContext: {
          id: '',
          filePath: result.path || 'unknown-file',
          language: '',
          content: result.extra?.lines || '',
          astPath: '',
          nodeType: '',
          parentType: '',
          children: [],
          metadata: {},
          type: 'variable',
          lineStart: result.start?.line || 1,
          lineEnd: result.end?.line || result.start?.line || 1,
        },
        cwe: result.extra?.metadata?.cwe || [],
        owasp: result.extra?.metadata?.owasp || [],
        references: result.extra?.metadata?.references || [],
        fix: result.extra?.fix
      };

      return finding;
    } catch (error) {
      this.logger.warn('Failed to transform finding:', error);
      return null;
    }
  }

  /**
   * 计算统计信息
   */
  private calculateSummary(rawResult: any, findings: SemgrepFinding[]): {
    totalFiles: number;
    totalFindings: number;
    errorCount: number;
    rulesRun: number;
    targetBytes: number;
    timing: {
      totalTime: number;
      configTime: number;
      coreTime: number;
      parsingTime: number;
      matchingTime: number;
      ruleParseTime: number;
      fileParseTime: number;
    };
  } {
    return {
      totalFiles: rawResult.paths?.scanned?.length || 0,
      totalFindings: findings.length,
      errorCount: rawResult.errors?.length || 0,
      rulesRun: 0,
      targetBytes: 0,
      timing: {
        totalTime: rawResult.time?.duration || 0,
        configTime: 0,
        coreTime: 0,
        parsingTime: 0,
        matchingTime: 0,
        ruleParseTime: 0,
        fileParseTime: 0,
      }
    };
  }

  /**
   * 提取错误信息
   */
  private extractErrors(rawResult: any): SemgrepError[] {
    if (!rawResult.errors) {
      return [];
    }

    return rawResult.errors.map((error: any) => {
      if (typeof error === 'string') {
        return {
          type: 'GenericError',
          message: error,
          level: 'ERROR'
        };
      }
      
      if (error.message) {
        return {
          type: error.type || 'Error',
          message: error.message,
          level: error.level || 'ERROR',
          details: error.details,
          path: error.path
        };
      }
      
      return {
        type: 'UnknownError',
        message: JSON.stringify(error),
        level: 'ERROR'
      };
    });
  }

  /**
   * 映射Semgrep严重性级别
   */
  private mapSemgrepSeverity(severity: string): 'ERROR' | 'WARNING' | 'INFO' {
    const severityMap: Record<string, 'ERROR' | 'WARNING' | 'INFO'> = {
      'ERROR': 'ERROR',
      'error': 'ERROR',
      'WARNING': 'WARNING',
      'warning': 'WARNING',
      'INFO': 'INFO',
      'info': 'INFO',
    };

    return severityMap[severity] || 'INFO';
  }

  /**
   * 按严重性分组结果
   */
  groupBySeverity(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {
      ERROR: [],
      WARNING: [],
      INFO: [],
    };

    for (const finding of findings) {
      groups[finding.severity].push(finding);
    }

    return groups;
  }

  /**
   * 按文件分组结果
   */
  groupByFile(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {};

    for (const finding of findings) {
      const fileName = finding.location.file;
      if (!groups[fileName]) {
        groups[fileName] = [];
      }
      groups[fileName].push(finding);
    }

    return groups;
  }

  /**
   * 按规则分组结果
   */
  groupByRule(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {};

    for (const finding of findings) {
      if (!groups[finding.ruleId]) {
        groups[finding.ruleId] = [];
      }
      groups[finding.ruleId].push(finding);
    }

    return groups;
  }

  /**
   * 生成摘要报告
   */
  generateSummaryReport(result: SemgrepScanResult): {
    summary: string;
    criticalIssues: SemgrepFinding[];
    recommendations: string[];
  } {
    const criticalIssues = result.findings.filter(
      (finding: { severity: string; }) => finding.severity === 'ERROR'
    );

    const summary = `
Semgrep Scan Summary for ${result.projectPath}
============================================
Total Files: ${result.summary.totalFiles}
Total Findings: ${result.summary.totalFindings}
Errors: ${result.summary.errorCount}
Critical Issues: ${criticalIssues.length}
    `.trim();

    const recommendations = this.generateRecommendations(result);

    return {
      summary,
      criticalIssues,
      recommendations,
    };
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(result: SemgrepScanResult): string[] {
    const recommendations: string[] = [];
    const ruleCounts = this.groupByRule(result.findings);

    // 按规则频率排序
    const sortedRules = Object.entries(ruleCounts)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5);

    if (sortedRules.length > 0) {
      recommendations.push(`Top ${sortedRules.length} most common issues:`);
      for (const [ruleId, findings] of sortedRules) {
        recommendations.push(`- ${ruleId}: ${findings.length} occurrences`);
      }
    }

    // 基于严重性建议
    const errorCount = result.findings.filter((f: { severity: string; }) => f.severity === 'ERROR').length;
    const warningCount = result.findings.filter((f: { severity: string; }) => f.severity === 'WARNING').length;

    if (errorCount > 0) {
      recommendations.push(`Address ${errorCount} critical errors immediately`);
    }

    if (warningCount > 10) {
      recommendations.push(`Review ${warningCount} warnings for potential issues`);
    }

    return recommendations;
  }

  /**
   * 转换为图数据库格式
   */
  toGraphFormat(findings: SemgrepFinding[]): {
    nodes: any[];
    edges: any[];
  } {
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const finding of findings) {
      // 创建问题节点
      const issueNode = {
        id: `issue_${finding.id}`,
        type: 'static_analysis_issue',
        properties: {
          ruleId: finding.ruleId,
          message: finding.message,
          severity: finding.severity,
          file: finding.location.file,
          line: finding.location.start.line,
          column: finding.location.start.col,
          endLine: finding.location.end.line,
          endColumn: finding.location.end.col,
          code: finding.location.lines.join('\n'),
          fix: finding.fix,
          cwe: finding.cwe,
          owasp: finding.owasp,
          references: finding.references,
        },
      };

      nodes.push(issueNode);

      // 创建文件节点
      const fileNode = {
        id: `file_${finding.location.file}`,
        type: 'file',
        properties: {
          path: finding.location.file,
        },
      };

      nodes.push(fileNode);

      // 创建边：文件包含问题
      edges.push({
        from: fileNode.id,
        to: issueNode.id,
        type: 'contains',
        properties: {
          relationship: 'contains_issue',
        },
      });

      // 创建规则节点
      const ruleNode = {
        id: `rule_${finding.ruleId}`,
        type: 'semgrep_rule',
        properties: {
          ruleId: finding.ruleId,
        },
      };

      nodes.push(ruleNode);

      // 创建边：规则检测到问题
      edges.push({
        from: ruleNode.id,
        to: issueNode.id,
        type: 'detected',
        properties: {
          relationship: 'detected_issue',
        },
      });
    }

    return { nodes, edges };
  }

  /**
   * 转换为向量搜索格式
   */
  toVectorFormat(findings: SemgrepFinding[]): {
    id: string;
    text: string;
    metadata: any;
  }[] {
    return findings.map(finding => ({
      id: `semgrep_${finding.id}`,
      text: `${finding.ruleId}: ${finding.message} in ${finding.location.file}:${finding.location.start.line}`,
      metadata: {
        type: 'semgrep_finding',
        ruleId: finding.ruleId,
        file: finding.location.file,
        line: finding.location.start.line,
        severity: finding.severity,
        code: finding.location.lines.join('\n'),
        fix: finding.fix,
      },
    }));
  }
}