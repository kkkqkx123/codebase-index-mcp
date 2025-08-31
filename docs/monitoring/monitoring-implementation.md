# Monitoring System Implementation Guide

## Overview

The monitoring system provides comprehensive observability for the codebase-index service with real-time metrics, health checks, performance analysis, and alerting capabilities. This guide covers setup, configuration, and operation of the monitoring infrastructure.

## Architecture

### Core Components

#### 1. **Monitoring Services**

- **BatchPerformanceMonitor** (`src/services/monitoring/BatchPerformanceMonitor.ts:89`)
  - Tracks batch processing operations and generates performance alerts
  - Configurable performance thresholds with automatic alerting
  - Performance report generation with percentiles (P95, P99)
  - Memory efficiency calculations and adaptive batching statistics

- **PrometheusMetricsService** (`src/services/monitoring/PrometheusMetricsService.ts:88`)
  - Collects and exposes metrics for Prometheus monitoring
  - Database metrics (Qdrant, Nebula connectivity and performance)
  - System metrics (memory, CPU, uptime, connections)
  - Service metrics (queries, sync operations, batch processing)
  - Alert metrics collection

- **HealthCheckService** (`src/services/monitoring/HealthCheckService.ts:40`)
  - Performs comprehensive health checks on system components
  - Database connectivity monitoring (Qdrant, Nebula)
  - System resource monitoring
  - Dependency health tracking and failure detection

- **PerformanceAnalysisService** (`src/services/monitoring/PerformanceAnalysisService.ts:63`)
  - Generates performance reports with bottleneck identification
  - Real-time bottleneck detection
  - Performance benchmarking and capacity planning
  - Automated optimization recommendations

- **BatchProcessingMetrics** (`src/services/monitoring/BatchProcessingMetrics.ts:69`)
  - Detailed batch operation tracking
  - Adaptive batching history and adjustments
  - Performance statistics and alert generation

#### 2. **API Endpoints** (`src/api/routes/MonitoringRoutes.ts:16`)

- `GET /api/v1/monitoring/health` - System health status
- `GET /api/v1/monitoring/metrics` - System metrics collection
- `GET /api/v1/monitoring/performance` - Performance reports
- `GET /api/v1/monitoring/bottlenecks` - Real-time bottleneck detection
- `GET /api/v1/monitoring/capacity` - Capacity planning analysis
- `GET /api/v1/monitoring/dependencies` - Service dependency status
- `GET /api/v1/monitoring/benchmark` - Performance benchmarking

## Prerequisites

### System Requirements
- Node.js 18.0.0+
- Docker Desktop 4.0.0+
- 16GB RAM recommended for production workloads
- Port availability: 3000 (API), 9090 (Prometheus), 9093 (Alertmanager), 3000 (Grafana)

### External Dependencies
- **Qdrant Vector Database** - Vector storage and search
- **NebulaGraph** - Graph database for code relationships
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Alertmanager** - Alert routing and management

## Setup and Configuration

### 1. Environment Configuration

Create `.env` file with monitoring configuration:

```bash
# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090

# Batch Processing Monitoring
BATCH_MONITORING_ENABLED=true
METRICS_INTERVAL=60000
HIGH_LATENCY_THRESHOLD=5000
LOW_THROUGHPUT_THRESHOLD=10
HIGH_ERROR_RATE_THRESHOLD=0.1
HIGH_MEMORY_USAGE_THRESHOLD=80
CRITICAL_MEMORY_USAGE_THRESHOLD=90
HIGH_CPU_USAGE_THRESHOLD=70
CRITICAL_CPU_USAGE_THRESHOLD=85

# Performance Monitoring
MEMORY_THRESHOLD=80
PROCESSING_TIMEOUT=300000
RETRY_ATTEMPTS=3
RETRY_DELAY=1000
```

### 2. Database Dependencies

#### Qdrant Configuration
```bash
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=code-snippets
```

#### NebulaGraph Configuration
```bash
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=codegraph
```

### 3. Start Core Services

```bash
# Start databases
docker-compose up -d qdrant nebula

# Install dependencies
npm install

# Start main application
npm run dev
```

### 4. Start Monitoring Infrastructure

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker ps
```

## Service Dependencies

### Runtime Dependencies

The monitoring system depends on these core services:

1. **ConfigService** - Configuration management and validation
2. **LoggerService** - Structured logging and debug output
3. **ErrorHandlerService** - Error handling and reporting
4. **QdrantService** - Vector database operations and health checks
5. **NebulaService** - Graph database operations and health checks
6. **PerformanceMonitor** - Query performance tracking
7. **BatchProcessingMetrics** - Batch operation tracking

### Dependency Injection Setup

All monitoring services are registered in the DI container (`src/core/DIContainer.ts`):

```typescript
// Monitoring services
container.bind<BatchPerformanceMonitor>(TYPES.BatchPerformanceMonitor).to(BatchPerformanceMonitor);
container.bind<PrometheusMetricsService>(TYPES.PrometheusMetricsService).to(PrometheusMetricsService);
container.bind<HealthCheckService>(TYPES.HealthCheckService).to(HealthCheckService);
container.bind<PerformanceAnalysisService>(TYPES.PerformanceAnalysisService).to(PerformanceAnalysisService);
container.bind<BatchProcessingMetrics>(TYPES.BatchProcessingMetrics).to(BatchProcessingMetrics);
```

## Monitoring Stack Configuration

### Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'codebase-index'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
    scrape_timeout: 10s

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'qdrant'
    static_configs:
      - targets: ['localhost:6333']

  - job_name: 'nebula'
    static_configs:
      - targets: ['localhost:9669']
```

### Grafana Configuration

1. Access Grafana at `http://localhost:3000`
2. Login with `admin/admin`
3. Add Prometheus data source: `http://prometheus:9090`
4. Import dashboards from `monitoring/grafana/dashboards/`

### Alertmanager Configuration

Create `monitoring/alertmanager.yml`:

```yaml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alertmanager@example.com'

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
  - name: 'web.hook'
    email_configs:
      - to: 'admin@example.com'
```

## Operation and Usage

### Health Checks

Monitor system health:

```bash
# Check overall health
curl http://localhost:3000/api/v1/monitoring/health

# Check specific component health
curl http://localhost:3000/api/v1/monitoring/dependencies
```

### Performance Monitoring

Generate performance reports:

```bash
# Get performance report (last 24 hours)
curl http://localhost:3000/api/v1/monitoring/performance

# Get performance report for specific time range
curl "http://localhost:3000/api/v1/monitoring/performance?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z"
```

### Metrics Collection

Access Prometheus metrics:

```bash
# Get all metrics
curl http://localhost:3000/api/v1/monitoring/metrics

# Access Prometheus directly
curl http://localhost:9090/metrics
```

### Bottleneck Detection

Identify performance bottlenecks:

```bash
# Get real-time bottlenecks
curl http://localhost:3000/api/v1/monitoring/bottlenecks

# Get capacity planning recommendations
curl http://localhost:3000/api/v1/monitoring/capacity
```

## Configuration Management

### Performance Thresholds

Configure alert thresholds in `src/config/ConfigService.ts:116`:

```typescript
alertThresholds: {
  highLatency: 5000,        // ms
  lowThroughput: 10,        // operations/sec
  highErrorRate: 0.1,      // 10%
  highMemoryUsage: 80,     // percentage
  criticalMemoryUsage: 90, // percentage
  highCpuUsage: 70,        // percentage
  criticalCpuUsage: 85     // percentage
}
```

### Monitoring Intervals

Configure collection intervals:

```typescript
monitoring: {
  enabled: true,
  metricsInterval: 60000,    // 1 minute
  cleanupInterval: 3600000   // 1 hour
}
```

### Batch Processing Configuration

```typescript
batchProcessing: {
  enabled: true,
  maxConcurrentOperations: 5,
  defaultBatchSize: 50,
  maxBatchSize: 500,
  memoryThreshold: 80,
  adaptiveBatching: {
    enabled: true,
    minBatchSize: 10,
    maxBatchSize: 200,
    performanceThreshold: 1000
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Monitoring Services Not Starting
- Verify Docker is running
- Check port availability (9090, 9093, 3000)
- Review environment variable configuration

#### 2. Database Connection Issues
- Verify Qdrant and Nebula are running
- Check database connection strings
- Review network connectivity

#### 3. High Memory Usage
- Adjust batch processing configuration
- Review memory thresholds
- Consider scaling resources

#### 4. Alert Fatigue
- Adjust alert thresholds
- Review alert routing configuration
- Implement alert suppression rules

### Debug Commands

```bash
# Check container status
docker ps -a

# View service logs
docker logs codebase-index
docker logs prometheus
docker logs grafana

# Test database connectivity
curl http://localhost:6333/
curl http://localhost:9669/status

# Verify API endpoints
curl http://localhost:3000/api/v1/monitoring/health
```

### Log Analysis

Monitor logs for common patterns:

```bash
# View monitoring service logs
tail -f logs/monitoring.log | grep "Performance"

# Check for alerts
tail -f logs/monitoring.log | grep "alert"

# Monitor health checks
tail -f logs/monitoring.log | grep "Health"
```

## Performance Optimization

### Metrics Collection Optimization

1. **Adjust Collection Intervals**
   - Reduce frequency for high-volume metrics
   - Increase frequency for critical metrics

2. **Implement Sampling**
   - Use statistical sampling for high-frequency metrics
   - Aggregate metrics before storage

3. **Optimize Storage**
   - Configure appropriate retention periods
   - Implement metric downsampling

### Alert Optimization

1. **Threshold Tuning**
   - Set appropriate thresholds for your environment
   - Implement dynamic thresholding based on historical data

2. **Alert Grouping**
   - Group related alerts to reduce noise
   - Implement alert correlation

3. **Notification Optimization**
   - Configure appropriate notification channels
   - Implement alert escalation policies

## Security Considerations

### Access Control

1. **Authentication**
   - Implement API key authentication for monitoring endpoints
   - Use reverse proxy with authentication

2. **Network Security**
   - Restrict access to monitoring ports
   - Use VPN or private networks for internal monitoring

3. **Data Protection**
   - Encrypt sensitive metrics data
   - Implement secure storage for alert configurations

### Monitoring Security

1. **Metric Security**
   - Avoid exposing sensitive information in metrics
   - Implement metric filtering and sanitization

2. **Alert Security**
   - Secure alert notification channels
   - Implement alert validation and verification

## Maintenance

### Regular Tasks

1. **Log Rotation**
   - Configure log rotation for monitoring logs
   - Archive old monitoring data

2. **Database Maintenance**
   - Regular backup of monitoring databases
   - Optimize database performance

3. **System Updates**
   - Keep monitoring components updated
   - Test updates in staging environment

### Backup and Recovery

1. **Configuration Backup**
   - Backup monitoring configuration files
   - Version control configuration changes

2. **Data Backup**
   - Regular backup of metrics data
   - Test recovery procedures

3. **Disaster Recovery**
   - Implement failover procedures
   - Regular testing of recovery scenarios

## Integration

### External Monitoring Tools

1. **Prometheus Integration**
   - Configure remote write for long-term storage
   - Implement federation for multi-cluster monitoring

2. **Grafana Integration**
   - Create custom dashboards
   - Implement alerting in Grafana

3. **Third-Party Tools**
   - Integration with Datadog, New Relic, etc.
   - Implement custom exporters

### API Integration

1. **Webhook Integration**
   - Configure webhooks for alert notifications
   - Implement custom alert handling

2. **Custom Metrics**
   - Implement custom metric collectors
   - Add application-specific metrics

## Conclusion

The monitoring system provides comprehensive observability for the codebase-index service. By following this guide, you can effectively set up, configure, and maintain the monitoring infrastructure to ensure optimal performance and reliability of your system.

For additional support or questions, refer to the project documentation or create an issue in the project repository.