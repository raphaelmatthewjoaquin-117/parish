import { logger } from './logger.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Performance monitoring and metrics collection
 * Tracks request latency, database performance, and system health
 */

interface MetricData {
  [key: string]: number;
}

class MetricsCollector {
  private metrics: MetricData = {
    totalRequests: 0,
    totalErrors: 0,
    totalDatabaseQueries: 0,
    totalDatabaseErrors: 0,
    uptime: 0,
  };

  private requestLatencies: number[] = [];
  private databaseLatencies: number[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Record incoming request
   */
  recordRequest() {
    this.metrics.totalRequests++;
  }

  /**
   * Record request latency
   */
  recordRequestLatency(latencyMs: number) {
    this.requestLatencies.push(latencyMs);
    // Keep only last 1000 measurements
    if (this.requestLatencies.length > 1000) {
      this.requestLatencies.shift();
    }
  }

  /**
   * Record error
   */
  recordError() {
    this.metrics.totalErrors++;
  }

  /**
   * Record database query
   */
  recordDatabaseQuery() {
    this.metrics.totalDatabaseQueries++;
  }

  /**
   * Record database query latency
   */
  recordDatabaseLatency(latencyMs: number) {
    this.databaseLatencies.push(latencyMs);
    // Keep only last 1000 measurements
    if (this.databaseLatencies.length > 1000) {
      this.databaseLatencies.shift();
    }
  }

  /**
   * Record database error
   */
  recordDatabaseError() {
    this.metrics.totalDatabaseErrors++;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    const now = Date.now();
    const uptime = Math.floor((now - this.startTime) / 1000);

    return {
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      totalRequests: this.metrics.totalRequests,
      totalErrors: this.metrics.totalErrors,
      errorRate: this.metrics.totalRequests > 0
        ? ((this.metrics.totalErrors / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      totalDatabaseQueries: this.metrics.totalDatabaseQueries,
      totalDatabaseErrors: this.metrics.totalDatabaseErrors,
      databaseErrorRate: this.metrics.totalDatabaseQueries > 0
        ? ((this.metrics.totalDatabaseErrors / this.metrics.totalDatabaseQueries) * 100).toFixed(2) + '%'
        : '0%',
      requestLatencies: this.getLatencyStats(this.requestLatencies),
      databaseLatencies: this.getLatencyStats(this.databaseLatencies),
    };
  }

  /**
   * Calculate latency statistics
   */
  private getLatencyStats(latencies: number[]) {
    if (latencies.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { min, max, avg, p95, p99 };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    let status = 'healthy';
    const issues = [];

    // Check error rate
    const errorRateNum = parseFloat(metrics.errorRate as string);
    if (errorRateNum > 5) {
      status = 'degraded';
      issues.push(`High error rate: ${metrics.errorRate}`);
    }
    if (errorRateNum > 10) {
      status = 'unhealthy';
    }

    // Check database error rate
    const dbErrorRateNum = parseFloat(metrics.databaseErrorRate as string);
    if (dbErrorRateNum > 2) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      issues.push(`High database error rate: ${metrics.databaseErrorRate}`);
    }

    // Check response times
    const avgLatency = (metrics.requestLatencies as any).avg;
    if (avgLatency > 1000) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      issues.push(`Slow response times: ${avgLatency}ms avg`);
    }

    return {
      status,
      issues,
      metrics,
    };
  }

  /**
   * Report metrics periodically
   */
  startPeriodicReporting(intervalSeconds: number = 300) {
    setInterval(() => {
      const health = this.getHealthStatus();
      logger.info({
        type: 'metrics',
        ...health.metrics,
        health: health.status,
        issues: health.issues.length > 0 ? health.issues : undefined,
      });
    }, intervalSeconds * 1000);
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalDatabaseQueries: 0,
      totalDatabaseErrors: 0,
      uptime: 0,
    };
    this.requestLatencies = [];
    this.databaseLatencies = [];
    this.startTime = Date.now();
  }
}

export const metricsCollector = new MetricsCollector();

/**
 * Express middleware for metrics collection
 */
export function metricsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  metricsCollector.recordRequest();

  // Hook into res.json to capture completion and record latency
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    const duration = Date.now() - startTime;
    metricsCollector.recordRequestLatency(duration);

    if (res.statusCode >= 400) {
      metricsCollector.recordError();
    }

    return originalJson(data);
  };

  next();
}

/**
 * Health check endpoint handler
 */
export function handleHealthCheck(_req: Request, res: Response): void {
  const health = metricsCollector.getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;

  res.status(statusCode).json({
    status: health.status,
    timestamp: new Date().toISOString(),
    metrics: health.metrics,
    issues: health.issues,
  });
}

/**
 * Metrics endpoint handler (for admin/monitoring)
 */
export function handleMetricsRequest(_req: Request, res: Response): void {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
}
