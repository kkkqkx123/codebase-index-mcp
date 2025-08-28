import { Driver, Session } from 'neo4j-driver';
import { LoggerService } from '../../core/LoggerService';

interface SessionMetrics {
  totalSessionsCreated: number;
  totalSessionsClosed: number;
  activeSessions: number;
  avgSessionDuration: number;
  sessionTimeouts: number;
}

export class SessionMonitor {
  private metrics: SessionMetrics = {
    totalSessionsCreated: 0,
    totalSessionsClosed: 0,
    activeSessions: 0,
    avgSessionDuration: 0,
    sessionTimeouts: 0
  };

  public recordSessionCreated(): void {
    this.metrics.totalSessionsCreated++;
    this.metrics.activeSessions++;
  }

  public recordSessionClosed(duration: number): void {
    this.metrics.totalSessionsClosed++;
    this.metrics.activeSessions--;
    
    // 更新平均会话持续时间
    if (this.metrics.totalSessionsClosed > 0) {
      this.metrics.avgSessionDuration = 
        (this.metrics.avgSessionDuration * (this.metrics.totalSessionsClosed - 1) + duration) / 
        this.metrics.totalSessionsClosed;
    }
  }

  public recordSessionTimeout(): void {
    this.metrics.sessionTimeouts++;
  }

  public getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }
}

export class SessionPool {
  private driver: Driver;
  private availableSessions: Session[] = [];
  private inUseSessions: Set<Session> = new Set();
  private maxSize: number;
  private sessionTimeout: number;
  private logger: LoggerService | null = null;
  private sessionCreationTimes: Map<Session, number> = new Map();
  private monitor: SessionMonitor;

  constructor(driver: Driver, maxSize: number = 20, sessionTimeout: number = 30000, logger?: LoggerService) {
    this.driver = driver;
    this.maxSize = maxSize;
    this.sessionTimeout = sessionTimeout;
    this.logger = logger || null;
    this.monitor = new SessionMonitor();
  }

  public async getSession(accessMode: 'READ' | 'WRITE' = 'WRITE'): Promise<Session> {
    // 清理超时的会话
    this.cleanupExpiredSessions();
    
    // 如果有可用会话，直接返回
    if (this.availableSessions.length > 0) {
      const session = this.availableSessions.pop()!;
      this.inUseSessions.add(session);
      this.sessionCreationTimes.set(session, Date.now());
      return session;
    }
    
    // 如果池未满，创建新会话
    if (this.inUseSessions.size + this.availableSessions.length < this.maxSize) {
      const session = this.driver.session({
        defaultAccessMode: accessMode
      });
      this.inUseSessions.add(session);
      this.sessionCreationTimes.set(session, Date.now());
      this.monitor.recordSessionCreated();
      return session;
    }
    
    // 如果池已满，等待可用会话
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (this.availableSessions.length > 0) {
          clearInterval(interval);
          const session = this.availableSessions.pop()!;
          this.inUseSessions.add(session);
          this.sessionCreationTimes.set(session, Date.now());
          resolve(session);
        }
        
        // 检查是否超时
        if (Date.now() - startTime > 5000) {
          clearInterval(interval);
          this.monitor.recordSessionTimeout();
          reject(new Error('Timeout waiting for available session'));
        }
      }, 100);
    });
  }

  public async releaseSession(session: Session): Promise<void> {
    if (this.inUseSessions.has(session)) {
      // 记录会话使用时间
      const creationTime = this.sessionCreationTimes.get(session);
      if (creationTime) {
        const duration = Date.now() - creationTime;
        this.monitor.recordSessionClosed(duration);
        this.sessionCreationTimes.delete(session);
      }
      
      this.inUseSessions.delete(session);
      
      // 检查会话是否仍然健康
      if (await this.isSessionHealthy(session)) {
        this.availableSessions.push(session);
      } else {
        // 如果会话不健康，则关闭它
        await session.close().catch(() => {});
      }
    }
  }

  private async isSessionHealthy(session: Session): Promise<boolean> {
    try {
      // 执行一个简单的查询来检查会话是否健康
      await session.run('RETURN 1');
      return true;
    } catch (error) {
      this.logger?.error('Session health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: Session[] = [];
    
    // 检查可用会话是否过期
    this.availableSessions = this.availableSessions.filter(session => {
      const creationTime = this.sessionCreationTimes.get(session);
      if (creationTime && now - creationTime > this.sessionTimeout) {
        expiredSessions.push(session);
        return false; // 移除过期会话
      }
      return true; // 保留未过期会话
    });
    
    // 关闭过期会话
    for (const session of expiredSessions) {
      this.sessionCreationTimes.delete(session);
      session.close().catch(() => {});
    }
    
    if (expiredSessions.length > 0 && this.logger) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  public async close(): Promise<void> {
    // 关闭所有会话
    for (const session of this.availableSessions) {
      await session.close().catch(() => {});
      this.sessionCreationTimes.delete(session);
    }
    
    for (const session of this.inUseSessions) {
      await session.close().catch(() => {});
      this.sessionCreationTimes.delete(session);
    }
    
    this.availableSessions = [];
    this.inUseSessions.clear();
    this.sessionCreationTimes.clear();
  }

  public getMetrics(): SessionMetrics {
    return this.monitor.getMetrics();
  }

  public getReadSession(): Promise<Session> {
    return this.getSession('READ');
  }

  public getWriteSession(): Promise<Session> {
    return this.getSession('WRITE');
  }
}