import 'reflect-metadata';
import { DIContainer, TYPES } from './src/core/DIContainer';

describe('DIContainer Diagnostic', () => {
  it('should initialize DIContainer without errors', () => {
    console.log('TYPES object:', TYPES);
    console.log('TYPES.ConfigService:', TYPES.ConfigService);
    
    const container = DIContainer.getInstance();
    expect(container).toBeDefined();
    
    console.log('Container created successfully');
  });

  it('should retrieve ConfigService without errors', () => {
    const container = DIContainer.getInstance();
    const configService = container.get(TYPES.ConfigService);
    expect(configService).toBeDefined();
    
    console.log('ConfigService retrieved successfully');
  });
});