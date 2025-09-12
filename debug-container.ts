import { createTestContainer } from './test/setup';
import { IndexService } from './src/services/indexing/IndexService';
import { ParserService } from './src/services/parser/ParserService';
import { EmbeddingService } from './src/services/storage/EmbeddingService';
import { VectorStorageService } from './src/services/storage/vector/VectorStorageService';
import { LoggerService } from './src/core/LoggerService';
import { ErrorHandlerService } from './src/core/ErrorHandlerService';
import { ConfigService } from './src/config/ConfigService';
import { TreeSitterService } from './src/services/parser/TreeSitterService';
import { SemanticAnalysisService } from './src/services/parser/SemanticAnalysisService';
import { EnhancedSemgrepScanService } from './src/services/semgrep/EnhancedSemgrepScanService';

// 创建容器并逐个获取服务以确定哪个服务导致循环依赖
async function debugContainer() {
  console.log('创建测试容器...');
  const container = createTestContainer();
  
  const services = [
    { name: 'IndexService', service: IndexService },
    { name: 'ParserService', service: ParserService },
    { name: 'EmbeddingService', service: EmbeddingService },
    { name: 'VectorStorageService', service: VectorStorageService },
    { name: 'LoggerService', service: LoggerService },
    { name: 'ErrorHandlerService', service: ErrorHandlerService },
    { name: 'ConfigService', service: ConfigService },
    { name: 'TreeSitterService', service: TreeSitterService },
    { name: 'SemanticAnalysisService', service: SemanticAnalysisService },
    { name: 'EnhancedSemgrepScanService', service: EnhancedSemgrepScanService }
  ];
  
  for (const { name, service } of services) {
    try {
      console.log(`尝试获取 ${name}...`);
      const instance = container.get(service);
      console.log(`✓ ${name} 获取成功`);
    } catch (error: any) {
      console.log(`✗ ${name} 获取失败:`, error.message);
      break;
    }
  }
}

debugContainer().catch(console.error);