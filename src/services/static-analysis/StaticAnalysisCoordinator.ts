import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { EventQueueService } from '../EventQueueService';
import { SemgrepScanService } from '../semgrep/SemgrepScanService';
import { EnhancedSemgrepScanService } from '../semgrep/EnhancedSemgrepScanService';
import { SemgrepResultProcessor } from '../semgrep/SemgrepResultProcessor';
import { NebulaService } from '../../database/NebulaService';
import { QdrantService } from '../../database/QdrantService';
import {
  AnalysisTask,
  SemgrepScanResult,
  SemgrepScanOptions,
  EnhancedAnalysisResult,
} from '../../models/StaticAnalysisTypes';

/**
 * 静态分析任务协调器
 * 负责协调和管理所有静态分析任务
 */
@injectable()
export class StaticAnalysisCoordinator {
  private isProcessing = false;
  private processingQueue: Set<string> = new Set();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.EventQueueService) private eventQueue: EventQueueService,
    @inject(TYPES.SemgrepScanService) private semgrepService: SemgrepScanService,
    @inject(TYPES.EnhancedSemgrepScanService) private enhancedSemgrepService: EnhancedSemgrepScanService,
    @inject(TYPES.SemgrepResultProcessor) private resultProcessor: SemgrepResultProcessor,
    @inject(TYPES.NebulaService) private nebulaService: NebulaService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService
  ) {
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.eventQueue.on('file_changed', async (event) => {
      if (event.type === 'file_changed') {
        await this.handleFileChange(event.projectPath, event.filePath);
      }
    });

    this.eventQueue.on('project_indexed', async (event) => {
      if (event.type === 'project_indexed') {
        await this.handleProjectIndexed(event.projectPath);
      }
    });
  }

  /**
   * 处理文件变更事件
   */
  private async handleFileChange(projectPath: string, filePath: string): Promise<void> {
    try {
      this.logger.debug(`Handling file change: ${filePath} in project ${projectPath}`);
      
      // 检查是否应该触发扫描
      if (await this.shouldTriggerScan(projectPath)) {
        await this.queueScanTask(projectPath, {
          rules: ['changed-files'],
        });
      }
    } catch (error) {
      this.logger.error('Error handling file change:', error);
    }
  }

  /**
   * 处理项目索引完成事件
   */
  private async handleProjectIndexed(projectPath: string): Promise<void> {
    try {
      this.logger.info(`Project indexed, triggering full scan: ${projectPath}`);
      await this.queueScanTask(projectPath);
    } catch (error) {
      this.logger.error('Error handling project indexed:', error);
    }
  }

  /**
   * 是否应该触发扫描
   */
  private async shouldTriggerScan(projectPath: string): Promise<boolean> {
    // 检查配置
    const scanOnChange = this.configService?.get('staticAnalysis.scanOnChange', true);
    if (!scanOnChange) {
      return false;
    }

    // 检查是否在处理中
    if (this.processingQueue.has(projectPath)) {
      return false;
    }

    return true;
  }

  /**
   * 队列扫描任务
   */
  async queueScanTask(
    projectPath: string,
    options: SemgrepScanOptions = {}
  ): Promise<string> {
    const taskId = this.generateTaskId(projectPath);
    
    const task: AnalysisTask = {
      id: taskId,
      projectPath,
      type: 'semgrep',
      options,
      status: 'pending',
      createdAt: new Date(),
    };

    const queuedEvent = {
      id: `static_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'created' as const,
      path: task.projectPath,
      relativePath: task.projectPath,
      timestamp: new Date(),
      priority: 1,
      retryCount: 0,
      metadata: { task }
    };
    await this.eventQueue.enqueue(queuedEvent);
    this.logger.info(`Queued static analysis task: ${taskId}`);

    return taskId;
  }

  /**
   * 执行扫描任务
   */
  async executeTask(task: AnalysisTask): Promise<SemgrepScanResult> {
    const startTime = Date.now();
    
    try {
      this.processingQueue.add(task.projectPath);
      task.status = 'running';
      task.startedAt = new Date();

      this.logger.info(`Starting static analysis task: ${task.id}`);

      // 根据配置选择使用增强型或标准扫描
      let result: SemgrepScanResult;
      const useEnhanced = this.configService?.get('staticAnalysis.useEnhancedSemgrep', true);
      
      if (useEnhanced) {
        const enhancedResult = await this.enhancedSemgrepService.scanProject(task.projectPath, task.options);
        result = this.convertEnhancedToStandardResult(enhancedResult);
        await this.processEnhancedResults(enhancedResult);
      } else {
        result = await this.semgrepService.scanProject(task.projectPath, task.options);
        await this.processScanResult(result);
      }

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      this.logger.info(`Completed static analysis task: ${task.id} in ${Date.now() - startTime}ms`);

      return result;

    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed static analysis task: ${task.id}`, error);
      throw error;
    } finally {
      this.processingQueue.delete(task.projectPath);
    }
  }

  /**
   * 处理扫描结果
   */
  private async processScanResult(result: SemgrepScanResult): Promise<void> {
    try {
      // 转换为图数据库格式并存储
      const graphData = this.resultProcessor.toGraphFormat(result.findings);
      await this.storeInGraphDatabase(graphData);

      // 转换为向量格式并存储
      const vectorData = this.resultProcessor.toVectorFormat(result.findings);
      await this.storeInVectorDatabase(vectorData);

      // 生成摘要报告
      const summary = this.resultProcessor.generateSummaryReport(result);
      this.logger.info(summary.summary);

    } catch (error) {
      this.logger.error('Error processing scan result:', error);
      throw error;
    }
  }

  /**
   * 存储到图数据库
   */
  private async storeInGraphDatabase(data: { nodes: any[]; edges: any[] }): Promise<void> {
    try {
      if (!this.nebulaService.isConnected()) {
        await this.nebulaService.initialize();
      }

      // 使用事务批量插入节点和边
      const queries = [];
      
      // 批量插入节点
      for (const node of data.nodes) {
        queries.push({
          nGQL: `INSERT VERTEX ${node.label}(id, name, type, properties) VALUES "${node.id}":("${node.id}", "${node.name}", "${node.type}", $properties)`,
          parameters: { properties: JSON.stringify(node.properties || {}) }
        });
      }

      // 批量插入边
      for (const edge of data.edges) {
        queries.push({
          nGQL: `INSERT EDGE ${edge.type}(properties) VALUES "${edge.sourceId}" -> "${edge.targetId}":($properties)`,
          parameters: { properties: JSON.stringify(edge.properties || {}) }
        });
      }

      if (queries.length > 0) {
        await this.nebulaService.executeTransaction(queries);
        this.logger.info(`Stored ${data.nodes.length} nodes and ${data.edges.length} edges in graph database`);
      }
    } catch (error) {
      this.logger.error('Error storing in graph database:', error);
      throw error;
    }
  }

  /**
   * 存储到向量数据库
   */
  private async storeInVectorDatabase(data: any[]): Promise<void> {
    try {
      if (data.length > 0) {
        await this.qdrantService.upsertVectors('static_analysis', data);
        this.logger.info(`Stored ${data.length} vectors in Qdrant`);
      }
    } catch (error) {
      this.logger.error('Error storing in vector database:', error);
      throw error;
    }
  }

  /**
   * 处理增强型扫描结果
   */
  private async processEnhancedResults(enhancedResult: EnhancedAnalysisResult): Promise<void> {
    try {
      // 转换为图数据库格式并存储增强结果
      const graphData = this.resultProcessor.toEnhancedGraphFormat(enhancedResult);
      await this.storeInGraphDatabase(graphData);

      // 转换为向量格式并存储
      const vectorData = this.resultProcessor.toEnhancedVectorFormat(enhancedResult);
      await this.storeInVectorDatabase(vectorData);

      // 生成增强摘要报告
      const summary = this.resultProcessor.generateEnhancedSummaryReport(enhancedResult);
      this.logger.info(summary.summary);

    } catch (error) {
      this.logger.error('Error processing enhanced scan result:', error);
      throw error;
    }
  }

  /**
   * 转换增强结果为标准格式
   */
  private convertEnhancedToStandardResult(enhancedResult: EnhancedAnalysisResult): SemgrepScanResult {
    const findings = enhancedResult.enhancedAnalysis?.securityIssues?.issues || [];
    return {
      id: enhancedResult.id,
      projectPath: enhancedResult.projectPath,
      scanTime: enhancedResult.scanTime,
      duration: enhancedResult.duration,
      findings: findings.map(issue => ({
        id: `${issue.type}_${issue.location.file}_${issue.location.line}`,
        ruleId: issue.type,
        message: issue.message,
        severity: issue.severity === 'HIGH' ? 'ERROR' : issue.severity === 'MEDIUM' ? 'WARNING' : 'INFO',
        confidence: 'HIGH',
        category: issue.type,
        location: {
          file: issue.location.file,
          start: {
            line: issue.location.line,
            col: issue.location.column,
            offset: 0
          },
          end: {
            line: issue.location.line,
            col: issue.location.column + 10,
            offset: 10
          },
          lines: [issue.code]
        },
        codeContext: {
          id: `${issue.type}_${issue.location.file}_${issue.location.line}`,
          filePath: issue.location.file,
          language: 'javascript',
          type: 'variable',
          lineStart: issue.location.line,
          lineEnd: issue.location.line,
          content: issue.code,
          astPath: '',
          nodeType: 'issue',
          parentType: 'file',
          children: [],
          metadata: {
            type: issue.type,
            severity: issue.severity,
            message: issue.message
          }
        }
      })),
      summary: enhancedResult.summary,
      errors: [],
      metadata: {
        semgrepVersion: '1.0.0',
        configHash: '',
        projectHash: this.hashString(enhancedResult.projectPath)
      }
    };
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<AnalysisTask | null> {
    // 这里应该查询任务存储，暂时返回null
    return null;
  }

  /**
   * 获取项目扫描历史
   */
  async getProjectScanHistory(projectPath: string): Promise<SemgrepScanResult[]> {
    try {
      // 从图数据库查询扫描历史
      const query = `
        MATCH (scan:semgrep_scan {projectPath: $projectPath})
        RETURN scan
        ORDER BY scan.scanTime DESC
        LIMIT 50
      `;

      const results = await this.nebulaService.executeReadQuery(query, { projectPath });
      
      return results.map((record: any) => ({
        id: record.scan.id || `scan_${Date.now()}`,
        projectPath: record.scan.projectPath,
        scanTime: new Date(record.scan.scanTime),
        duration: record.scan.duration || 0,
        summary: record.scan.summary || {
          totalFiles: 0,
          totalFindings: 0,
          errorCount: 0,
          rulesRun: 0,
          targetBytes: 0,
          timing: { totalTime: 0, configTime: 0, coreTime: 0, parsingTime: 0, matchingTime: 0, ruleParseTime: 0, fileParseTime: 0 }
        },
        findings: record.scan.findings || [],
        errors: record.scan.errors || [],
        metadata: record.scan.metadata || {
          semgrepVersion: '',
          configHash: '',
          projectHash: ''
        }
      }));
    } catch (error) {
      this.logger.error('Error getting project scan history:', error);
      return [];
    }
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // 清理图数据库中的旧数据
      const query = `
        MATCH (scan:semgrep_scan)
        WHERE scan.scanTime < $cutoffDate
        DETACH DELETE scan
      `;

      await this.nebulaService.executeReadQuery(query, { cutoffDate });

      // 清理向量数据库中的旧数据
      const oldVectors = await this.qdrantService.searchVectors('static_analysis', [0], {
        limit: 10000,
        filter: {
          must: [
            {
              key: 'metadata.scanTime',
              range: {
                lt: cutoffDate.getTime(),
              },
            },
          ],
        },
        withPayload: false,
        withVector: false,
      });
      
      if (oldVectors.length > 0) {
         const vectorIds = oldVectors.map(v => v.id);
         this.logger.info(`Would delete ${vectorIds.length} old vectors from Qdrant`);
       }

      this.logger.info(`Cleaned up data older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error('Error cleaning up old data:', error);
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<{
    isProcessing: boolean;
    queueSize: number;
    activeProjects: string[];
  }> {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.processingQueue.size,
      activeProjects: Array.from(this.processingQueue),
    };
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(projectPath: string): string {
    const timestamp = Date.now().toString(36);
    const hash = this.hashString(projectPath).substring(0, 8);
    return `semgrep_${hash}_${timestamp}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // 注入配置服务
  private configService: any;
  public setConfigService(configService: any): void {
    this.configService = configService;
  }
}