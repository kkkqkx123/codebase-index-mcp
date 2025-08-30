import express, { Application, Request, Response, NextFunction } from 'express';
import { DIContainer, TYPES } from '../core/DIContainer';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { SnippetRoutes } from './routes/SnippetRoutes';
import { MonitoringRoutes } from './routes/MonitoringRoutes';

export class HttpServer {
  private app: Application;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private port: number;

  constructor() {
    const container = DIContainer.getInstance();
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.errorHandler = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    this.configService = container.get<ConfigService>(TYPES.ConfigService);
    
    this.port = this.configService.get('port') || 3000;
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.path}`, {
        query: req.query,
        body: req.body,
        ip: req.ip
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'codebase-index-api'
      });
    });
    
    // API routes
    this.app.use('/api/v1/snippets', new SnippetRoutes().getRouter());
    this.app.use('/api/v1/monitoring', new MonitoringRoutes().getRouter());
    
    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'Codebase Index API Service',
        version: '1.0.0',
        documentation: '/api-docs'
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
      });
    });
    
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.errorHandler.handleError(error, {
        component: 'HttpServer',
        operation: 'globalErrorHandler',
        method: req.method
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(this.port, () => {
        this.logger.info(`HTTP Server started successfully`, {
          port: this.port,
          environment: this.configService.get('nodeEnv')
        });
        resolve();
      }).on('error', (error) => {
        this.logger.error('Failed to start HTTP Server', error);
        reject(error);
      });
    });
  }

  getApp(): Application {
    return this.app;
  }
}