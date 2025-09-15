import 'reflect-metadata';
import { DIContainer } from './core/DIContainer';
import { TYPES } from './types';
import { MCPServer } from './mcp/MCPServer';
import { HttpServer } from './api/HttpServer';
import { ConfigService } from './config/ConfigService';
import { LoggerService } from './core/LoggerService';
import { ErrorHandlerService } from './core/ErrorHandlerService';

async function main(): Promise<void> {
  try {
    const container = DIContainer.getInstance();
    const config = container.get<ConfigService>(TYPES.ConfigService); // 改为直接使用 TYPES
    const logger = container.get<LoggerService>(TYPES.LoggerService); // 改为直接使用 TYPES
    const errorHandler = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService); // 改为直接使用 TYPES

    logger.info('Starting Codebase Index Service', {
      version: '1.0.0',
      environment: config.get('nodeEnv'),
      port: config.get('port'),
    });

    // Start HTTP server
    const httpServer = new HttpServer();
    await httpServer.start();

    const server = new MCPServer();

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception', error);
      errorHandler.handleError(error, {
        component: 'Process',
        operation: 'uncaughtException',
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      errorHandler.handleError(new Error(String(reason)), {
        component: 'Process',
        operation: 'unhandledRejection',
      });
    });

    await server.start();
    logger.info('Codebase Index Service started successfully');
  } catch (error) {
    console.error('Failed to start Codebase Index Service:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
