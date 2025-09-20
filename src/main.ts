import 'reflect-metadata';
import { DIContainer } from './core/DIContainer';
import { TYPES } from './types';
import { ConfigService } from './config/ConfigService';
import { LoggerService } from './core/LoggerService';
import { ErrorHandlerService } from './core/ErrorHandlerService';
import { StartupMonitor } from './core/StartupMonitor';

// Utility function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, serviceName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${serviceName} timed out after ${ms}ms`)), ms)
    )
  ]);
}

async function main(): Promise<void> {
  // Create startup monitor
  const startupMonitor = new StartupMonitor();
  
  try {
    startupMonitor.startPhase('di-container-initialization');
    const container = DIContainer.getInstance();
    const config = await DIContainer.get<ConfigService>(TYPES.ConfigService);
    const logger = await DIContainer.get<LoggerService>(TYPES.LoggerService);
    const errorHandler = await DIContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    startupMonitor.endPhase('di-container-initialization');

    logger.info('Starting Codebase Index Service', {
      version: '1.0.0',
      environment: config.get('nodeEnv'),
      port: config.get('port'),
    });

    // Then load other services in a specific order
    startupMonitor.startPhase('storage-services-loading');
    const vectorStorage = await DIContainer.get<any>(TYPES.VectorStorageService);
    const graphStorage = await DIContainer.get<any>(TYPES.GraphPersistenceService);
    startupMonitor.endPhase('storage-services-loading');

    // Finally load server services
    startupMonitor.startPhase('server-services-loading');
    const httpServer = await DIContainer.get<any>(TYPES.HttpServer);
    const mcpServer = await DIContainer.get<any>(TYPES.MCPServer);
    startupMonitor.endPhase('server-services-loading');
    
    // Initialize HttpServer
    startupMonitor.startPhase('http-server-initialization');
    logger.info('Initializing HTTP server...');
    await httpServer.initialize();
    startupMonitor.endPhase('http-server-initialization');
    
    // Initialize storage services
    startupMonitor.startPhase('storage-initialization');
    logger.info('Initializing storage services...');
    await Promise.all([
      vectorStorage.initialize(),
      graphStorage.initialize()
    ]);
    startupMonitor.endPhase('storage-initialization');

    // Start servers
    startupMonitor.startPhase('server-startup');
    logger.info('Starting servers...');
    await Promise.all([
      httpServer.start(),
      mcpServer.start()
    ]);
    startupMonitor.endPhase('server-startup');

    logger.info('Codebase Index Service started successfully');

    // Output startup report
    const startupReport = startupMonitor.getReport();
    logger.info('Startup performance report:', startupReport);

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        // Close storage services
        if (vectorStorage.isServiceInitialized && typeof vectorStorage.close === 'function') {
          await vectorStorage.close();
        }
        if (graphStorage.isServiceInitialized && typeof graphStorage.close === 'function') {
          await graphStorage.close();
        }
        
        // Stop servers
        await httpServer.stop();
        await mcpServer.stop();
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
          component: 'Process',
          operation: 'gracefulShutdown',
        });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

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
  } catch (error) {
    const startupReport = startupMonitor.getReport();
    console.error('Failed to start Codebase Index Service:', error);
    console.log('Startup performance report:', startupReport);
    process.exit(1);
  }
}

main().catch(async error => {
  const logger = await DIContainer.get<LoggerService>(TYPES.LoggerService);
  const errorHandler = await DIContainer.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
  
  logger.error('Fatal error in main process', error);
  errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
    component: 'Process',
    operation: 'main',
  });
  process.exit(1);
});
