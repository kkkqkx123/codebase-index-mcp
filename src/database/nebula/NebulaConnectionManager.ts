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
      const config = this.configService.getAll();
      
      // 使用社区贡献的NebulaGraph Node.js客户端
      // https://github.com/nebula-contrib/nebula-node
      const options = {
        servers: [`${config.nebula.host}:${config.nebula.port}`],
        userName: config.nebula.username,
        password: config.nebula.password,
        space: config.nebula.space
      };
      
      this.client = createClient(options);
      
      // 等待客户端准备就绪
      await new Promise<void>((resolve, reject) => {
        // 定义事件处理函数
        const readyHandler = () => {
          // 移除事件监听器
          this.removeListener('error', errorHandler);
          resolve();
        };
        
        const errorHandler = (error: any) => {
          // 移除事件监听器
          this.removeListener('ready', readyHandler);
          reject(error);
        };
        
        // 添加事件监听器
        this.client!.on('ready', readyHandler);
        this.client!.on('error', errorHandler);
        
        // 设置超时
        const timeout = setTimeout(() => {
          // 移除事件监听器
          this.removeListener('ready', readyHandler);
          this.removeListener('error', errorHandler);
          reject(new Error('Connection timeout'));  
        }, 10000);
        
        // 确保超时定时器不会阻止进程退出
        timeout.unref();
      });
      
      this.isConnected = true;
      this.logger.info('Connected to NebulaGraph successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to connect to NebulaGraph: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaConnectionManager', operation: 'connect' }
      );
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 移除事件监听器的辅助方法
   * @param event 事件名称
   * @param listener 事件监听器
   */
  private removeListener(event: string, listener: Function): void {
    // 检查client是否存在off方法，如果不存在则使用removeListener
    if (this.client && typeof this.client.off === 'function') {
      this.client.off(event, listener);
    } else if (this.client && typeof this.client.removeListener === 'function') {
      this.client.removeListener(event, listener);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
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
}