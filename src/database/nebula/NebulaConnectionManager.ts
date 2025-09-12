import { injectable } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaQueryBuilder } from './NebulaQueryBuilder';

// 使用社区贡献的NebulaGraph Node.js客户端
// https://github.com/nebula-contrib/nebula-node
import { createClient } from '@nebula-contrib/nebula-nodejs';

@injectable()
export class NebulaConnectionManager {
  private client: any | null = null;
  private isConnected: boolean = false;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private queryBuilder: NebulaQueryBuilder;
  // 存储连接超时定时器引用，以便在断开连接时清理
  private connectionTimeout: NodeJS.Timeout | null = null;
  // 存储其他可能的定时器引用
  private healthCheckInterval: NodeJS.Timeout | null = null;
  // 存储当前空间名称
  private currentSpace: string = '';

  constructor(
    logger: LoggerService,
    errorHandler: ErrorHandlerService,
    configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.queryBuilder = new NebulaQueryBuilder();
  }

  async connect(): Promise<boolean> {
    try {
      // 如果已经连接，直接返回true
      if (this.isConnected && this.client) {
        return true;
      }
      
      const config = this.configService.getAll();
      
      // 记录连接配置用于调试
      this.logger.debug('NebulaGraph connection config:', {
        host: config.nebula.host,
        port: config.nebula.port,
        username: config.nebula.username,
        space: config.nebula.space
      });
      
      // 使用社区贡献的NebulaGraph Node.js客户端
      // https://github.com/nebula-contrib/nebula-node
      const options = {
        servers: [`${config.nebula.host}:${config.nebula.port}`],
        userName: config.nebula.username,
        password: config.nebula.password,
        space: config.nebula.space
      };
      
      // 保存当前空间名称
      this.currentSpace = config.nebula.space || '';
      
      this.client = createClient(options);
      this.logger.debug('NebulaGraph client created');
      
      // 保存当前空间名称
      this.currentSpace = config.nebula.space || '';
      
      // 检查客户端是否已经准备就绪
      if (this.client && typeof this.client.isConnected === 'function' && this.client.isConnected()) {
        this.isConnected = true;
        this.logger.info('Already connected to NebulaGraph');
        return true;
      }
      
      // 等待客户端准备就绪
      const result = await new Promise<boolean>((resolve, reject) => {
        // 定义事件处理函数
        const readyHandler = () => {
          // 清理定时器引用
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          // 移除事件监听器
          if (this.client) {
            this.client.removeListener('error', errorHandler);
            this.client.removeListener('ready', readyHandler);
          }
          resolve(true);
        };
        
        const errorHandler = (error: any) => {
          // 清理定时器引用
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          // 移除事件监听器
          if (this.client) {
            this.client.removeListener('ready', readyHandler);
            this.client.removeListener('error', errorHandler);
          }
          reject(error);
        };
        
        // 添加事件监听器
        this.client!.on('ready', readyHandler);
        this.client!.on('error', errorHandler);
        
        // 设置超时
        this.connectionTimeout = setTimeout(() => {
          // 清理定时器引用
          this.connectionTimeout = null;
          // 移除事件监听器
          if (this.client) {
            this.client.removeListener('ready', readyHandler);
            this.client.removeListener('error', errorHandler);
          }
          reject(new Error('Connection timeout'));
        }, 10000);
        
        // 确保超时定时器不会阻止进程退出
        if (this.connectionTimeout) {
          this.connectionTimeout.unref();
        }
      });
      
      this.isConnected = result;
      if (result) {
        this.logger.info('Connected to NebulaGraph successfully');
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('NebulaGraph connection failed:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
      this.errorHandler.handleError(
        new Error(`Failed to connect to NebulaGraph: ${errorMessage}`),
        { component: 'NebulaConnectionManager', operation: 'connect' }
      );
      this.isConnected = false;
      // 清理连接
      if (this.client) {
        try {
          if (typeof this.client.removeAllListeners === 'function') {
            this.client.removeAllListeners();
          }
          if (typeof this.client.close === 'function') {
            await this.client.close();
          }
        } catch (closeError) {
          // 忽略关闭错误
          this.logger.debug('Error while closing client during cleanup:', closeError);
        }
        this.client = null;
      }
      return false;
    }
  }

  
  async disconnect(): Promise<void> {
    try {
      // 清理连接超时定时器
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      
      // 清理健康检查定时器
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.client) {
        // 移除所有事件监听器
        if (typeof this.client.removeAllListeners === 'function') {
          this.client.removeAllListeners();
        }
        
        // 关闭NebulaGraph客户端连接
        if (typeof this.client.close === 'function') {
          await this.client.close();
        }
        // 将客户端设置为null并更新连接状态
        this.client = null;
      }
      this.isConnected = false;
      this.logger.info('Disconnected from NebulaGraph successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to disconnect from NebulaGraph: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'disconnect' }
      );
    }
  }

  async executeQuery(query: string, params?: Record<string, any>): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 使用社区贡献的NebulaGraph Node.js客户端执行查询
      // https://github.com/nebula-contrib/nebula-node
      return await this.client.execute(query, false, params);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'executeQuery' }
      );
      throw error;
    }
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async getReadSession(): Promise<any> {
    // NebulaGraph Node.js客户端使用连接池管理连接
    // 我们直接返回客户端实例，因为它已经处理了连接池
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }
    return this.client;
  }

  async getWriteSession(): Promise<any> {
    // NebulaGraph Node.js客户端使用连接池管理连接
    // 我们直接返回客户端实例，因为它已经处理了连接池
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }
    return this.client;
  }

  async executeTransaction(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<any[]> {
    // NebulaGraph Node.js客户端可能没有直接的事务支持
    // 我们将逐个执行查询，并在出现错误时抛出异常
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    const results: any[] = [];
    
    try {
      for (const { query, params } of queries) {
        const result = await this.client.execute(query, false, params);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to execute transaction: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'executeTransaction' }
      );
      throw error;
    }
  }

  async createNode(node: any): Promise<string> {
    // NebulaGraph使用INSERT VERTEX语句创建节点
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 使用查询构建器构造INSERT VERTEX语句
      // 这里假设node对象包含标签、ID和属性
      const { label, id, properties } = node;
      
      // 使用NebulaQueryBuilder构建查询
      const { query, params } = this.queryBuilder.insertVertex(label, id, properties);
      
      // 执行查询
      await this.client.execute(query, false, params);
      return id;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to create node: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'createNode' }
      );
      throw error;
    }
  }

  async createRelationship(relationship: any): Promise<string> {
    // NebulaGraph使用INSERT EDGE语句创建关系
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 使用查询构建器构造INSERT EDGE语句
      // 这里假设relationship对象包含类型、源节点ID、目标节点ID和属性
      const { type, srcId, dstId, properties } = relationship;
      
      // 使用NebulaQueryBuilder构建查询
      const { query, params } = this.queryBuilder.insertEdge(type, srcId, dstId, properties);
      
      // 执行查询
      await this.client.execute(query, false, params);
      return `${srcId}->${dstId}`;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to create relationship: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'createRelationship' }
      );
      throw error;
    }
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>): Promise<any[]> {
    // NebulaGraph使用GO语句或MATCH语句查找节点
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 使用MATCH语句查找节点
      let pattern = `(n:${label})`;
      let returnClause = 'n';
      let whereClause: string | undefined;
      
      // 如果有属性条件，添加WHERE子句
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map(key => `n.${key} = $${key}`);
        whereClause = conditions.join(' AND ');
      }
      
      // 使用NebulaQueryBuilder构建查询
      const query = this.queryBuilder.match(pattern, returnClause, whereClause);
      
      // 执行查询
      const result = await this.client.execute(query, false, properties);
      
      // 解析结果
      // 这里假设结果是一个包含节点数据的数组
      return result.data || [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to find nodes by label: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'findNodesByLabel' }
      );
      throw error;
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    // NebulaGraph使用GO语句或MATCH语句查找关系
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 使用MATCH语句查找关系
      let pattern = '(n1)-[r]->(n2)';
      let returnClause = 'r, n1, n2';
      let whereClause: string | undefined;
      
      // 如果有类型条件，添加类型过滤
      if (type) {
        pattern = `(n1)-[r:${type}]->(n2)`;
      }
      
      // 如果有属性条件，添加WHERE子句
      if (properties && Object.keys(properties).length > 0) {
        const conditions = Object.keys(properties).map(key => `r.${key} = $${key}`);
        whereClause = conditions.join(' AND ');
      }
      
      // 使用NebulaQueryBuilder构建查询
      const query = this.queryBuilder.match(pattern, returnClause, whereClause);
      
      // 执行查询
      const result = await this.client.execute(query, false, properties);
      
      // 解析结果
      // 这里假设结果是一个包含关系数据的数组
      return result.data || [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to find relationships: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'findRelationships' }
      );
      throw error;
    }
  }

  async getDatabaseStats(): Promise<any> {
    // NebulaGraph使用SHOW命令获取数据库统计信息
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 执行SHOW SPACES命令获取空间信息
      const spacesResult = await this.client.execute('SHOW SPACES', false);
      
      // 执行SHOW HOSTS命令获取主机信息
      const hostsResult = await this.client.execute('SHOW HOSTS', false);
      
      // 执行SHOW PARTS命令获取分区信息
      const partsResult = await this.client.execute('SHOW PARTS', false);
      
      // 组合统计信息
      return {
        spaces: spacesResult.data || [],
        hosts: hostsResult.data || [],
        parts: partsResult.data || []
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'getDatabaseStats' }
      );
      throw error;
    }
  }

  /**
   * 获取当前活跃会话信息
   */
  async getActiveSessions(): Promise<any> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      // 执行SHOW SESSIONS命令获取所有活跃会话
      const sessionsResult = await this.client.execute('SHOW SESSIONS', false);
      
      // 执行SHOW LOCAL SESSIONS命令获取本地会话
      const localSessionsResult = await this.client.execute('SHOW LOCAL SESSIONS', false);
      
      return {
        allSessions: sessionsResult.data || [],
        localSessions: localSessionsResult.data || [],
        totalCount: sessionsResult.data ? sessionsResult.data.length : 0,
        localCount: localSessionsResult.data ? localSessionsResult.data.length : 0
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get active sessions: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'getActiveSessions' }
      );
      throw error;
    }
  }

  /**
   * 清理空闲会话
   * @param maxIdleMinutes 最大空闲时间（分钟）
   */
  async cleanupIdleSessions(maxIdleMinutes: number = 60): Promise<number> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to NebulaGraph');
    }

    try {
      const currentTime = new Date();
      const cutoffTime = new Date(currentTime.getTime() - maxIdleMinutes * 60 * 1000);
      
      // 获取所有会话
      const sessionsResult = await this.client.execute('SHOW SESSIONS', false);
      
      if (!sessionsResult.data || sessionsResult.data.length === 0) {
        return 0;
      }

      let cleanedCount = 0;
      
      // 查找并清理空闲会话
      for (const session of sessionsResult.data) {
        const updateTime = new Date(session[4]); // UpdateTime在第五列
        
        if (updateTime < cutoffTime) {
          const sessionId = session[0]; // SessionId在第一列
          try {
            await this.client.execute(`KILL SESSION ${sessionId}`, false);
            cleanedCount++;
            this.logger.debug(`Cleaned idle session: ${sessionId}`);
          } catch (killError) {
            this.logger.warn(`Failed to kill session ${sessionId}: ${killError}`);
          }
        }
      }

      this.logger.info(`Cleaned ${cleanedCount} idle sessions older than ${maxIdleMinutes} minutes`);
      return cleanedCount;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to cleanup idle sessions: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'cleanupIdleSessions' }
      );
      throw error;
    }
  }

  /**
   * 获取会话使用率统计
   */
  async getSessionUsageStats(): Promise<{
    totalSessions: number;
    maxSessions: number;
    usagePercentage: number;
    hasCapacity: boolean;
  }> {
    const sessions = await this.getActiveSessions();
    
    // NebulaGraph默认max_sessions_per_ip_per_user=300，当前配置为1000
    const maxSessions = 1000; // 从配置文件中读取的实际值
    const totalSessions = sessions.totalCount;
    const usagePercentage = (totalSessions / maxSessions) * 100;
    
    return {
      totalSessions,
      maxSessions,
      usagePercentage,
      hasCapacity: usagePercentage < 80 // 使用率低于80%认为有容量
    };
  }
}