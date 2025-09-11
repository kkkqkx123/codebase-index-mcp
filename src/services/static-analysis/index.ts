/**
 * Static Analysis Service Integration
 * 
 * This module provides the main entry point for static analysis services,
 * including Semgrep integration and result processing.
 */

import { StaticAnalysisCoordinator } from './StaticAnalysisCoordinator';
import { SemgrepScanService } from '../semgrep/SemgrepScanService';
import { SemgrepResultProcessor } from '../semgrep/SemgrepResultProcessor';
import { SemgrepRuleAdapter } from '../semgrep/SemgrepRuleAdapter';
import { AnalysisResultFusion } from './AnalysisResultFusion';

// Export main services
export {
  StaticAnalysisCoordinator,
  SemgrepScanService,
  SemgrepResultProcessor,
  SemgrepRuleAdapter,
  AnalysisResultFusion,
};

// Export types
export * from '../../models/StaticAnalysisTypes';

// Service factory for dependency injection
export class StaticAnalysisServiceFactory {
  static createCoordinator(
    logger: any,
    eventQueue: any,
    semgrepService: any,
    enhancedSemgrepService: any,
    resultProcessor: any,
    nebulaService: any,
    qdrantService: any
  ): StaticAnalysisCoordinator {
    return new StaticAnalysisCoordinator(
      logger,
      eventQueue,
      semgrepService,
      enhancedSemgrepService,
      resultProcessor,
      nebulaService,
      qdrantService
    );
  }
}