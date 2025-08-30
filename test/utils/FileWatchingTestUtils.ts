import { FileWatcherService } from '../../src/services/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../src/services/filesystem/ChangeDetectionService';
import fs from 'fs/promises';

export interface FileWatchingTestHelper {
  waitForFileEvents: (timeout?: number) => Promise<boolean>;
  waitForProcessing: (filePath?: string, timeout?: number) => Promise<boolean>;
  flushEvents: () => Promise<void>;
  isTestMode: () => boolean;
}

export class FileWatchingTestUtils {
  static createHelper(
    fileWatcherService: FileWatcherService,
    changeDetectionService?: ChangeDetectionService
  ): FileWatchingTestHelper {
    return {
      waitForFileEvents: async (timeout: number = 3000): Promise<boolean> => {
        // Wait for file watcher to process events
        if (fileWatcherService.isTestMode()) {
          await fileWatcherService.flushEventQueue();
        }
        
        // Wait a bit more for any remaining events
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      },
      
      waitForProcessing: async (filePath?: string, timeout: number = 3000): Promise<boolean> => {
        if (changeDetectionService && changeDetectionService.isTestMode()) {
          if (filePath) {
            return await changeDetectionService.waitForFileProcessing(filePath, timeout);
          } else {
            return await changeDetectionService.waitForAllProcessing(timeout);
          }
        }
        
        // Default wait for non-test mode or when changeDetectionService is not available
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      },
      
      flushEvents: async (): Promise<void> => {
        if (fileWatcherService.isTestMode()) {
          await fileWatcherService.flushEventQueue();
        }
        
        if (changeDetectionService && changeDetectionService.isTestMode()) {
          await changeDetectionService.flushPendingChanges();
        }
        
        // Additional wait to ensure everything is processed
        await new Promise(resolve => setTimeout(resolve, 200));
      },
      
      isTestMode: (): boolean => {
        return fileWatcherService.isTestMode();
      }
    };
  }

  static async waitForFileExists(filePath: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        // File doesn't exist yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return false;
  }

  static async waitForFileNotExists(filePath: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await fs.access(filePath);
        // File still exists, continue waiting
      } catch {
        // File doesn't exist
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return false;
  }

  static async createFileWithRetry(filePath: string, content: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fs.writeFile(filePath, content);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  static async modifyFileWithRetry(filePath: string, content: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fs.writeFile(filePath, content);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  static async deleteFileWithRetry(filePath: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fs.unlink(filePath);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  static async withTestFile<T>(
    filePath: string,
    content: string,
    operation: (filePath: string) => Promise<T>
  ): Promise<T> {
    try {
      await this.createFileWithRetry(filePath, content);
      return await operation(filePath);
    } finally {
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}