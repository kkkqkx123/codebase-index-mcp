import express, { Application, Request, Response, NextFunction } from 'express';
import { DIContainer, TYPES } from '../core/DIContainer';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { SnippetRoutes } from './routes/SnippetRoutes';
import { MonitoringRoutes } from './routes/MonitoringRoutes';
import { StaticAnalysisRoutes } from './routes/StaticAnalysisRoutes';

export class HttpServer {
  private app: Application;
  private server: any; // Store the server instance
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private monitoringController: any; // We'll fix the type later
  private port: number;
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;

  constructor() {
    const container = DIContainer.getInstance();
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.errorHandler = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
    this.configService = container.get<ConfigService>(TYPES.ConfigService);
    
    this.monitoringController = container.get(TYPES.MonitoringController);
    this.port = this.configService.get('port') || 3000;
    this.rateLimitMap = new Map();
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
    
    // Rate limiting middleware
    this.app.use(this.rateLimitingMiddleware.bind(this));
    
    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('Origin');
      // Cast configService to any to access getServerConfig method (which exists in the mock)
      const corsConfig = (this.configService as any).getServerConfig().cors;
      
      // Check if CORS is enabled
      if (corsConfig?.enabled) {
        // Check if origin is allowed
        if (corsConfig.origins.includes(origin || '')) {
          res.header('Access-Control-Allow-Origin', origin || '*');
        } else if (origin) {
          // If origin is not allowed, return 403
          return res.status(403).json({
            success: false,
            error: 'CORS origin not allowed'
          });
        }
        
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        if (req.method === 'OPTIONS') {
          return res.status(204).send();
        }
      }
      
      return next();
    });
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      try {
        this.logger.info(`Request ${req.method} ${req.path}`, {
          method: req.method,
          url: req.path,
          query: req.query,
          body: req.body,
          ip: req.ip
        });
      } catch (error) {
        console.error('Error in request logging middleware:', error);
      }
      return next();
    });
  }

  private rateLimitingMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Cast configService to any to access getServerConfig method (which exists in the mock)
    const rateLimitConfig = (this.configService as any).getServerConfig().rateLimit;
    
    // If rate limiting is not configured, skip
    if (!rateLimitConfig) {
      return next();
    }
    
    const windowMs = rateLimitConfig.windowMs || 15 * 60 * 1000; // Default 15 minutes
    const max = rateLimitConfig.max || 100; // Default 100 requests
    
    // Use IP as key for rate limiting
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    // Get or create rate limit info for this IP
    let rateLimitInfo = this.rateLimitMap.get(key);
    
    // Reset count if window has expired
    if (!rateLimitInfo || rateLimitInfo.resetTime <= now) {
      rateLimitInfo = {
        count: 0,
        resetTime: now + windowMs
      };
      this.rateLimitMap.set(key, rateLimitInfo);
    }
    
    // Increment count
    rateLimitInfo.count++;
    
    // Check if limit exceeded
    if (rateLimitInfo.count > max) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded'
      });
      return;
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rateLimitInfo.count));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).toUTCString());
    
    return next();
  }

  private setupRoutes(): void {
    // Health check endpoint - moved to MonitoringRoutes
    // Metrics endpoint - moved to MonitoringRoutes
    
    // API routes
    this.app.use('/api/v1/snippets', new SnippetRoutes().getRouter());
    this.app.use('/api/v1/monitoring', new MonitoringRoutes().getRouter());
    this.app.use('/api/v1/analysis', new StaticAnalysisRoutes().getRouter());
    
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const result = await this.monitoringController.getHealthStatus();
        res.status(result.status === 'healthy' ? 200 : 503).json(result);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    });
    
    // Metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      try {
        const result = await this.monitoringController.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.status(200).send(result);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to retrieve metrics'
        });
      }
    });
    
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
        metadata: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent')
        }
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      });
    });
  }

  async start(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`HTTP server started`, {
          port: this.port,
          host: 'localhost',
          environment: this.configService.get('nodeEnv')
        });
        resolve(this.server);
      }).on('error', (error) => {
        this.logger.error('Failed to start HTTP Server', error);
        reject(error);
      });
    });
  }

  // Add a method to close the server
  async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  getApp(): Application {
    return this.app;
  }
}