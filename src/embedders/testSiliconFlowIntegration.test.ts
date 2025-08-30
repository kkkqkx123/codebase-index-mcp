import { ConfigService } from '../config/ConfigService';
import { SiliconFlowEmbedder } from './SiliconFlowEmbedder';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';

// This is a simple test to verify that SiliconFlow embedder can be instantiated and configured
// In a real application, this would be part of a proper test suite

function testSiliconFlowIntegration() {
  console.log('Testing SiliconFlow embedder integration...\n');
  
  try {
    // Initialize services
    const configService = ConfigService.getInstance();
    const logger = new LoggerService;
    const errorHandler = new ErrorHandlerService(logger);
    
    // Initialize SiliconFlow embedder
    const siliconFlowEmbedder = new SiliconFlowEmbedder(configService, logger, errorHandler);
    
    // Test configuration
    const config = configService.get('embedding');
    console.log('SiliconFlow Configuration:');
    console.log('- API Key:', config.siliconflow.apiKey ? '[SET]' : '[NOT SET]');
    console.log('- Base URL:', config.siliconflow.baseUrl || '[NOT SET]');
    console.log('- Model:', config.siliconflow.model);
    console.log('');
    
    console.log('SiliconFlow embedder created successfully.');
    console.log('Note: Actual API integration testing requires a valid SiliconFlow API key and URL.');
    
  } catch (error) {
    console.error('Error testing SiliconFlow integration:', error);
  }
}

// Run the test
testSiliconFlowIntegration();