/**
 * 测试用的类型定义
 */
import { Redis } from 'ioredis';

// 简化的Redis mock类型 - 使用any绕过类型检查
export type MockRedis = {
  get: jest.Mock<Promise<string | null>, [string]>;
  set: jest.Mock<Promise<'OK' | null>, [string, string, ...any[]]>;
  setex: jest.Mock<Promise<'OK' | null>, [string, number, string]>;
  del: jest.Mock<Promise<number>, [string]>;
  exists: jest.Mock<Promise<number>, [string]>;
  flushall: jest.Mock<Promise<'OK' | null>, []>;
  quit: jest.Mock<Promise<'OK' | null>, []>;
  info: jest.Mock<Promise<string>, [string?]>;
  on: jest.Mock<any, [string, (...args: any[]) => void]>;
  connect: jest.Mock<Promise<void>, []>;
  disconnect: jest.Mock<void, []>;
  keys: jest.Mock<Promise<string[]>, [string]>;
  scan: jest.Mock<Promise<[string, string[]]>, [string, string, string, number]>;
  dbsize: jest.Mock<Promise<number>, []>;
};

// 创建mock Redis实例的工厂函数
export const createMockRedis = (): MockRedis => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn(),
  info: jest.fn(),
  on: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  keys: jest.fn(),
  scan: jest.fn(),
  dbsize: jest.fn(),
});
