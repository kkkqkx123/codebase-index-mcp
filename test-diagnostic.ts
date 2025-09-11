// Diagnostic script to check service bindings
import 'reflect-metadata';
import { createTestContainer } from './test/setup';
import { IndexService } from './src/services/indexing/IndexService';
import { IndexCoordinator } from './src/services/indexing/IndexCoordinator';

async function runDiagnostic() {
  try {
    console.log('Creating test container...');
    const container = createTestContainer();
    
    console.log('Testing IndexService...');
    const indexService = container.get(IndexService);
    console.log('✓ IndexService bound successfully');
    
    console.log('Testing IndexCoordinator...');
    const indexCoordinator = container.get(IndexCoordinator);
    console.log('✓ IndexCoordinator bound successfully');
    
    console.log('All services bound correctly!');
  } catch (error: any) {
    console.error('❌ Service binding error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

runDiagnostic();