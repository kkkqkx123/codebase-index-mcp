/**
 * 缓存接口定义
 * 提供标准化的缓存操作接口，支持多级缓存实现
 */

export interface CacheInterface<T> {
  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值或null
   */
  get(key: string): Promise<T | null>;

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒），可选
   */
  set(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * 删除缓存键
   * @param key 缓存键
   */
  del(key: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 检查键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  exists(key: string): Promise<boolean>;

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  getStats(): Promise<CacheStats>;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hits: number;        // 命中次数
  misses: number;      // 未命中次数
  size: number;        // 缓存大小
  memoryUsage?: number; // 内存使用（字节）
}

/**
 * 缓存配置选项
 */
export interface CacheOptions {
  ttl?: number;        // 默认过期时间（秒）
  prefix?: string;     // 键前缀
  compression?: boolean; // 是否启用压缩
  maxMemory?: number;  // 最大内存使用（字节）
}

/**
 * 缓存事件类型
 */
export enum CacheEventType {
  HIT = 'hit',
  MISS = 'miss',
  SET = 'set',
  DELETE = 'delete',
  EXPIRE = 'expire',
  ERROR = 'error'
}

/**
 * 缓存事件
 */
export interface CacheEvent {
  type: CacheEventType;
  key: string;
  value?: any;
  error?: Error;
  timestamp: Date;
  duration?: number;
}

/**
 * 缓存监听器接口
 */
export interface CacheListener {
  onEvent(event: CacheEvent): void;
}