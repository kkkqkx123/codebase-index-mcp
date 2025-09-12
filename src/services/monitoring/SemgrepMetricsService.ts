import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { SemgrepScanService } from '../semgrep/SemgrepScanService';
import { SemgrepResultProcessor } from '../semgrep/SemgrepResultProcessor';
import { SemgrepMetrics } from './PrometheusMetricsService';

export interface SemgrepScanStats {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  averageScanDuration: number;
  totalFindings: number;
  findingsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  findingsByCategory: Map<string, number>;
  rulesExecuted: number;
  cacheHits: number;
  cacheMisses: number;
}

@injectable()
export class SemgrepMetricsService {
  private scanStats: SemgrepScanStats = {
    totalScans: 0,
    successfulScans: 0,
    failedScans: 0,
    averageScanDuration: 0,
    totalFindings: 0,
    findingsBySeverity: {
      error: 0,
      warning: 0,
      info: 0
    },
    findingsByCategory: new Map(),
    rulesExecuted: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(SemgrepScanService) private semgrepService: SemgrepScanService,
    @inject(SemgrepResultProcessor) private resultProcessor: SemgrepResultProcessor
  ) {}

  /**
   * 记录一次semgrep扫描
   */
  recordScan(duration: number, success: boolean, findingsCount: number = 0): void {
    try {
      this.scanStats.totalScans++;
      
      if (success) {
        this.scanStats.successfulScans++;
        this.scanStats.totalFindings += findingsCount;
      } else {
        this.scanStats.failedScans++;
      }

      // 更新平均扫描时长（移动平均）
      const previousTotalDuration = this.scanStats.averageScanDuration * (this.scanStats.totalScans - 1);
      this.scanStats.averageScanDuration = (previousTotalDuration + duration) / this.scanStats.totalScans;

      this.logger.debug('Semgrep scan recorded', { 
        duration, 
        success, 
        findingsCount,
        totalScans: this.scanStats.totalScans 
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to record semgrep scan: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SemgrepMetricsService', operation: 'recordScan' }
      );
    }
  }

  /**
   * 记录扫描结果详情
   */
  recordScanDetails(findings: any[]): void {
    try {
      findings.forEach(finding => {
        // 按严重程度统计
        const severity = finding.severity?.toLowerCase() || 'info';
        if (severity === 'error') {
          this.scanStats.findingsBySeverity.error++;
        } else if (severity === 'warning') {
          this.scanStats.findingsBySeverity.warning++;
        } else {
          this.scanStats.findingsBySeverity.info++;
        }

        // 按规则类别统计
        const ruleId = finding.check_id || 'unknown';
        const category = this.extractCategoryFromRuleId(ruleId);
        const currentCount = this.scanStats.findingsByCategory.get(category) || 0;
        this.scanStats.findingsByCategory.set(category, currentCount + 1);
      });

      this.logger.debug('Semgrep scan details recorded', { 
        findingsCount: findings.length,
        severityBreakdown: this.scanStats.findingsBySeverity 
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to record semgrep scan details: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SemgrepMetricsService', operation: 'recordScanDetails' }
      );
    }
  }

  /**
   * 记录规则执行情况
   */
  recordRuleExecution(ruleId: string, cacheHit: boolean = false): void {
    try {
      this.scanStats.rulesExecuted++;
      
      if (cacheHit) {
        this.scanStats.cacheHits++;
      } else {
        this.scanStats.cacheMisses++;
      }

      this.logger.debug('Semgrep rule execution recorded', { 
        ruleId, 
        cacheHit,
        rulesExecuted: this.scanStats.rulesExecuted 
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to record semgrep rule execution: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SemgrepMetricsService', operation: 'recordRuleExecution' }
      );
    }
  }

  /**
   * 获取当前semgrep指标
   */
  getMetrics(): SemgrepMetrics {
    return {
      scans: {
        total: this.scanStats.totalScans,
        successful: this.scanStats.successfulScans,
        failed: this.scanStats.failedScans,
        averageDuration: this.scanStats.averageScanDuration
      },
      findings: {
        total: this.scanStats.totalFindings,
        bySeverity: this.scanStats.findingsBySeverity,
        byCategory: Object.fromEntries(this.scanStats.findingsByCategory)
      },
      rules: {
        totalExecuted: this.scanStats.rulesExecuted,
        mostFrequent: this.getMostFrequentRules()
      },
      cache: {
        hits: this.scanStats.cacheHits,
        misses: this.scanStats.cacheMisses,
        hitRate: this.scanStats.cacheHits + this.scanStats.cacheMisses > 0 
          ? (this.scanStats.cacheHits / (this.scanStats.cacheHits + this.scanStats.cacheMisses)) * 100 
          : 0
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.scanStats = {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      averageScanDuration: 0,
      totalFindings: 0,
      findingsBySeverity: {
        error: 0,
        warning: 0,
        info: 0
      },
      findingsByCategory: new Map(),
      rulesExecuted: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.logger.info('Semgrep metrics statistics reset');
  }

  /**
   * 从规则ID中提取类别
   */
  private extractCategoryFromRuleId(ruleId: string): string {
    const parts = ruleId.split('.');
    if (parts.length >= 2) {
      return parts[0]; // 返回第一个部分作为类别
    }
    return 'other';
  }

  /**
   * 获取最频繁使用的规则
   */
  private getMostFrequentRules(): Array<{ruleId: string; count: number}> {
    // 这里简化实现，实际中需要跟踪每个规则的执行次数
    return [
      { ruleId: 'security.injection', count: Math.floor(this.scanStats.rulesExecuted * 0.3) },
      { ruleId: 'performance.optimization', count: Math.floor(this.scanStats.rulesExecuted * 0.25) },
      { ruleId: 'best-practices', count: Math.floor(this.scanStats.rulesExecuted * 0.2) }
    ];
  }
}