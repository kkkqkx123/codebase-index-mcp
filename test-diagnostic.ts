import 'reflect-metadata';
import { DIContainer, TYPES } from './src/core/DIContainer';
import { ConfigService } from './src/config/ConfigService';

console.log('Testing DIContainer initialization...');

try {
  console.log('TYPES object:', TYPES);
  console.log('TYPES.ConfigService:', TYPES.ConfigService);
  
  const container = DIContainer.getInstance();
  console.log('Container created successfully');
  
  const configService = container.get<ConfigService>(TYPES.ConfigService);
  console.log('ConfigService retrieved:', !!configService);
  
  console.log('All tests passed!');
} catch (error: any) {
  console.error('Test failed:', error);
  console.error('Error stack:', error.stack);
}