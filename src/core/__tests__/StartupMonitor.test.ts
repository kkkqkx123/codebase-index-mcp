import 'reflect-metadata';
import { StartupMonitor, PhaseMetrics, StartupReport } from '../StartupMonitor';
import { DIContainer } from '../DIContainer';

// Mock DIContainer with static methods
jest.mock('../DIContainer', () => {
  const actual = jest.requireActual('../DIContainer');
  return {
    ...actual,
    DIContainer: {
      ...actual.DIContainer,
      getLoadedServices: jest.fn().mockReturnValue([]),
      getInstance: jest.fn(),
      get: jest.fn(),
      reset: jest.fn(),
      isServiceLoaded: jest.fn(),
    }
  };
});

describe('StartupMonitor', () => {
  let startupMonitor: StartupMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    (DIContainer.getLoadedServices as jest.Mock).mockReturnValue([]);
    
    startupMonitor = new StartupMonitor();
  });

  describe('startPhase and endPhase', () => {
    it('should track phase timing correctly', () => {
      const phaseName = 'DatabaseInitialization';
      
      startupMonitor.startPhase(phaseName);
      
      // Wait a bit to simulate work
      return new Promise(resolve => {
        setTimeout(() => {
          startupMonitor.endPhase(phaseName);
          
          const report = startupMonitor.getReport();
          const phaseMetrics = report.phases.find(p => p.name === phaseName);
          
          expect(phaseMetrics).toBeDefined();
          expect(phaseMetrics!.status).toBe('success');
          expect(phaseMetrics!.duration).toBeGreaterThan(0);
          expect(phaseMetrics!.timestamp).toBeDefined();
          
          resolve(void 0);
        }, 10);
      });
    });

    it('should handle phase errors', () => {
      const phaseName = 'ServiceRegistration';
      const error = new Error('Service conflict');
      
      startupMonitor.startPhase(phaseName);
      startupMonitor.endPhase(phaseName, error);
      
      const report = startupMonitor.getReport();
      const phaseMetrics = report.phases.find(p => p.name === phaseName);
      
      expect(phaseMetrics!.status).toBe('failed');
      expect(phaseMetrics!.error).toBe(error.message);
    });

    it('should throw error for ending non-existent phase', () => {
      expect(() => {
        startupMonitor.endPhase('NonExistentPhase');
      }).toThrow('Phase NonExistentPhase was not started');
    });

    it('should throw error for duplicate phase start', () => {
      const phaseName = 'ConfigLoading';
      
      startupMonitor.startPhase(phaseName);
      
      expect(() => {
        startupMonitor.startPhase(phaseName);
      }).toThrow(`Phase ${phaseName} is already in progress`);
    });
  });

  describe('getReport', () => {
    it('should generate comprehensive startup report', () => {
      // Simulate some phases
      startupMonitor.startPhase('ConfigLoading');
      startupMonitor.endPhase('ConfigLoading');
      
      startupMonitor.startPhase('ServiceInitialization');
      startupMonitor.endPhase('ServiceInitialization');
      
      const report = startupMonitor.getReport();
      
      expect(report.totalTime).toBeGreaterThan(0);
      expect(report.phases).toHaveLength(2);
      expect(report.phases.some(p => p.name === 'ConfigLoading')).toBe(true);
      expect(report.phases.some(p => p.name === 'ServiceInitialization')).toBe(true);
      expect(report.loadedServices).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should only include completed phases in report', () => {
      startupMonitor.startPhase('ConfigLoading');
      startupMonitor.endPhase('ConfigLoading');
      
      startupMonitor.startPhase('ServiceInitialization');
      // Don't end this phase - it should NOT be included in the report
      
      const report = startupMonitor.getReport();
      
      const configPhase = report.phases.find(p => p.name === 'ConfigLoading');
      const servicePhase = report.phases.find(p => p.name === 'ServiceInitialization');
      
      expect(configPhase!.status).toBe('success');
      expect(servicePhase).toBeUndefined(); // Ongoing phases should not be in report
    });

    it('should calculate total time correctly', () => {
      startupMonitor.startPhase('Phase1');
      startupMonitor.endPhase('Phase1');
      
      startupMonitor.startPhase('Phase2');
      startupMonitor.endPhase('Phase2');
      
      const report = startupMonitor.getReport();
      
      const totalPhaseTime = report.phases.reduce(
        (sum, phase) => sum + phase.duration, 0
      );
      
      expect(report.totalTime).toBe(totalPhaseTime);
    });
  });

  describe('generateRecommendations', () => {
    it('should suggest optimizations for slow phases', () => {
      // Create a slow phase
      startupMonitor.startPhase('SlowPhase');
      
      // Simulate slow operation
      return new Promise(resolve => {
        setTimeout(() => {
          startupMonitor.endPhase('SlowPhase');
          
          const report = startupMonitor.getReport();
          
          expect(report.recommendations).toContain('优化 SlowPhase 阶段');
          expect(report.recommendations).toContain('慢启动阶段: SlowPhase');
          
          resolve(void 0);
        }, 100);
      });
    });

    it('should suggest service optimization based on loaded services', () => {
      (DIContainer.getLoadedServices as jest.Mock).mockReturnValue([
        'VectorStorageService',
        'GraphPersistenceService',
        'QdrantService',
        'NebulaService',
        'ParserService',
        'IndexService'
      ]);
      
      startupMonitor.startPhase('ServiceLoading');
      startupMonitor.endPhase('ServiceLoading');
      
      const report = startupMonitor.getReport();
      
      expect(report.recommendations).toContain('已加载6个服务');
      expect(report.recommendations).toContain('考虑延迟加载非核心服务');
    });

    it('should provide different recommendations based on total time', () => {
      // Fast startup
      startupMonitor.startPhase('FastPhase');
      startupMonitor.endPhase('FastPhase');
      
      let report = startupMonitor.getReport();
      expect(report.recommendations).toContain('启动性能良好');
      
      // Reset for slow startup
      startupMonitor = new StartupMonitor();
      startupMonitor.startPhase('VerySlowPhase');
      
      return new Promise(resolve => {
        setTimeout(() => {
          startupMonitor.endPhase('VerySlowPhase');
          
          report = startupMonitor.getReport();
          expect(report.recommendations).toContain('启动时间较长');
          
          resolve(void 0);
        }, 200);
      });
    });

    it('should handle failed phases in recommendations', () => {
      const error = new Error('Configuration error');
      
      startupMonitor.startPhase('ConfigLoading');
      startupMonitor.endPhase('ConfigLoading', error);
      
      const report = startupMonitor.getReport();
      
      expect(report.recommendations).toContain('修复 ConfigLoading 阶段的错误');
      expect(report.recommendations).toContain('配置错误');
    });
  });

  describe('loaded services tracking', () => {
    it('should include loaded services in report', () => {
      const loadedServices = ['ConfigService', 'LoggerService', 'ErrorHandlerService'];
      (DIContainer.getLoadedServices as jest.Mock).mockReturnValue(loadedServices);
      
      startupMonitor.startPhase('ServiceLoading');
      startupMonitor.endPhase('ServiceLoading');
      
      const report = startupMonitor.getReport();
      
      expect(report.loadedServices).toEqual(loadedServices);
      expect(DIContainer.getLoadedServices).toHaveBeenCalled();
    });

    it('should handle empty loaded services', () => {
      (DIContainer.getLoadedServices as jest.Mock).mockReturnValue([]);
      
      startupMonitor.startPhase('ServiceLoading');
      startupMonitor.endPhase('ServiceLoading');
      
      const report = startupMonitor.getReport();
      
      expect(report.loadedServices).toEqual([]);
      expect(report.recommendations).toContain('暂无服务加载');
    });

    it('should handle DIContainer errors gracefully', () => {
      (DIContainer.getLoadedServices as jest.Mock).mockImplementation(() => {
        throw new Error('Container not initialized');
      });
      
      startupMonitor.startPhase('ServiceLoading');
      startupMonitor.endPhase('ServiceLoading');
      
      const report = startupMonitor.getReport();
      
      expect(report.loadedServices).toEqual([]);
      expect(report.recommendations).toContain('无法获取已加载服务列表');
    });
  });

  describe('phase metrics analysis', () => {
    it('should identify slowest phase', () => {
      startupMonitor.startPhase('FastPhase');
      startupMonitor.endPhase('FastPhase');
      
      startupMonitor.startPhase('SlowPhase');
      
      return new Promise(resolve => {
        setTimeout(() => {
          startupMonitor.endPhase('SlowPhase');
          
          const report = startupMonitor.getReport();
          
          expect(report.slowPhases.length).toBeGreaterThan(0);
      expect(report.slowPhases.some(p => p.name === 'SlowPhase')).toBe(true);
          
          resolve(void 0);
        }, 50);
      });
    });

    it('should handle multiple phases with same duration', () => {
      startupMonitor.startPhase('Phase1');
      startupMonitor.endPhase('Phase1');
      
      startupMonitor.startPhase('Phase2');
      startupMonitor.endPhase('Phase2');
      
      const report = startupMonitor.getReport();
      
      // Both phases should have similar duration, report should handle this
      expect(report.slowPhases.length).toBeGreaterThan(0);
    });

    it('should calculate phase statistics correctly', () => {
      const phases = ['Phase1', 'Phase2', 'Phase3'];
      
      phases.forEach(phase => {
        startupMonitor.startPhase(phase);
        startupMonitor.endPhase(phase);
      });
      
      const report = startupMonitor.getReport();
      
      expect(report.phases).toHaveLength(phases.length);
      expect(report.phases.filter(p => p.status === 'success')).toHaveLength(phases.length);
      expect(report.phases.filter(p => p.status === 'failed')).toHaveLength(0);
    });

    it('should track failed phases in statistics', () => {
      startupMonitor.startPhase('SuccessfulPhase');
      startupMonitor.endPhase('SuccessfulPhase');
      
      startupMonitor.startPhase('FailedPhase');
      startupMonitor.endPhase('FailedPhase', new Error('Failure'));
      
      const report = startupMonitor.getReport();
      
      expect(report.phases).toHaveLength(2);
      expect(report.phases.filter(p => p.status === 'success')).toHaveLength(1);
      expect(report.phases.filter(p => p.status === 'failed')).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very short phases', () => {
      startupMonitor.startPhase('InstantPhase');
      startupMonitor.endPhase('InstantPhase');
      
      const report = startupMonitor.getReport();
      const phaseMetrics = report.phases.find(p => p.name === 'InstantPhase');
      
      expect(phaseMetrics!.duration).toBe(0); // Should be 0 or very small
      expect(phaseMetrics!.status).toBe('success');
    });

    it('should handle phases with zero duration', () => {
      const startTime = Date.now();
      // Use the actual Map structure
      startupMonitor['phases'] = new Map([
        ['TestPhase', {
          start: startTime,
          status: 'running'
        }]
      ]);
      startupMonitor['metrics'] = [{
        name: 'TestPhase',
        duration: 0,
        status: 'success',
        timestamp: startTime
      }];
      
      const report = startupMonitor.getReport();
      const testPhase = report.phases.find(p => p.name === 'TestPhase');
      expect(testPhase!.duration).toBe(0);
    });

    it('should handle system clock changes during monitoring', () => {
      // This is a theoretical test for clock skew scenarios
      startupMonitor.startPhase('Phase1');
      
      // Simulate clock going backwards (unlikely but possible)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() - 1000);
      
      startupMonitor.endPhase('Phase1');
      
      // Restore original
      Date.now = originalDateNow;
      
      const report = startupMonitor.getReport();
      const phase1 = report.phases.find(p => p.name === 'Phase1');
      // Should handle negative duration gracefully
      expect(phase1!.duration).toBe(0);
    });
  });
});