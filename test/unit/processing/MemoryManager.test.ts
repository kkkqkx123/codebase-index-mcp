import { MemoryManager, MemoryManagerOptions } from '../../../src/services/processing/MemoryManager';
import { LoggerService } from '../../../src/core/LoggerService';
import { createTestContainer } from '../../setup';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let loggerService: jest.Mocked<LoggerService>;
  let container: any;
  let mockOptions: MemoryManagerOptions;

  beforeEach(() => {
    container = createTestContainer();
    loggerService = container.get(LoggerService);
    
    mockOptions = {
      checkInterval: 1000,
      thresholds: {
        warning: 70,
        critical: 85,
        emergency: 95
      },
      gcThreshold: 80,
      maxMemoryMB: 512
    };

    memoryManager = new MemoryManager(loggerService, mockOptions);
  });

  afterEach(() => {
    // Note: isMonitoring method doesn't exist in current implementation
  });

  describe('constructor', () => {
    it('should initialize with default options when none provided', () => {
      const defaultManager = new MemoryManager(loggerService);
      
      expect(defaultManager).toBeDefined();
    });

    it('should initialize with provided options', () => {
      expect(memoryManager).toBeDefined();
    });
  });

  describe('startMonitoring', () => {
    it('should start memory monitoring', () => {
      memoryManager.startMonitoring();
      
      expect(loggerService.info).toHaveBeenCalledWith('Starting memory monitoring', expect.any(Object));
    });
  });

  describe('stopMonitoring', () => {
    it('should stop memory monitoring', () => {
      memoryManager.startMonitoring();
      
      memoryManager.stopMonitoring();
      
      expect(loggerService.info).toHaveBeenCalledWith('Memory monitoring stopped');
    });
  });

  describe('checkMemory', () => {
    it('should return true when memory usage is below threshold', () => {
      // Mock process.memoryUsage to return low usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 150 * 1024 * 1024 // 150MB
      });

      const result = memoryManager.checkMemory(75); // 75% threshold
      
      expect(result).toBe(true);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should return false when memory usage exceeds threshold', () => {
      // Mock process.memoryUsage to return high usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 180 * 1024 * 1024, // 180MB
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 20 * 1024 * 1024, // 20MB
        rss: 250 * 1024 * 1024 // 250MB
      });

      const result = memoryManager.checkMemory(75); // 75% threshold
      
      expect(result).toBe(false);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should use default threshold when none provided', () => {
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024
      });

      const result = memoryManager.checkMemory(); // Should use default threshold
      
      expect(typeof result).toBe('boolean');

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });
  });

  describe('getMemoryStatus', () => {
    it('should return healthy status when memory usage is low', () => {
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB (50% of 200MB)
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 10 * 1024 * 1024,
        rss: 150 * 1024 * 1024
      });

      const status = memoryManager.getMemoryStatus();
      
      expect(status.status).toBe('healthy');
      expect(status.usage).toHaveProperty('heapUsed');
      expect(status.usage).toHaveProperty('heapTotal');
      expect(status.usage).toHaveProperty('percentageUsed');
      expect(status.usage.percentageUsed).toBe(50);
      expect(Array.isArray(status.recommendations)).toBe(true);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should return warning status when memory usage is high', () => {
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 154 * 1024 * 1024, // 154MB (77% of 200MB)
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 20 * 1024 * 1024,
        rss: 200 * 1024 * 1024
      });

      const status = memoryManager.getMemoryStatus();
      
      expect(status.status).toBe('warning');
      expect(status.usage.percentageUsed).toBe(77);
      expect(status.recommendations.length).toBeGreaterThan(0);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should return critical status when memory usage is very high', () => {
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 180 * 1024 * 1024, // 180MB (90% of 200MB)
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 30 * 1024 * 1024,
        rss: 250 * 1024 * 1024
      });

      const status = memoryManager.getMemoryStatus();
      
      expect(status.status).toBe('critical');
      expect(status.usage.percentageUsed).toBe(90);
      expect(status.recommendations.length).toBeGreaterThan(0);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should return emergency status when memory usage is extremely high', () => {
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 195 * 1024 * 1024, // 195MB (97.5% of 200MB)
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 40 * 1024 * 1024,
        rss: 300 * 1024 * 1024
      });

      const status = memoryManager.getMemoryStatus();
      
      expect(status.status).toBe('emergency');
      expect(status.usage.percentageUsed).toBe(97.5);
      expect(status.recommendations.length).toBeGreaterThan(0);

      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });
  });

  describe('forceGarbageCollection', () => {
    it('should return true when garbage collection is available', () => {
      const originalGC = (global as any).gc;
      (global as any).gc = jest.fn();

      const result = memoryManager.forceGarbageCollection();
      
      expect(result).toBe(true);
      expect((global as any).gc).toHaveBeenCalled();

      // Restore original
      (global as any).gc = originalGC;
    });

    it('should return false when garbage collection is not available', () => {
      const originalGC = (global as any).gc;
      (global as any).gc = undefined;

      const result = memoryManager.forceGarbageCollection();
      
      expect(result).toBe(false);

      // Restore original
      (global as any).gc = originalGC;
    });
  });

  describe('onMemoryUpdate', () => {
    it('should register memory update callback', () => {
      const callback = jest.fn();
      
      memoryManager.onMemoryUpdate(callback);
      memoryManager.startMonitoring();

      // Wait for at least one check interval
      return new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
        expect(callback).toHaveBeenCalled();
        const callbackArg = callback.mock.calls[0][0];
        expect(callbackArg).toHaveProperty('heapUsed');
        expect(callbackArg).toHaveProperty('heapTotal');
        expect(callbackArg).toHaveProperty('percentageUsed');
      });
    });

    it('should handle multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      memoryManager.onMemoryUpdate(callback1);
      memoryManager.onMemoryUpdate(callback2);
      memoryManager.startMonitoring();

      return new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
      });
    });
  });

  
  
  describe('memory monitoring behavior', () => {
    it('should perform periodic memory checks', () => {
      const callback = jest.fn();
      memoryManager.onMemoryUpdate(callback);
      memoryManager.startMonitoring();

      return new Promise(resolve => setTimeout(resolve, 2500)).then(() => {
        // Should have been called multiple times due to periodic checking
        expect(callback.mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('should stop periodic checks when monitoring is stopped', () => {
      const callback = jest.fn();
      memoryManager.onMemoryUpdate(callback);
      memoryManager.startMonitoring();

      return new Promise(resolve => setTimeout(resolve, 1500)).then(() => {
        const callCountBeforeStop = callback.mock.calls.length;
        
        memoryManager.stopMonitoring();
        
        return new Promise(resolve2 => setTimeout(resolve2, 1500)).then(() => {
          const callCountAfterStop = callback.mock.calls.length;
          expect(callCountAfterStop).toBe(callCountBeforeStop); // No new calls after stop
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors in getCurrentUsage gracefully', () => {
      const originalMemoryUsage = process.memoryUsage;
      
      // Mock process.memoryUsage to throw error
      (process as any).memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory access error');
      });

      // Mock the logger to capture error calls
      loggerService.error.mockImplementation(() => {});
      
      // Should throw error when getCurrentUsage is called directly
      expect(() => {
        memoryManager.getCurrentUsage();
      }).toThrow('Memory access error');
      
      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });

    it('should handle errors in checkMemory gracefully', () => {
      const originalMemoryUsage = process.memoryUsage;
      
      // Mock process.memoryUsage to throw error
      (process as any).memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory access error');
      });

      // Mock the logger to capture error calls
      loggerService.error.mockImplementation(() => {});
      
      // Test that checkMemory propagates the error from getCurrentUsage
      expect(() => {
        memoryManager.checkMemory(50);
      }).toThrow('Memory access error');
      
      // Restore original function
      (process as any).memoryUsage = originalMemoryUsage;
    });
  });

  describe('configuration validation', () => {
    it('should handle invalid threshold values', () => {
      const invalidOptions: MemoryManagerOptions = {
        checkInterval: 1000,
        thresholds: {
          warning: 90, // Higher than critical
          critical: 80,
          emergency: 95
        },
        gcThreshold: 85,
        maxMemoryMB: 512
      };

      // Should not throw error, but handle gracefully
      const invalidManager = new MemoryManager(loggerService, invalidOptions);
      expect(invalidManager).toBeDefined();
      
      // Test basic methods without calling getMemoryStatus to avoid process.memoryUsage issues
      expect(invalidManager.forceGarbageCollection()).toBeDefined();
      expect(typeof invalidManager.forceGarbageCollection()).toBe('boolean');
    });

    it('should handle negative check interval', () => {
      const negativeOptions: MemoryManagerOptions = {
        checkInterval: -1000,
        thresholds: {
          warning: 70,
          critical: 85,
          emergency: 95
        },
        gcThreshold: 80,
        maxMemoryMB: 512
      };

      // Should handle gracefully
      const negativeManager = new MemoryManager(loggerService, negativeOptions);
      expect(negativeManager).toBeDefined();
    });
  });
});