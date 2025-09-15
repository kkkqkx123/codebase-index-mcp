import { injectable, inject } from 'inversify';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { NebulaConnectionManager } from './nebula/NebulaConnectionManager';
import { TYPES } from '../types';

@injectable()
export class NebulaService {
  private nebulaConnection: NebulaConnectionManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConnectionManager) nebulaConnection: NebulaConnectionManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.nebulaConnection = nebulaConnection;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.nebulaConnection.connect();
      if (connected) {
        this.logger.info('NebulaGraph service initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to initialize NebulaGraph service: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'NebulaService', operation: 'initialize' }
      );
      return false;
    }
  }

  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async useSpace(spaceName: string): Promise<void> {
    // 切换到指定的空间
    await this.nebulaConnection.executeQuery(`USE ${spaceName}`);
  }

  async getCurrentSpace(): Promise<string> {
    // 获取当前空间名称
    const result = await this.nebulaConnection.executeQuery('SHOW SPACES');
    // 这里需要根据实际返回结果解析当前空间
    // 由于NebulaGraph的特性，可能需要通过其他方式获取当前空间
    return '';
  }

  async executeTransaction(
    queries: Array<{ nGQL: string; parameters?: Record<string, any> }>
  ): Promise<any[]> {
    // 使用NebulaConnectionManager执行事务
    const formattedQueries = queries.map(q => ({
      query: q.nGQL,
      params: q.parameters,
    }));

    return this.nebulaConnection.executeTransaction(
      formattedQueries.map(q => ({
        query: q.query,
        params: q.params ?? {},
      }))
    );
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    // 使用NebulaConnectionManager创建节点
    return this.nebulaConnection.createNode(node);
  }

  async createRelationship(relationship: {
    type: string;
    sourceId: string;
    targetId: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    // 使用NebulaConnectionManager创建关系
    await this.nebulaConnection.createRelationship(relationship);
  }

  async findNodes(label?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找节点
    if (label) {
      return this.nebulaConnection.findNodesByLabel(label, properties);
    } else {
      // 如果没有指定标签，需要实现一个通用的节点查找方法
      // 这里暂时抛出未实现错误，因为NebulaGraph的实现可能与Neo4j不同
      throw new Error('General node finding not implemented for NebulaGraph');
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找关系
    return this.nebulaConnection.findRelationships(type, properties);
  }

  async getDatabaseStats(): Promise<any> {
    // 使用NebulaConnectionManager获取数据库统计信息
    return this.nebulaConnection.getDatabaseStats();
  }

  isConnected(): boolean {
    return this.nebulaConnection.isConnectedToDatabase();
  }

  async close(): Promise<void> {
    await this.nebulaConnection.disconnect();
  }
}
