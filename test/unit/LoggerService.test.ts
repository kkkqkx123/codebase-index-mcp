import { LoggerService } from '../../src/core/LoggerService';
import winston from 'winston';

// Mock winston module
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }),
  format: {
    json: jest.fn().mockReturnValue('json-format'),
    combine: jest.fn().mockReturnValue('combined-format'),
    colorize: jest.fn().mockReturnValue('colorize-format'),
    timestamp: jest.fn().mockReturnValue('timestamp-format'),
    printf: jest.fn().mockReturnValue('printf-format'),
  },
  transports: {
    Console: jest.fn().mockImplementation(() => ({})),
    File: jest.fn().mockImplementation(() => ({})),
  },
}));

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mock logger instance
    mockLogger = (winston.createLogger as jest.Mock)();
    
    // Create LoggerService instance
    loggerService = new LoggerService();
  });

  describe('Constructor', () => {
    it('should create logger with default configuration', () => {
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: expect.any(Object),
        transports: expect.any(Array),
      });
    });

    it('should use environment variables when provided', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'text';

      const newLoggerService = new LoggerService();

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        format: expect.any(Object),
        transports: expect.any(Array),
      });
    });
  });

  describe('info Method', () => {
    it('should call logger.info with message and metadata', () => {
      const message = 'Test info message';
      const metadata = { key: 'value', userId: 123 };

      loggerService.info(message, metadata);

      expect(mockLogger.info).toHaveBeenCalledWith(message, metadata);
    });

    it('should call logger.info with only message when no metadata is provided', () => {
      const message = 'Test info message';

      loggerService.info(message);

      expect(mockLogger.info).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('error Method', () => {
    it('should call logger.error with message and error object', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      loggerService.error(message, error);

      expect(mockLogger.error).toHaveBeenCalledWith(message, error);
    });

    it('should call logger.error with only message when no error is provided', () => {
      const message = 'Test error message';

      loggerService.error(message);

      expect(mockLogger.error).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('warn Method', () => {
    it('should call logger.warn with message and metadata', () => {
      const message = 'Test warning message';
      const metadata = { warning: true, level: 'medium' };

      loggerService.warn(message, metadata);

      expect(mockLogger.warn).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('debug Method', () => {
    it('should call logger.debug with message and metadata', () => {
      const message = 'Test debug message';
      const metadata = { debug: true, data: { nested: true } };

      loggerService.debug(message, metadata);

      expect(mockLogger.debug).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('verbose Method', () => {
    it('should call logger.verbose with message and metadata', () => {
      const message = 'Test verbose message';
      const metadata = { verbose: true, details: 'extra information' };

      loggerService.verbose(message, metadata);

      expect(mockLogger.verbose).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('Log Level Handling', () => {
    it('should use different log levels based on environment', () => {
      const testCases = [
        { level: 'error' },
        { level: 'warn' },
        { level: 'info' },
        { level: 'debug' },
        { level: 'verbose' },
      ];

      testCases.forEach(({ level }) => {
        process.env.LOG_LEVEL = level;
        
        const newLoggerService = new LoggerService();

        expect(winston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
          })
        );
      });
    });
  });
});