import { ConfigService } from '../../config/ConfigService';
import { SiliconFlowEmbedder } from '../SiliconFlowEmbedder';
import { Custom1Embedder } from '../Custom1Embedder';
import { Custom2Embedder } from '../Custom2Embedder';
import { Custom3Embedder } from '../Custom3Embedder';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';

// This is a comprehensive test to verify that all new embedders can be instantiated and configured
// In a real application, this would be part of a proper test suite

function testAllNewEmbedders() {
  console.log('Testing all new embedders integration...\n');

  try {
    // Initialize services
    const configService = ConfigService.getInstance();
    const logger = new LoggerService();
    const errorHandler = new ErrorHandlerService(logger);
    const cacheService = new EmbeddingCacheService(configService, logger);

    // Initialize all new embedders
    const siliconFlowEmbedder = new SiliconFlowEmbedder(configService, logger, errorHandler, cacheService);
    const custom1Embedder = new Custom1Embedder(configService, logger, errorHandler, cacheService);
    const custom2Embedder = new Custom2Embedder(configService, logger, errorHandler, cacheService);
    const custom3Embedder = new Custom3Embedder(configService, logger, errorHandler, cacheService);

    // Test configuration
    const config = configService.get('embedding');
    const customConfig = config.custom || {};

    console.log('=== SiliconFlow Configuration ===');
    console.log('- API Key:', config.siliconflow.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', config.siliconflow.baseUrl || '[NOT SET]');
    console.log('- Model:', config.siliconflow.model);
    console.log('- Dimensions:', siliconFlowEmbedder.getDimensions());
    console.log('');

    console.log('=== Custom1 Configuration ===');
    console.log('- API Key:', customConfig.custom1?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom1?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom1?.model || '[NOT SET]');
    console.log('- Dimensions:', custom1Embedder.getDimensions());
    console.log('');

    console.log('=== Custom2 Configuration ===');
    console.log('- API Key:', customConfig.custom2?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom2?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom2?.model || '[NOT SET]');
    console.log('- Dimensions:', custom2Embedder.getDimensions());
    console.log('');

    console.log('=== Custom3 Configuration ===');
    console.log('- API Key:', customConfig.custom3?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom3?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom3?.model || '[NOT SET]');
    console.log('- Dimensions:', custom3Embedder.getDimensions());
    console.log('');

    console.log('All new embedders created successfully.');
    console.log('Note: Actual API integration testing requires valid API keys and URLs in .env file.');

  } catch (error) {
    console.error('Error testing all new embedders integration:', error);
  }
}

// Run the test
testAllNewEmbedders();