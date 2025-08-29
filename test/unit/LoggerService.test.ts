import { LoggerService } from '../../src/core/LoggerService';
import winston from 'winston';
import path from 'path';

// Mock winston
jest.mock('winston');
const mockedWinston = winston as jest.Mocked<typeof winston>;

// Mock path.join
jest.mock('path');
const mockedPath = path as jest.Mocked<typeof path>;

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockCreateLogger: jest.Mock;
  let mockConsoleTransport: jest.Mocked<winston.transports.ConsoleTransportInstance>;
  let mockFileTransport1: jest.Mocked<winston.transports.FileTransportInstance>;
  let mockFileTransport2: jest.Mocked<winston.transports.FileTransportInstance>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock path.join
    mockedPath.join.mockImplementation((...paths) => paths.join('/'));
    
    // Mock transports
    mockConsoleTransport = {
      on: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockFileTransport1 = {
      on: jest.fn(),
      close: jest.fn(),
    } as any;
    
    mockFileTransport2 = {
      on: jest.fn(),
      close: jest.fn(),
    } as any;
    
    // Mock winston transports constructors
    mockedWinston.transports.Console = jest.fn().mockImplementation(() => mockConsoleTransport);
    mockedWinston.transports.File = jest.fn()
      .mockImplementationOnce(() => mockFileTransport1)
      .mockImplementationOnce(() => mockFileTransport2);
    
    // Mock logger methods
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    
    mockCreateLogger = jest.fn().mockReturnValue(mockLogger);
    mockedWinston.createLogger = mockCreateLogger;
    
    // Create LoggerService instance
    loggerService = new LoggerService();
  });

  afterEach(() => {
    // Clean up
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create logger with default configuration when no environment variables are set', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_FORMAT;

      const newLoggerService = new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: expect.any(Object),
        transports: [
          mockConsoleTransport,
          mockFileTransport1,
          mockFileTransport2,
        ],
      });
    });

    it('should use environment variables when provided', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'text';

      const newLoggerService = new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        format: expect.any(Object),
        transports: [
          mockConsoleTransport,
          mockFileTransport1,
          mockFileTransport2,
        ],
      });
    });

    it('should create file transports with correct file paths', () => {
      new LoggerService();

      expect(mockedWinston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
      });

      expect(mockedWinston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
      });
    });

    it('should use JSON format when LOG_FORMAT is json', () => {
      process.env.LOG_FORMAT = 'json';

      new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: mockedWinston.format.json(),
        transports: expect.any(Array),
      });
    });

    it('should use text format when LOG_FORMAT is not json', () => {
      process.env.LOG_FORMAT = 'text';

      new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: mockedWinston.format.combine(
          mockedWinston.format.colorize(),
          mockedWinston.format.timestamp(),
          expect.any(Function)
        ),
        transports: expect.any(Array),
      });
    });
  });

  describe('info Method', () => {
    it('should call logger.info with message and metadata', () => {
      const message = 'Test info message';
      const metadata = { key: 'value', userId: 123 };

      loggerService.info(message, metadata);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, metadata);
    });

    it('should call logger.info with only message when no metadata is provided', () => {
      const message = 'Test info message';

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle empty metadata object', () => {
      const message = 'Test info message';
      const metadata = {};

      loggerService.info(message, metadata);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('error Method', () => {
    it('should call logger.error with message and error object', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      loggerService.error(message, error);

      expect(mockCreateLogger().error).toHaveBeenCalledWith(message, error);
    });

    it('should call logger.error with only message when no error is provided', () => {
      const message = 'Test error message';

      loggerService.error(message);

      expect(mockCreateLogger().error).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle string error', () => {
      const message = 'Test error message';
      const error = 'String error';

      loggerService.error(message, error);

      expect(mockCreateLogger().error).toHaveBeenCalledWith(message, error);
    });

    it('should handle complex error object with stack trace', () => {
      const message = 'Test error message';
      const error = {
        message: 'Complex error',
        stack: 'Error stack trace',
        code: 'ERR_TEST',
        metadata: { field: 'value' }
      };

      loggerService.error(message, error);

      expect(mockCreateLogger().error).toHaveBeenCalledWith(message, error);
    });
  });

  describe('warn Method', () => {
    it('should call logger.warn with message and metadata', () => {
      const message = 'Test warning message';
      const metadata = { warning: true, level: 'medium' };

      loggerService.warn(message, metadata);

      expect(mockCreateLogger().warn).toHaveBeenCalledWith(message, metadata);
    });

    it('should call logger.warn with only message when no metadata is provided', () => {
      const message = 'Test warning message';

      loggerService.warn(message);

      expect(mockCreateLogger().warn).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('debug Method', () => {
    it('should call logger.debug with message and metadata', () => {
      const message = 'Test debug message';
      const metadata = { debug: true, data: { nested: true } };

      loggerService.debug(message, metadata);

      expect(mockCreateLogger().debug).toHaveBeenCalledWith(message, metadata);
    });

    it('should call logger.debug with only message when no metadata is provided', () => {
      const message = 'Test debug message';

      loggerService.debug(message);

      expect(mockCreateLogger().debug).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('verbose Method', () => {
    it('should call logger.verbose with message and metadata', () => {
      const message = 'Test verbose message';
      const metadata = { verbose: true, details: 'extra information' };

      loggerService.verbose(message, metadata);

      expect(mockCreateLogger().verbose).toHaveBeenCalledWith(message, metadata);
    });

    it('should call logger.verbose with only message when no metadata is provided', () => {
      const message = 'Test verbose message';

      loggerService.verbose(message);

      expect(mockCreateLogger().verbose).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('Log Level Handling', () => {
    it('should use different log levels based on environment', () => {
      const testCases = [
        { level: 'error', method: 'error' },
        { level: 'warn', method: 'warn' },
        { level: 'info', method: 'info' },
        { level: 'debug', method: 'debug' },
        { level: 'verbose', method: 'verbose' },
      ];

      testCases.forEach(({ level, method }) => {
        process.env.LOG_LEVEL = level;
        const newLoggerService = new LoggerService();

        expect(mockedWinston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
          })
        );
      });
    });

    it('should default to info level when invalid log level is provided', () => {
      process.env.LOG_LEVEL = 'invalid';

      const newLoggerService = new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
        })
      );
    });
  });

  describe('Format Handling', () => {
    it('should handle undefined log format', () => {
      delete process.env.LOG_FORMAT;

      const newLoggerService = new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: mockedWinston.format.combine(
            mockedWinston.format.colorize(),
            mockedWinston.format.timestamp(),
            expect.any(Function)
          ),
        })
      );
    });

    it('should handle empty log format', () => {
      process.env.LOG_FORMAT = '';

      const newLoggerService = new LoggerService();

      expect(mockedWinston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: mockedWinston.format.combine(
            mockedWinston.format.colorize(),
            mockedWinston.format.timestamp(),
            expect.any(Function)
          ),
        })
      );
    });
  });

  describe('Transport Configuration', () => {
    it('should create exactly three transports', () => {
      new LoggerService();

      expect(mockedWinston.transports.Console).toHaveBeenCalledTimes(1);
      expect(mockedWinston.transports.File).toHaveBeenCalledTimes(2);
    });

    it('should configure console transport correctly', () => {
      new LoggerService();

      expect(mockedWinston.transports.Console).toHaveBeenCalledWith();
    });

    it('should configure error file transport with error level', () => {
      new LoggerService();

      expect(mockedWinston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
      });
    });

    it('should configure combined file transport without level restriction', () => {
      new LoggerService();

      expect(mockedWinston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
      });
    });
  });

  describe('Metadata Handling', () => {
    it('should handle null metadata', () => {
      const message = 'Test message';
      const metadata = null;

      loggerService.info(message, metadata as any);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, null);
    });

    it('should handle undefined metadata', () => {
      const message = 'Test message';
      const metadata = undefined;

      loggerService.info(message, metadata);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle complex nested metadata', () => {
      const message = 'Test message';
      const metadata = {
        user: {
          id: 123,
          name: 'John Doe',
          roles: ['admin', 'user'],
        },
        request: {
          method: 'GET',
          url: '/api/test',
          headers: {
            'user-agent': 'test-agent',
          },
        },
        timestamp: new Date(),
      };

      loggerService.info(message, metadata);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, metadata);
    });

    it('should handle metadata with circular references', () => {
      const message = 'Test message';
      const metadata: any = { name: 'test' };
      metadata.self = metadata; // Circular reference

      loggerService.info(message, metadata);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('Message Handling', () => {
    it('should handle empty string message', () => {
      const message = '';

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith('', undefined);
    });

    it('should handle whitespace-only message', () => {
      const message = '   ';

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith('   ', undefined);
    });

    it('should handle very long messages', () => {
      const message = 'x'.repeat(10000);

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle messages with special characters', () => {
      const message = 'Test message with émojis 🚀 and special chars: áéíóú 中文';

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(message, undefined);
    });

    it('should handle numeric messages', () => {
      const message = 12345 as any;

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(12345, undefined);
    });

    it('should handle boolean messages', () => {
      const message = true as any;

      loggerService.info(message);

      expect(mockCreateLogger().info).toHaveBeenCalledWith(true, undefined);
    });
  });
});