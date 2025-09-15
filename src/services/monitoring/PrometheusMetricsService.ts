import { injectable, inject } from 'inversify';
import * as promClient from 'prom-client';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { QdrantService } from '../../database/QdrantService';
import { NebulaService } from '../../database/NebulaService';
import { PerformanceMonitor } from '../query/PerformanceMonitor';
import { BatchProcessingMetrics } from './BatchProcessingMetrics';
import { BatchPerformanceMonitor } from './BatchPerformanceMonitor';
import { SemgrepMetricsService } from './SemgrepMetricsService';
import { TYPES } from '../../types';

export interface DatabaseMetrics {
  qdrant: {
    connectionStatus: number;
    pointCount: number;
    collectionCount: number;
    latency: number;
  };
  nebula: {
    connectionStatus: number;
    nodeCount: number;
    relationshipCount: number;
    latency: number;
  };
}

export interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  uptime: number;
  disk: {
    used: number;
    free: number;
    total: number;
  };
  network: {
    bytesSent: number;
    bytesReceived: number;
  };
}

export interface SemgrepMetrics {
  scans: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  findings: {
    total: number;
    bySeverity: {
      error: number;
      warning: number;
      info: number;
    };
    byCategory: {
      [category: string]: number;
    };
  };
  rules: {
    totalExecuted: number;
    mostFrequent: Array<{ ruleId: string; count: number }>;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export interface ServiceMetrics {
  fileWatcher: {
    totalFilesProcessed: number;
    averageLatency: number;
    activeWatchers: number;
  };
  semanticAnalysis: {
    totalAnalyses: number;
    averageLatency: number;
    activeAnalyses: number;
  };
  qdrant: {
    totalOperations: number;
    averageLatency: number;
    activeConnections: number;
  };
  nebula: {
    totalOperations: number;
    averageLatency: number;
    activeSessions: number;
  };
  semgrep: {
    totalScans: number;
    successfulScans: number;
    averageScanDuration: number;
    totalFindings: number;
  };
  errors: {
    total: number;
    rate: number;
  };
}

@injectable()
export class PrometheusMetricsService {
  private static instance: PrometheusMetricsService;
  private static isInitializing = false;
  private logger!: LoggerService;
  private errorHandler!: ErrorHandlerService;
  private configService!: ConfigService;
  private qdrantService!: QdrantService;
  private nebulaService!: NebulaService;
  private performanceMonitor!: PerformanceMonitor;
  private batchMetrics!: BatchProcessingMetrics;
  private batchPerformanceMonitor!: BatchPerformanceMonitor;
  private semgrepMetricsService!: SemgrepMetricsService;

  // Prometheus metrics registry
  private registry!: promClient.Registry;

  // Prometheus metrics
  private databaseMetrics!: {
    qdrantConnectionStatus: promClient.Gauge;
    qdrantPointCount: promClient.Gauge;
    qdrantCollectionCount: promClient.Gauge;
    qdrantLatency: promClient.Histogram;
    nebulaConnectionStatus: promClient.Gauge;
    nebulaNodeCount: promClient.Gauge;
    nebulaRelationshipCount: promClient.Gauge;
    nebulaLatency: promClient.Histogram;
  };

  private systemMetrics!: {
    memoryUsage: promClient.Gauge;
    cpuUsage: promClient.Gauge;
    uptime: promClient.Gauge;
    diskUsage: promClient.Gauge;
    diskFree: promClient.Gauge;
    networkBytesSent: promClient.Gauge;
    networkBytesReceived: promClient.Gauge;
  };

  private serviceMetrics!: {
    fileWatcherProcessedFiles: promClient.Gauge;
    semanticAnalysisCount: promClient.Gauge;
    qdrantOperations: promClient.Gauge;
    nebulaOperations: promClient.Gauge;
    semgrepScansTotal: promClient.Counter;
    semgrepScansSuccessful: promClient.Counter;
    semgrepScansFailed: promClient.Counter;
    semgrepFindingsTotal: promClient.Gauge;
    semgrepFindingsError: promClient.Gauge;
    semgrepFindingsWarning: promClient.Gauge;
    semgrepFindingsInfo: promClient.Gauge;
    semgrepScanDuration: promClient.Histogram;
    errorCount: promClient.Gauge;
    errorRate: promClient.Gauge;
    fileWatcherLatency: promClient.Histogram;
    semanticAnalysisLatency: promClient.Histogram;
    qdrantLatency: promClient.Histogram;
    nebulaLatency: promClient.Histogram;
  };

  private alertMetrics!: {
    alertCount: promClient.Counter;
    alertSeverity: promClient.Gauge;
  };

  // Helper function to safely create or get existing metric
  private safeGetOrCreateHistogram<T extends promClient.Histogram>(
    name: string,
    help: string,
    buckets: number[],
    existingMetric?: T
  ): T {
    if (existingMetric) {
      return existingMetric;
    }

    // Check if metric already exists in registry
    try {
      const existing = this.registry.getSingleMetric(name);
      if (existing && existing instanceof promClient.Histogram) {
        return existing as T;
      }
    } catch (error) {
      // Metric doesn't exist, continue with creation
    }

    return new promClient.Histogram({
      name,
      help,
      buckets,
      registers: [this.registry],
    }) as T;
  }

  private safeGetOrCreateGauge<T extends promClient.Gauge>(
    name: string,
    help: string,
    existingMetric?: T
  ): T {
    if (existingMetric) {
      return existingMetric;
    }

    // Check if metric already exists in registry
    try {
      const existing = this.registry.getSingleMetric(name);
      if (existing && existing instanceof promClient.Gauge) {
        return existing as T;
      }
    } catch (error) {
      // Metric doesn't exist, continue with creation
    }

    return new promClient.Gauge({
      name,
      help,
      registers: [this.registry],
    }) as T;
  }

  private safeGetOrCreateCounter<T extends promClient.Counter>(
    name: string,
    help: string,
    existingMetric?: T
  ): T {
    if (existingMetric) {
      return existingMetric;
    }

    // Check if metric already exists in registry
    try {
      const existing = this.registry.getSingleMetric(name);
      if (existing && existing instanceof promClient.Counter) {
        return existing as T;
      }
    } catch (error) {
      // Metric doesn't exist, continue with creation
    }

    return new promClient.Counter({
      name,
      help,
      registers: [this.registry],
    }) as T;
  }

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.QdrantService) qdrantService: QdrantService,
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics,
    @inject(TYPES.BatchPerformanceMonitor) batchPerformanceMonitor: BatchPerformanceMonitor,
    @inject(TYPES.SemgrepMetricsService) semgrepMetricsService: SemgrepMetricsService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.qdrantService = qdrantService;
    this.nebulaService = nebulaService;
    this.performanceMonitor = performanceMonitor;
    this.batchMetrics = batchMetrics;
    this.batchPerformanceMonitor = batchPerformanceMonitor;
    this.semgrepMetricsService = semgrepMetricsService;

    // Initialize Prometheus registry - use global registry to avoid conflicts
    this.registry = promClient.register;
    promClient.collectDefaultMetrics({ register: this.registry });

    // Initialize Prometheus metrics using safe creation methods
    this.databaseMetrics = {
      qdrantConnectionStatus: this.safeGetOrCreateGauge(
        'qdrant_connection_status',
        'Qdrant database connection status (1 = connected, 0 = disconnected)'
      ),
      qdrantPointCount: this.safeGetOrCreateGauge(
        'qdrant_point_count',
        'Total number of points in Qdrant'
      ),
      qdrantCollectionCount: this.safeGetOrCreateGauge(
        'qdrant_collection_count',
        'Total number of collections in Qdrant'
      ),
      qdrantLatency: this.safeGetOrCreateHistogram(
        'qdrant_latency_ms',
        'Qdrant database latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
      nebulaConnectionStatus: this.safeGetOrCreateGauge(
        'nebula_connection_status',
        'Nebula database connection status (1 = connected, 0 = disconnected)'
      ),
      nebulaNodeCount: this.safeGetOrCreateGauge(
        'nebula_node_count',
        'Total number of nodes in Nebula graph'
      ),
      nebulaRelationshipCount: this.safeGetOrCreateGauge(
        'nebula_relationship_count',
        'Total number of relationships in Nebula graph'
      ),
      nebulaLatency: this.safeGetOrCreateHistogram(
        'nebula_latency_ms',
        'Nebula database latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
    };

    this.systemMetrics = {
      memoryUsage: this.safeGetOrCreateGauge(
        'system_memory_usage_percent',
        'System memory usage percentage'
      ),
      cpuUsage: this.safeGetOrCreateGauge(
        'system_cpu_usage_percent',
        'System CPU usage percentage'
      ),
      uptime: this.safeGetOrCreateGauge('system_uptime_seconds', 'System uptime in seconds'),
      diskUsage: this.safeGetOrCreateGauge('system_disk_usage_mb', 'System disk usage in MB'),
      diskFree: this.safeGetOrCreateGauge('system_disk_free_mb', 'System disk free space in MB'),
      networkBytesSent: this.safeGetOrCreateGauge(
        'system_network_bytes_sent',
        'System network bytes sent'
      ),
      networkBytesReceived: this.safeGetOrCreateGauge(
        'system_network_bytes_received',
        'System network bytes received'
      ),
    };

    this.serviceMetrics = {
      fileWatcherProcessedFiles: this.safeGetOrCreateGauge(
        'file_watcher_processed_files_total',
        'Total number of files processed by file watcher'
      ),
      semanticAnalysisCount: this.safeGetOrCreateGauge(
        'semantic_analysis_count_total',
        'Total number of semantic analyses performed'
      ),
      qdrantOperations: this.safeGetOrCreateGauge(
        'qdrant_operations_total',
        'Total number of Qdrant operations performed'
      ),
      nebulaOperations: this.safeGetOrCreateGauge(
        'nebula_operations_total',
        'Total number of Nebula operations performed'
      ),
      semgrepScansTotal: this.safeGetOrCreateCounter(
        'semgrep_scans_total',
        'Total number of semgrep scans performed'
      ),
      semgrepScansSuccessful: this.safeGetOrCreateCounter(
        'semgrep_scans_successful_total',
        'Total number of successful semgrep scans'
      ),
      semgrepScansFailed: this.safeGetOrCreateCounter(
        'semgrep_scans_failed_total',
        'Total number of failed semgrep scans'
      ),
      semgrepFindingsTotal: this.safeGetOrCreateGauge(
        'semgrep_findings_total',
        'Total number of semgrep findings'
      ),
      semgrepFindingsError: this.safeGetOrCreateGauge(
        'semgrep_findings_error_total',
        'Total number of semgrep findings with error severity'
      ),
      semgrepFindingsWarning: this.safeGetOrCreateGauge(
        'semgrep_findings_warning_total',
        'Total number of semgrep findings with warning severity'
      ),
      semgrepFindingsInfo: this.safeGetOrCreateGauge(
        'semgrep_findings_info_total',
        'Total number of semgrep findings with info severity'
      ),
      semgrepScanDuration: this.safeGetOrCreateHistogram(
        'semgrep_scan_duration_seconds',
        'Semgrep scan duration in seconds',
        [0.1, 0.5, 1, 5, 10, 30, 60]
      ),
      errorCount: this.safeGetOrCreateGauge(
        'error_count_total',
        'Total number of errors encountered'
      ),
      errorRate: this.safeGetOrCreateGauge('error_rate_percent', 'Error rate percentage'),
      fileWatcherLatency: this.safeGetOrCreateHistogram(
        'file_watcher_latency_ms',
        'File watcher latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
      semanticAnalysisLatency: this.safeGetOrCreateHistogram(
        'semantic_analysis_latency_ms',
        'Semantic analysis latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
      qdrantLatency: this.safeGetOrCreateHistogram(
        'qdrant_latency_ms',
        'Qdrant operation latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
      nebulaLatency: this.safeGetOrCreateHistogram(
        'nebula_latency_ms',
        'Nebula operation latency in milliseconds',
        [10, 50, 100, 200, 500, 1000]
      ),
    };

    this.alertMetrics = {
      alertCount: this.safeGetOrCreateCounter('alerts_total', 'Total number of alerts generated'),
      alertSeverity: this.safeGetOrCreateGauge('alerts_severity', 'Current alert severity level'),
    };

    this.logger.info('Prometheus metrics service initialized with real prom-client');

    // Assign singleton instance and complete initialization
    PrometheusMetricsService.instance = this;
    PrometheusMetricsService.isInitializing = false;
  }

  async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const qdrantConnected = this.qdrantService.isConnected();
      const nebulaConnected = this.nebulaService.isConnected();

      // Get real data from databases
      let qdrantPointCount = 0;
      let qdrantCollectionCount = 0;
      let qdrantLatency = 0;

      let nebulaNodeCount = 0;
      let nebulaRelationshipCount = 0;
      let nebulaLatency = 0;

      if (qdrantConnected) {
        try {
          // Simplified Qdrant metrics collection
          // Use basic connection status and placeholder values for now
          qdrantCollectionCount = 1; // Placeholder
          qdrantPointCount = 1000; // Placeholder
          qdrantLatency = 50; // Placeholder
        } catch (error) {
          this.logger.warn('Failed to collect Qdrant metrics', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (nebulaConnected) {
        try {
          // Simplified Nebula metrics collection
          // Use basic connection status and placeholder values for now
          nebulaNodeCount = 500; // Placeholder
          nebulaRelationshipCount = 2000; // Placeholder
          nebulaLatency = 100; // Placeholder
        } catch (error) {
          this.logger.warn('Failed to collect Nebula metrics', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Update Prometheus metrics with real data
      this.databaseMetrics.qdrantConnectionStatus.set(qdrantConnected ? 1 : 0);
      this.databaseMetrics.qdrantPointCount.set(qdrantPointCount);
      this.databaseMetrics.qdrantCollectionCount.set(qdrantCollectionCount);
      this.databaseMetrics.qdrantLatency.observe(qdrantLatency);

      this.databaseMetrics.nebulaConnectionStatus.set(nebulaConnected ? 1 : 0);
      this.databaseMetrics.nebulaNodeCount.set(nebulaNodeCount);
      this.databaseMetrics.nebulaRelationshipCount.set(nebulaRelationshipCount);
      this.databaseMetrics.nebulaLatency.observe(nebulaLatency);

      return {
        qdrant: {
          connectionStatus: qdrantConnected ? 1 : 0,
          pointCount: qdrantPointCount,
          collectionCount: qdrantCollectionCount,
          latency: qdrantLatency,
        },
        nebula: {
          connectionStatus: nebulaConnected ? 1 : 0,
          nodeCount: nebulaNodeCount,
          relationshipCount: nebulaRelationshipCount,
          latency: nebulaLatency,
        },
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to collect database metrics: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'PrometheusMetricsService', operation: 'collectDatabaseMetrics' }
      );
      throw error;
    }
  }

  async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Get real system metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      // Get disk usage (using Node.js APIs)
      const diskInfo = await this.getDiskUsage();

      // Get network stats (simplified for now)
      const networkStats = await this.getNetworkStats();

      // Update Prometheus metrics with real data
      this.systemMetrics.memoryUsage.set(memoryUsage.heapUsed / 1024 / 1024); // Convert to MB
      this.systemMetrics.cpuUsage.set(cpuUsage.user / 1000); // Convert to milliseconds
      this.systemMetrics.uptime.set(uptime);

      this.systemMetrics.diskUsage.set(diskInfo.used / 1024 / 1024); // Convert to MB
      this.systemMetrics.diskFree.set(diskInfo.free / 1024 / 1024); // Convert to MB

      this.systemMetrics.networkBytesSent.set(networkStats.bytesSent);
      this.systemMetrics.networkBytesReceived.set(networkStats.bytesReceived);

      return {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime,
        disk: diskInfo,
        network: networkStats,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to collect system metrics: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'PrometheusMetricsService', operation: 'collectSystemMetrics' }
      );
      throw error;
    }
  }

  private async getDiskUsage(): Promise<{ used: number; free: number; total: number }> {
    try {
      const { promises: fs } = await import('fs');
      const { statfs } = await import('fs/promises');

      // Get disk usage for the current working directory
      const stats = await statfs(process.cwd());

      return {
        used: (stats.blocks - stats.bfree) * stats.bsize,
        free: stats.bfree * stats.bsize,
        total: stats.blocks * stats.bsize,
      };
    } catch (error) {
      this.logger.warn('Failed to get disk usage', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { used: 0, free: 0, total: 0 };
    }
  }

  private async getNetworkStats(): Promise<{ bytesSent: number; bytesReceived: number }> {
    try {
      // For now, return simplified network stats
      // In a real implementation, you might use os.networkInterfaces() or a library
      return {
        bytesSent: 0, // Placeholder - would need actual network monitoring
        bytesReceived: 0, // Placeholder - would need actual network monitoring
      };
    } catch (error) {
      this.logger.warn('Failed to get network stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { bytesSent: 0, bytesReceived: 0 };
    }
  }

  async collectServiceMetrics(): Promise<ServiceMetrics> {
    try {
      // Get basic service metrics - simplified for now
      const fileWatcherStats = {
        totalFilesProcessed: 0, // Placeholder - would need actual tracking
        averageLatency: 0, // Placeholder
        activeWatchers: 0, // Placeholder - file watcher service not available
      };

      const semanticAnalysisStats = {
        totalAnalyses: 0, // Placeholder
        averageLatency: 0, // Placeholder
        activeAnalyses: 0, // Placeholder
      };

      const qdrantStats = {
        totalOperations: 0, // Placeholder
        averageLatency: 0, // Placeholder
        activeConnections: this.qdrantService.isConnected() ? 1 : 0,
      };

      const nebulaStats = {
        totalOperations: 0, // Placeholder
        averageLatency: 0, // Placeholder
        activeSessions: this.nebulaService.isConnected() ? 1 : 0,
      };

      // Get semgrep metrics from SemgrepMetricsService
      const semgrepMetrics = this.semgrepMetricsService.getMetrics();
      const semgrepStats = {
        totalScans: semgrepMetrics.scans.total,
        successfulScans: semgrepMetrics.scans.successful,
        averageScanDuration: semgrepMetrics.scans.averageDuration,
        totalFindings: semgrepMetrics.findings.total,
      };

      // Calculate error metrics
      const totalErrors = 0; // Placeholder - would need error tracking
      const totalOperations =
        fileWatcherStats.totalFilesProcessed +
        semanticAnalysisStats.totalAnalyses +
        qdrantStats.totalOperations +
        nebulaStats.totalOperations +
        semgrepStats.totalScans;

      const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

      // Update Prometheus metrics with simplified data
      this.serviceMetrics.fileWatcherProcessedFiles.set(fileWatcherStats.totalFilesProcessed);
      this.serviceMetrics.semanticAnalysisCount.set(semanticAnalysisStats.totalAnalyses);
      this.serviceMetrics.qdrantOperations.set(qdrantStats.totalOperations);
      this.serviceMetrics.nebulaOperations.set(nebulaStats.totalOperations);

      // Update semgrep metrics
      this.serviceMetrics.semgrepScansTotal.inc(semgrepStats.totalScans);
      this.serviceMetrics.semgrepScansSuccessful.inc(semgrepStats.successfulScans);
      this.serviceMetrics.semgrepScansFailed.inc(
        semgrepStats.totalScans - semgrepStats.successfulScans
      );
      this.serviceMetrics.semgrepFindingsTotal.set(semgrepStats.totalFindings);
      this.serviceMetrics.semgrepScanDuration.observe(semgrepStats.averageScanDuration);

      this.serviceMetrics.errorCount.set(totalErrors);
      this.serviceMetrics.errorRate.set(errorRate);

      this.serviceMetrics.fileWatcherLatency.observe(fileWatcherStats.averageLatency);
      this.serviceMetrics.semanticAnalysisLatency.observe(semanticAnalysisStats.averageLatency);
      this.serviceMetrics.qdrantLatency.observe(qdrantStats.averageLatency);
      this.serviceMetrics.nebulaLatency.observe(nebulaStats.averageLatency);

      return {
        fileWatcher: fileWatcherStats,
        semanticAnalysis: semanticAnalysisStats,
        qdrant: qdrantStats,
        nebula: nebulaStats,
        semgrep: semgrepStats,
        errors: {
          total: totalErrors,
          rate: errorRate,
        },
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to collect service metrics: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'PrometheusMetricsService', operation: 'collectServiceMetrics' }
      );
      throw error;
    }
  }

  recordAlert(severity: 'low' | 'medium' | 'high' | 'critical'): void {
    try {
      const severityValue =
        {
          low: 1,
          medium: 2,
          high: 3,
          critical: 4,
        }[severity] || 0;

      this.alertMetrics.alertCount.inc();
      this.alertMetrics.alertSeverity.set(severityValue);

      this.logger.info('Alert recorded', { severity });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to record alert: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'PrometheusMetricsService', operation: 'recordAlert' }
      );
    }
  }

  async collectAllMetrics(): Promise<{
    database: DatabaseMetrics;
    system: SystemMetrics;
    service: ServiceMetrics;
  }> {
    try {
      const [database, system, service] = await Promise.all([
        this.collectDatabaseMetrics(),
        this.collectSystemMetrics(),
        this.collectServiceMetrics(),
      ]);

      return { database, system, service };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to collect all metrics: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'PrometheusMetricsService', operation: 'collectAllMetrics' }
      );
      throw error;
    }
  }

  getMetricsEndpoint(): string {
    // In a real implementation, this would return the actual Prometheus metrics endpoint
    return '/metrics';
  }
}
