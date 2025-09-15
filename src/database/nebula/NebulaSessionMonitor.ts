import { injectable } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { NebulaConnectionManager } from './NebulaConnectionManager';

/**
 * NebulaGraph会话监控服务
 * 定期检查会话状态、清理空闲会话、监控使用率
 */
@injectable()
export class NebulaSessionMonitor {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private connectionManager: NebulaConnectionManager;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(
    connectionManager: NebulaConnectionManager,
    logger: LoggerService,
    errorHandler: ErrorHandlerService
  ) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  /**
   * 启动会话监控
   * @param intervalMinutes 监控间隔（分钟）
   */
  startMonitoring(intervalMinutes: number = 30): void {
    if (this.isMonitoring) {
      this.logger.warn('Session monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        this.errorHandler.handleError(
          new Error(
            `Session monitoring failed: ${error instanceof Error ? error.message : String(error)}`
          ),
          { component: 'NebulaSessionMonitor', operation: 'monitoringCycle' }
        );
      }
    }, intervalMs);

    this.logger.info(
      `Started NebulaGraph session monitoring with ${intervalMinutes} minute interval`
    );

    // 立即执行一次监控
    this.performMonitoringCycle().catch(error => {
      this.errorHandler.handleError(error, {
        component: 'NebulaSessionMonitor',
        operation: 'initialMonitoring',
      });
    });
  }

  /**
   * 停止会话监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.logger.info('Stopped NebulaGraph session monitoring');
  }

  /**
   * 执行监控周期
   */
  private async performMonitoringCycle(): Promise<void> {
    if (!this.connectionManager.isConnectedToDatabase()) {
      this.logger.warn('Skipping session monitoring - not connected to NebulaGraph');
      return;
    }

    try {
      // 1. 获取会话使用率统计
      const usageStats = await this.connectionManager.getSessionUsageStats();

      // 2. 记录监控信息
      this.logSessionUsage(usageStats);

      // 3. 检查容量告警
      if (!usageStats.hasCapacity) {
        this.triggerCapacityAlert(usageStats);
      }

      // 4. 清理空闲会话（每2小时清理一次）
      const now = new Date();
      if (now.getMinutes() % 120 === 0) {
        // 每2小时清理一次
        const cleanedCount = await this.connectionManager.cleanupIdleSessions(120); // 清理空闲超过2小时的会话
        if (cleanedCount > 0) {
          this.logger.info(`Cleaned ${cleanedCount} idle sessions during monitoring cycle`);
        }
      }

      // 5. 获取详细会话信息（调试用）
      if (usageStats.usagePercentage > 50) {
        const activeSessions = await this.connectionManager.getActiveSessions();
        this.logDetailedSessionInfo(activeSessions);
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Monitoring cycle failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaSessionMonitor', operation: 'performMonitoringCycle' }
      );
    }
  }

  /**
   * 记录会话使用率
   */
  private logSessionUsage(usageStats: {
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }): void {
    const level = usageStats.hasCapacity ? 'info' : 'warn';
    this.logger[level](
      `NebulaGraph会话使用率: ${usageStats.totalSessions}/${usageStats.maxSessions} ` +
        `(${usageStats.usagePercentage.toFixed(1)}%)` +
        (usageStats.hasCapacity ? '' : ' - 容量告警!')
    );
  }

  /**
   * 触发容量告警
   */
  private triggerCapacityAlert(usageStats: {
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }): void {
    this.logger.error(
      `NebulaGraph会话容量告警! 当前使用率: ${usageStats.usagePercentage.toFixed(1)}% ` +
        `(${usageStats.totalSessions}/${usageStats.maxSessions} sessions)`
    );

    // 这里可以添加告警通知逻辑，如发送邮件、Slack消息等
    // this.sendAlertNotification(usageStats);
  }

  /**
   * 记录详细会话信息
   */
  private logDetailedSessionInfo(sessionsInfo: any): void {
    if (sessionsInfo.allSessions && sessionsInfo.allSessions.length > 0) {
      this.logger.debug(
        `当前活跃会话详情: ${JSON.stringify(sessionsInfo.allSessions.slice(0, 5))}`
      );
    }

    if (sessionsInfo.localSessions && sessionsInfo.localSessions.length > 0) {
      this.logger.debug(`本地会话详情: ${JSON.stringify(sessionsInfo.localSessions.slice(0, 3))}`);
    }
  }

  /**
   * 手动执行一次监控检查
   */
  async manualCheck(): Promise<{
    usageStats: any;
    cleanedCount?: number;
  }> {
    if (!this.connectionManager.isConnectedToDatabase()) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      const usageStats = await this.connectionManager.getSessionUsageStats();
      const cleanedCount = await this.connectionManager.cleanupIdleSessions(60);

      this.logSessionUsage(usageStats);
      if (cleanedCount > 0) {
        this.logger.info(`手动清理了 ${cleanedCount} 个空闲会话`);
      }

      return { usageStats, cleanedCount };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Manual check failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaSessionMonitor', operation: 'manualCheck' }
      );
      throw error;
    }
  }
}
