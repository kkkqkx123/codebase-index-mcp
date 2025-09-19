describe('LoggerService', () => {
  let LoggerService: any;
  let winston: any;
  let loggerService: any;
  let mockLogger: any;

  beforeEach(() => {
    // Clear module cache and reset singleton instances
    jest.resetModules();
    
    // Reset static properties on LoggerService
    const LoggerServiceModule = require('../LoggerService');
    if (LoggerServiceModule.LoggerService) {
      LoggerServiceModule.LoggerService.instance = null;
      LoggerServiceModule.LoggerService.loggerInstance = null;
    }
    
    jest.doMock('winston', () => ({
      createLogger: jest.fn(),
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

    // Import modules after mocking
    winston = require('winston');
    LoggerService = require('../LoggerService').LoggerService;

    // Create mock logger instance
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    // Mock createLogger to return our mock
    winston.createLogger.mockReturnValue(mockLogger);

    // Create LoggerService instance
    loggerService = new LoggerService();
  });

  describe('Constructor', () => {
    it('should create logger with configuration object', () => {
      // Clear the mock call history to ensure we're testing the initial creation
      winston.createLogger.mockClear();
      
      // Create a new instance to trigger logger creation
      jest.resetModules();
      const LoggerServiceModule = require('../LoggerService');
      if (LoggerServiceModule.LoggerService) {
        LoggerServiceModule.LoggerService.instance = null;
        LoggerServiceModule.LoggerService.loggerInstance = null;
      }
      
      // Re-import and setup mock again
      winston = require('winston');
      LoggerService = require('../LoggerService').LoggerService;
      winston.createLogger.mockReturnValue(mockLogger);
      
      const newLoggerService = new LoggerService();
      
      // The test should check the actual configuration based on environment variables
      // Since LOG_FORMAT is not set, it should use the combined format
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: expect.any(String),
          transports: expect.any(Array),
        })
      );
    });

    it('should use environment variables when provided', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      const originalLogFormat = process.env.LOG_FORMAT;
      const originalNodeEnv = process.env.NODE_ENV;

      // Set environment variables
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'text';
      process.env.NODE_ENV = 'test'; // Set to test to avoid file transports

      // Clear module cache and reset singleton for this test
      jest.resetModules();
      const LoggerServiceModule = require('../LoggerService');
      if (LoggerServiceModule.LoggerService) {
        LoggerServiceModule.LoggerService.instance = null;
        LoggerServiceModule.LoggerService.loggerInstance = null;
      }

      // Re-import with new environment
      winston = require('winston');
      LoggerService = require('../LoggerService').LoggerService;
      
      // Reset the mock to track the new call
      winston.createLogger.mockClear();
      winston.createLogger.mockReturnValue(mockLogger);
      
      const newLoggerService = new LoggerService();

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          transports: expect.any(Array),
        })
      );

      // Restore original environment variables
      if (originalLogLevel !== undefined) {
        process.env.LOG_LEVEL = originalLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
      if (originalLogFormat !== undefined) {
        process.env.LOG_FORMAT = originalLogFormat;
      } else {
        delete process.env.LOG_FORMAT;
      }
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
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
      const originalLogLevel = process.env.LOG_LEVEL;
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Set to test environment to avoid file transports
      process.env.NODE_ENV = 'test';
      
      const testCases = [
        { level: 'error' },
        { level: 'warn' },
        { level: 'info' },
        { level: 'debug' },
        { level: 'verbose' },
      ];

      testCases.forEach(({ level }) => {
        // Clear module cache and reset singleton for each test case
        jest.resetModules();
        const LoggerServiceModule = require('../LoggerService');
        if (LoggerServiceModule.LoggerService) {
          LoggerServiceModule.LoggerService.instance = null;
          LoggerServiceModule.LoggerService.loggerInstance = null;
        }
        
        // Re-import with new environment
        winston = require('winston');
        LoggerService = require('../LoggerService').LoggerService;
        
        // Reset the mock to track the new call
        winston.createLogger.mockClear();
        winston.createLogger.mockReturnValue(mockLogger);
        
        process.env.LOG_LEVEL = level;

        const newLoggerService = new LoggerService();

        expect(winston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
          })
        );
      });
      
      // Restore original environment variables
      if (originalLogLevel !== undefined) {
        process.env.LOG_LEVEL = originalLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });
});
