import { injectable } from 'inversify';
import * as winston from 'winston';
import * as path from 'path';

@injectable()
export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;
  private static loggerInstance: winston.Logger | null = null;

  constructor() {
    // 使用单例模式避免重复创建logger实例
    if (LoggerService.loggerInstance) {
      this.logger = LoggerService.loggerInstance;
    } else {
      const isTestEnvironment = process.env.NODE_ENV === 'test';
      const transports: winston.transport[] = [
        new winston.transports.Console()
      ];
      
      // 在测试环境中不创建文件传输，避免文件句柄泄漏
      if (!isTestEnvironment) {
        transports.push(
          new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'error.log'),
            level: 'error'
          } as any),
          new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'combined.log')
          } as any)
        );
      }

      this.logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT === 'json' 
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}]: ${message} ${
                  Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
                }`;
              })
            ),
        transports
      });
      LoggerService.loggerInstance = this.logger;
    }
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: any): void {
    this.logger.error(message, error);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }
}