import { ConfigService } from '../config/ConfigService';
import { Custom1Embedder } from './Custom1Embedder';
import { Custom2Embedder } from './Custom2Embedder';
import { Custom3Embedder } from './Custom3Embedder';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';

// This is a simple test to verify that custom embedders can be instantiated and configured
// In a real application, this would be part of a proper test suite

function testCustomEmbeddersIntegration() {
  console.log('Testing custom embedders integration...\n');
  
  try {
    // Initialize services
    const configService = ConfigService.getInstance();
    const logger = new LoggerService;
    const errorHandler = new ErrorHandlerService(logger);
    
    // Initialize custom embedders
    const custom1Embedder = new Custom1Embedder(configService, logger, errorHandler);
    const custom2Embedder = new Custom2Embedder(configService, logger, errorHandler);
    const custom3Embedder = new Custom3Embedder(configService, logger, errorHandler);
    
    // Test configuration
    const config = configService.get('embedding');
    const customConfig = config.custom || {};
    
    console.log('Custom1 Configuration:');
    console.log('- API Key:', customConfig.custom1?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom1?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom1?.model || '[NOT SET]');
    console.log('');
    
    console.log('Custom2 Configuration:');
    console.log('- API Key:', customConfig.custom2?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom2?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom2?.model || '[NOT SET]');
    console.log('');
    
    console.log('Custom3 Configuration:');
    console.log('- API Key:', customConfig.custom3?.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', customConfig.custom3?.baseUrl || '[NOT SET]');
    console.log('- Model:', customConfig.custom3?.model || '[NOT SET]');
    console.log('');
    
    console.log('Custom embedders created successfully.');
    console.log('Note: Actual API integration testing requires valid API keys and URLs in .env file.');
    
  } catch (error) {
    console.error('Error testing custom embedders integration:', error);
  }
}

// Run the test
testCustomEmbeddersIntegration();