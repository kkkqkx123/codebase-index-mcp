import { Redis } from 'ioredis';
import { LoggerService } from '../../core/LoggerService';
import { RedisConfig } from '../../config/RedisConfig';

export class RedisConfigManager {
  private static logger = new LoggerService();

  /**
   * 配置Redis实例的内存限制和其他设置
   */
  static async configureRedis(redis: Redis, config: RedisConfig): Promise<void> {
    try {
      // 设置最大内存限制
      if (config.maxmemory) {
        await redis.config('SET', 'maxmemory', config.maxmemory);
        this.logger.info(`已设置Redis最大内存限制: ${config.maxmemory}`);
      }

      // 设置内存淘汰策略为LRU
      await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
      this.logger.info('已设置Redis内存淘汰策略: allkeys-lru');

      // 验证配置
      const maxmemory = await redis.config('GET', 'maxmemory') as [string, string];
      const policy = await redis.config('GET', 'maxmemory-policy') as [string, string];
      
      this.logger.info(`Redis内存配置确认 - maxmemory: ${maxmemory[1]}, policy: ${policy[1]}`);
    } catch (error) {
      this.logger.error('配置Redis内存设置失败', error);
      throw error;
    }
  }

  /**
   * 获取当前Redis内存使用情况
   */
  static async getMemoryInfo(redis: Redis): Promise<{
    usedMemory: number;
    maxMemory: number;
    memoryUsage: number;
  }> {
    try {
      const info = await redis.info('memory');
      const lines = info.split('\r\n');
      
      let usedMemory = 0;
      let maxMemory = 0;
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedMemory = parseInt(line.split(':')[1]) || 0;
        }
        if (line.startsWith('maxmemory:')) {
          maxMemory = parseInt(line.split(':')[1]) || 0;
        }
      }
      
      const memoryUsage = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;
      
      return {
        usedMemory,
        maxMemory,
        memoryUsage
      };
    } catch (error) {
      this.logger.error('获取Redis内存信息失败', error);
      throw error;
    }
  }

  /**
   * 清理Redis中的所有数据（谨慎使用）
   */
  static async flushAll(redis: Redis): Promise<void> {
    try {
      await redis.flushall();
      this.logger.warn('已清空Redis所有数据');
    } catch (error) {
      this.logger.error('清空Redis数据失败', error);
      throw error;
    }
  }

  /**
   * 清理当前数据库
   */
  static async flushDb(redis: Redis): Promise<void> {
    try {
      await redis.flushdb();
      this.logger.warn('已清空当前Redis数据库');
    } catch (error) {
      this.logger.error('清空Redis数据库失败', error);
      throw error;
    }
  }

  /**
   * 获取Redis统计信息
   */
  static async getRedisStats(redis: Redis): Promise<{
    version: string;
    uptime: number;
    connectedClients: number;
    usedMemory: number;
    maxMemory: number;
    memoryUsage: number;
    keyspace: Record<string, any>;
  }> {
    try {
      const info = await redis.info();
      const lines = info.split('\r\n');
      
      const stats = {
        version: '',
        uptime: 0,
        connectedClients: 0,
        usedMemory: 0,
        maxMemory: 0,
        memoryUsage: 0,
        keyspace: {} as Record<string, string>
      };

      for (const line of lines) {
        if (line.startsWith('redis_version:')) {
          stats.version = line.split(':')[1];
        }
        if (line.startsWith('uptime_in_seconds:')) {
          stats.uptime = parseInt(line.split(':')[1]) || 0;
        }
        if (line.startsWith('connected_clients:')) {
          stats.connectedClients = parseInt(line.split(':')[1]) || 0;
        }
        if (line.startsWith('used_memory:')) {
          stats.usedMemory = parseInt(line.split(':')[1]) || 0;
        }
        if (line.startsWith('maxmemory:')) {
          stats.maxMemory = parseInt(line.split(':')[1]) || 0;
        }
      }

      try {
        const keyspaceInfo = await redis.info('keyspace');
        const keyspaceLines = keyspaceInfo.split('\r\n');
        
        for (const line of keyspaceLines) {
          if (line.includes('keys=')) {
            const [db, info] = line.split(':');
            stats.keyspace[db] = info;
          }
        }
      } catch (error) {
        // keyspace可能为空，忽略错误
      }

      stats.memoryUsage = stats.maxMemory > 0 ? (stats.usedMemory / stats.maxMemory) * 100 : 0;

      return stats;
    } catch (error) {
      this.logger.error('获取Redis统计信息失败', error);
      throw error;
    }
  }
}