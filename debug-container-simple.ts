import { Container } from 'inversify';
import { 
  IndexService 
} from './src/services/indexing/IndexService';
import { 
  ParserService 
} from './src/services/parser/ParserService';
import { 
  EmbeddingService 
} from './src/services/storage/EmbeddingService';
import { 
  VectorStorageService 
} from './src/services/storage/vector/VectorStorageService';
import { 
  LoggerService 
} from './src/core/LoggerService';
import { 
  ErrorHandlerService 
} from './src/core/ErrorHandlerService';
import { 
  TreeSitterService 
} from './src/services/parser/TreeSitterService';
import { 
  SemanticAnalysisService 
} from './src/services/parser/SemanticAnalysisService';
import { 
  EnhancedSemgrepScanService 
} from './src/services/semgrep/EnhancedSemgrepScanService';

// 从test/setup.ts复制必要的绑定代码
import { TYPES } from './src/types';
import { 
  SnippetExtractionService 
} from './src/services/parser/SnippetExtractionService';
import { SmartCodeParser } from './src/services/parser/SmartCodeParser';
import { TreeSitterCoreService } from './src/services/parser/TreeSitterCoreService';
import { EnhancedSemgrepAnalyzer } from './src/services/static-analysis/EnhancedSemgrepAnalyzer';

function createTestContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });
  
  // 基础服务
  container.bind<LoggerService>(LoggerService).toSelf().inSingletonScope();
  container.bind<ErrorHandlerService>(ErrorHandlerService).toSelf().inSingletonScope();
  
  // 解析服务
  container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
  container.bind<TreeSitterService>(TreeSitterService).toSelf().inSingletonScope();
  container.bind<SnippetExtractionService>(TYPES.SnippetExtractionService).to(SnippetExtractionService).inSingletonScope();
  container.bind<SmartCodeParser>(SmartCodeParser).toSelf().inSingletonScope();
  container.bind<SemanticAnalysisService>(SemanticAnalysisService).toSelf().inSingletonScope();
  container.bind<ParserService>(ParserService).toSelf().inSingletonScope();
  
  // 索引服务
  container.bind<EmbeddingService>(EmbeddingService).toSelf().inSingletonScope();
  container.bind<VectorStorageService>(VectorStorageService).toSelf().inSingletonScope();
  container.bind<IndexService>(IndexService).toSelf().inSingletonScope();
  
  // Semgrep服务
  container.bind<EnhancedSemgrepAnalyzer>(TYPES.EnhancedSemgrepAnalyzer).to(EnhancedSemgrepAnalyzer).inSingletonScope();
  container.bind<EnhancedSemgrepScanService>(EnhancedSemgrepScanService).toSelf().inSingletonScope();
  
  return container;
}

// 创建容器并逐个获取服务以确定哪个服务导致循环依赖
async function debugContainer() {
  console.log('创建测试容器...');
  const container = createTestContainer();
  
  const services = [
    { name: 'LoggerService', service: LoggerService },
    { name: 'ErrorHandlerService', service: ErrorHandlerService },
    { name: 'TreeSitterCoreService', service: TreeSitterCoreService },
    { name: 'TreeSitterService', service: TreeSitterService },
    { name: 'SnippetExtractionService', service: TYPES.SnippetExtractionService },
    { name: 'SmartCodeParser', service: SmartCodeParser },
    { name: 'SemanticAnalysisService', service: SemanticAnalysisService },
    { name: 'ParserService', service: ParserService },
    { name: 'EmbeddingService', service: EmbeddingService },
    { name: 'VectorStorageService', service: VectorStorageService },
    { name: 'IndexService', service: IndexService },
    { name: 'EnhancedSemgrepAnalyzer', service: TYPES.EnhancedSemgrepAnalyzer },
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