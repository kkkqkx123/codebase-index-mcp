import { FileWatcherService } from '../../src/services/filesystem/FileWatcherService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService, ErrorContext } from '../../src/core/ErrorHandlerService';
import { FileSystemTraversal, FileInfo, TraversalOptions } from '../../src/services/filesystem/FileSystemTraversal';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';

// Mock chokidar
jest.mock('chokidar');
const mockChokidar = chokidar as jest.Mocked<typeof chokidar>;

// Mock fs
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

describe('FileWatcherService', () => {
  let fileWatcherService: FileWatcherService;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockFileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let mockWatcher: jest.Mocked<any>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockErrorHandlerService = {
      handleError: jest.fn(),
    };

    mockFileSystemTraversal = {
      traverseDirectory: jest.fn(),
      findChangedFiles: jest.fn(),
      getFileContent: jest.fn(),
      getDirectoryStats: jest.fn(),
      isBinaryFile: jest.fn(),
      calculateFileHash: jest.fn(),
    } as any;

    // Mock path functions
    mockPath.resolve.mockImplementation((...paths) => paths.join('/'));
    mockPath.relative.mockImplementation((from, to) => to.replace(from + '/', ''));
    mockPath.basename.mockImplementation((p) => p.split('/').pop() || '');
    mockPath.extname.mockImplementation((p) => {
      const match = p.match(/\.[^.]+$/);
      return match ? match[0] : '';
    });

    // Mock chokidar watcher
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockChokidar.watch.mockReturnValue(mockWatcher);

    // Mock fs
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 1024,
      mtime: new Date(),
    } as any);

    // Create service instance
    fileWatcherService = new FileWatcherService(
      mockLoggerService,
      mockErrorHandlerService,
      mockFileSystemTraversal,
      {
        maxFileSize: 10 * 1024 * 1024,
        supportedExtensions: ['.ts', '.js', '.py'],
      }
    );
  });

  describe('Constructor', () => {
    it('should initialize with correct dependencies', () => {
      expect(fileWatcherService).toBeInstanceOf(FileWatcherService);
      expect(fileWatcherService['logger']).toBe(mockLoggerService);
      expect(fileWatcherService['errorHandler']).toBe(mockErrorHandlerService);
      expect(fileWatcherService['fileSystemTraversal']).toBe(mockFileSystemTraversal);
    });

    it('should initialize with default traversal options', () => {
      expect(fileWatcherService['traversalOptions']).toEqual({
        maxFileSize: 10 * 1024 * 1024,
        supportedExtensions: ['.ts', '.js', '.py'],
      });
    });

    it('should initialize with empty callbacks', () => {
      expect(fileWatcherService['callbacks']).toEqual({});
    });

    it('should not be watching initially', () => {
      expect(fileWatcherService['isWatching']).toBe(false);
      expect(fileWatcherService.getWatchedPaths()).toEqual([]);
    });
  });

  describe('setCallbacks', () => {
    it('should set callbacks correctly', () => {
      const callbacks = {
        onFileAdded: jest.fn(),
        onFileChanged: jest.fn(),
        onFileDeleted: jest.fn(),
        onDirectoryAdded: jest.fn(),
        onDirectoryDeleted: jest.fn(),
        onError: jest.fn(),
        onReady: jest.fn(),
      };

      fileWatcherService.setCallbacks(callbacks);

      expect(fileWatcherService['callbacks']).toEqual(callbacks);
    });

    it('should merge callbacks with existing ones', () => {
      const initialCallbacks = {
        onFileAdded: jest.fn(),
        onFileChanged: jest.fn(),
      };

      const additionalCallbacks = {
        onFileDeleted: jest.fn(),
        onError: jest.fn(),
      };

      fileWatcherService.setCallbacks(initialCallbacks);
      fileWatcherService.setCallbacks(additionalCallbacks);

      expect(fileWatcherService['callbacks']).toEqual({
        onFileAdded: initialCallbacks.onFileAdded,
        onFileChanged: initialCallbacks.onFileChanged,
        onFileDeleted: additionalCallbacks.onFileDeleted,
        onError: additionalCallbacks.onError,
      });
    });
  });

  describe('startWatching', () => {
    const defaultOptions = {
      watchPaths: ['/test/path'],
      ignored: ['**/node_modules/**'],
    };

    it('should start watching for multiple paths', async () => {
      const options = {
        ...defaultOptions,
        watchPaths: ['/path1', '/path2'],
      };

      await fileWatcherService.startWatching(options);

      expect(mockChokidar.watch).toHaveBeenCalledTimes(2);
      expect(mockChokidar.watch).toHaveBeenCalledWith('/path1', expect.any(Object));
      expect(mockChokidar.watch).toHaveBeenCalledWith('/path2', expect.any(Object));
      expect(fileWatcherService['isWatching']).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting file watcher', { options });
      expect(mockLoggerService.info).toHaveBeenCalledWith('File watcher started successfully');
    });

    it('should not start watching if already watching', async () => {
      fileWatcherService['isWatching'] = true;

      await fileWatcherService.startWatching(defaultOptions);

      expect(mockChokidar.watch).not.toHaveBeenCalled();
      expect(mockLoggerService.warn).toHaveBeenCalledWith('FileWatcherService is already watching');
    });

    it('should skip paths that do not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('Path not found'));

      await fileWatcherService.startWatching(defaultOptions);

      expect(mockChokidar.watch).not.toHaveBeenCalled();
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Watch path does not exist: /test/path');
    });

    it('should handle errors during startWatching', async () => {
      const error = new Error('Start failed');
      mockChokidar.watch.mockImplementation(() => {
        throw error;
      });

      await expect(fileWatcherService.startWatching(defaultOptions)).rejects.toThrow('Start failed');

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        error,
        {
          component: 'FileWatcherService',
          operation: 'startWatching',
          metadata: { options: defaultOptions },
        }
      );
    });

    it('should configure chokidar with correct options', async () => {
      const options = {
        ...defaultOptions,
        ignoreInitial: false,
        followSymlinks: true,
        usePolling: true,
        interval: 100,
        binaryInterval: 200,
        alwaysStat: false,
        depth: 5,
        awaitWriteFinish: true,
        awaitWriteFinishOptions: {
          stabilityThreshold: 3000,
          pollInterval: 200,
        },
        cwd: '/custom/cwd',
      };

      await fileWatcherService.startWatching(options);

      expect(mockChokidar.watch).toHaveBeenCalledWith('/test/path', {
        ignored: ['**/node_modules/**'],
        ignoreInitial: false,
        followSymlinks: true,
        usePolling: true,
        alwaysStat: false,
        cwd: '/custom/cwd',
        interval: 100,
        binaryInterval: 200,
        depth: 5,
        awaitWriteFinish: {
          stabilityThreshold: 3000,
          pollInterval: 200,
        },
      });
    });

    it('should use default chokidar options when not specified', async () => {
      await fileWatcherService.startWatching(defaultOptions);

      expect(mockChokidar.watch).toHaveBeenCalledWith('/test/path', {
        ignored: ['**/node_modules/**'],
        ignoreInitial: true,
        followSymlinks: false,
        usePolling: false,
        alwaysStat: true,
      });
    });

    it('should set up event handlers correctly', async () => {
      await fileWatcherService.startWatching(defaultOptions);

      expect(mockWatcher.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('addDir', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlinkDir', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('stopWatching', () => {
    beforeEach(async () => {
      // Start watching first
      await fileWatcherService.startWatching({
        watchPaths: ['/test/path'],
      });
      fileWatcherService['isWatching'] = true;
    });

    it('should stop watching all paths', async () => {
      await fileWatcherService.stopWatching();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcherService['isWatching']).toBe(false);
      expect(fileWatcherService['watchers'].size).toBe(0);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Stopping file watcher');
      expect(mockLoggerService.info).toHaveBeenCalledWith('File watcher stopped successfully');
    });

    it('should not stop watching if not watching', async () => {
      fileWatcherService['isWatching'] = false;

      await fileWatcherService.stopWatching();

      expect(mockWatcher.close).not.toHaveBeenCalled();
      expect(mockLoggerService.warn).toHaveBeenCalledWith('FileWatcherService is not watching');
    });

    it('should handle errors during stopWatching', async () => {
      const error = new Error('Stop failed');
      mockWatcher.close.mockRejectedValue(error);

      await expect(fileWatcherService.stopWatching()).rejects.toThrow('Stop failed');

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        error,
        {
          component: 'FileWatcherService',
          operation: 'stopWatching',
        }
      );
    });

    it('should handle watcher close errors gracefully', async () => {
      mockWatcher.close.mockRejectedValue(new Error('Close failed'));

      await fileWatcherService.stopWatching();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Error stopping watcher for path /test/path',
        expect.any(Error)
      );
      expect(fileWatcherService['isWatching']).toBe(false);
    });
  });

  describe('getWatchedPaths and isWatchingPath', () => {
    beforeEach(async () => {
      await fileWatcherService.startWatching({
        watchPaths: ['/path1', '/path2'],
      });
    });

    it('should return all watched paths', () => {
      const watchedPaths = fileWatcherService.getWatchedPaths();

      expect(watchedPaths).toEqual(['/path1', '/path2']);
    });

    it('should check if specific path is being watched', () => {
      expect(fileWatcherService.isWatchingPath('/path1')).toBe(true);
      expect(fileWatcherService.isWatchingPath('/path2')).toBe(true);
      expect(fileWatcherService.isWatchingPath('/unwatched')).toBe(false);
    });
  });

  describe('File Event Handling', () => {
    const mockStats = { size: 1024 };
    const mockFileInfo: FileInfo = {
      path: '/test/path/file.ts',
      relativePath: 'file.ts',
      name: 'file.ts',
      extension: '.ts',
      size: 1024,
      hash: 'test-hash',
      lastModified: new Date(),
      language: 'typescript',
      isBinary: false,
    };

    beforeEach(async () => {
      await fileWatcherService.startWatching({
        watchPaths: ['/test/path'],
      });

      // Mock file system traversal methods
      mockFileSystemTraversal['isBinaryFile'] = jest.fn().mockResolvedValue(false);
      mockFileSystemTraversal['calculateFileHash'] = jest.fn().mockResolvedValue('test-hash');
    });

    describe('handleFileAdd', () => {
      it('should handle file add event', async () => {
        const onFileAdded = jest.fn();
        fileWatcherService.setCallbacks({ onFileAdded });

        // Get the add handler and call it
        const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
        await addHandler!('/test/path/file.ts', mockStats, '/test/path');

        expect(onFileAdded).toHaveBeenCalledWith(mockFileInfo);
        expect(mockLoggerService.debug).toHaveBeenCalledWith('File added: /test/path/file.ts', { size: 1024 });
      });

      it('should handle file add callback errors', async () => {
        const onFileAdded = jest.fn().mockImplementation(() => {
          throw new Error('Callback error');
        });
        fileWatcherService.setCallbacks({ onFileAdded });

        const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
        await addHandler!('/test/path/file.ts', mockStats, '/test/path');

        expect(mockLoggerService.error).toHaveBeenCalledWith('Error in onFileAdded callback', expect.any(Error));
      });

      it('should handle file add event errors', async () => {
        mockFileSystemTraversal['calculateFileHash'] = jest.fn().mockRejectedValue(new Error('Hash failed'));

        const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
        await addHandler!('/test/path/file.ts', mockStats, '/test/path');

        expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
          expect.any(Error),
          {
            component: 'FileWatcherService',
            operation: 'fileEvent:add',
            metadata: { filePath: '/test/path/file.ts' },
          }
        );
      });
    });

    describe('handleFileChange', () => {
      it('should handle file change event', async () => {
        const onFileChanged = jest.fn();
        fileWatcherService.setCallbacks({ onFileChanged });

        const changeHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'change')?.[1];
        await changeHandler!('/test/path/file.ts', mockStats, '/test/path');

        expect(onFileChanged).toHaveBeenCalledWith(mockFileInfo);
        expect(mockLoggerService.debug).toHaveBeenCalledWith('File changed: /test/path/file.ts', { size: 1024 });
      });
    });

    describe('handleFileDelete', () => {
      it('should handle file delete event', () => {
        const onFileDeleted = jest.fn();
        fileWatcherService.setCallbacks({ onFileDeleted });

        const deleteHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'unlink')?.[1];
        deleteHandler!('/test/path/file.ts', '/test/path');

        expect(onFileDeleted).toHaveBeenCalledWith('/test/path/file.ts');
        expect(mockLoggerService.debug).toHaveBeenCalledWith('File deleted: /test/path/file.ts');
      });
    });

    describe('handleDirectoryAdd', () => {
      it('should handle directory add event', () => {
        const onDirectoryAdded = jest.fn();
        fileWatcherService.setCallbacks({ onDirectoryAdded });

        const addDirHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'addDir')?.[1];
        addDirHandler!('/test/path/newdir', '/test/path');

        expect(onDirectoryAdded).toHaveBeenCalledWith('/test/path/newdir');
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Directory added: /test/path/newdir');
      });
    });

    describe('handleDirectoryDelete', () => {
      it('should handle directory delete event', () => {
        const onDirectoryDeleted = jest.fn();
        fileWatcherService.setCallbacks({ onDirectoryDeleted });

        const unlinkDirHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'unlinkDir')?.[1];
        unlinkDirHandler!('/test/path/olddir', '/test/path');

        expect(onDirectoryDeleted).toHaveBeenCalledWith('/test/path/olddir');
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Directory deleted: /test/path/olddir');
      });
    });

    describe('handleWatcherError', () => {
      it('should handle watcher error event', () => {
        const onError = jest.fn();
        fileWatcherService.setCallbacks({ onError });
        const error = new Error('Watcher error');

        const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')?.[1];
        errorHandler!(error, '/test/path');

        expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
          error,
          {
            component: 'FileWatcherService',
            operation: 'watcher',
            metadata: { watchPath: '/test/path' },
          }
        );
        expect(mockLoggerService.error).toHaveBeenCalledWith('File watcher error for path /test/path', error);
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    describe('handleWatcherReady', () => {
      it('should handle watcher ready event', () => {
        const onReady = jest.fn();
        fileWatcherService.setCallbacks({ onReady });

        const readyHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'ready')?.[1];
        readyHandler!('/test/path');

        expect(mockLoggerService.info).toHaveBeenCalledWith('File watcher ready for path: /test/path');
        expect(onReady).toHaveBeenCalled();
      });
    });
  });

  describe('File Filtering and Validation', () => {
    beforeEach(async () => {
      await fileWatcherService.startWatching({
        watchPaths: ['/test/path'],
      });
    });

    describe('shouldIgnoreFile', () => {
      it('should ignore hidden files', () => {
        const shouldIgnore = (fileWatcherService as any).shouldIgnoreFile('.gitignore');
        expect(shouldIgnore).toBe(true);
      });

      it('should ignore files matching exclude patterns', () => {
        const shouldIgnore = (fileWatcherService as any).shouldIgnoreFile('node_modules/lodash/index.js');
        expect(shouldIgnore).toBe(true);
      });

      it('should not ignore valid files', () => {
        const shouldIgnore = (fileWatcherService as any).shouldIgnoreFile('src/index.ts');
        expect(shouldIgnore).toBe(false);
      });

      it('should respect ignoreHiddenFiles setting', () => {
        const serviceWithHiddenFiles = new FileWatcherService(
          mockLoggerService,
          mockErrorHandlerService,
          mockFileSystemTraversal,
          { ignoreHiddenFiles: false }
        );

        const shouldIgnore = (serviceWithHiddenFiles as any).shouldIgnoreFile('.gitignore');
        expect(shouldIgnore).toBe(false);
      });
    });

    describe('detectLanguage', () => {
      it('should detect languages based on file extension', () => {
        const detectLanguage = (fileWatcherService as any).detectLanguage;

        expect(detectLanguage('.ts')).toBe('typescript');
        expect(detectLanguage('.js')).toBe('javascript');
        expect(detectLanguage('.py')).toBe('python');
        expect(detectLanguage('.java')).toBe('java');
        expect(detectLanguage('.go')).toBe('go');
        expect(detectLanguage('.rs')).toBe('rust');
        expect(detectLanguage('.cpp')).toBe('cpp');
        expect(detectLanguage('.c')).toBe('c');
      });

      it('should return null for unsupported extensions', () => {
        const detectLanguage = (fileWatcherService as any).detectLanguage;
        expect(detectLanguage('.txt')).toBeNull();
        expect(detectLanguage('.md')).toBeNull();
      });

      it('should respect supported extensions list', () => {
        const serviceWithLimitedExtensions = new FileWatcherService(
          mockLoggerService,
          mockErrorHandlerService,
          mockFileSystemTraversal,
          { supportedExtensions: ['.ts', '.js'] }
        );

        const detectLanguage = (serviceWithLimitedExtensions as any).detectLanguage;
        expect(detectLanguage('.py')).toBeNull(); // Not in supported list
        expect(detectLanguage('.ts')).toBe('typescript'); // In supported list
      });
    });

    describe('matchesPattern', () => {
      it('should match glob patterns correctly', () => {
        const matchesPattern = (fileWatcherService as any).matchesPattern;

        expect(matchesPattern('src/index.ts', '**/*.ts')).toBe(true);
        expect(matchesPattern('node_modules/lodash/index.js', '**/node_modules/**')).toBe(true);
        expect(matchesPattern('src/index.ts', '*.js')).toBe(false);
        expect(matchesPattern('test/file.test.ts', '**/*.test.ts')).toBe(true);
      });

      it('should handle invalid regex patterns gracefully', () => {
        const matchesPattern = (fileWatcherService as any).matchesPattern;
        expect(matchesPattern('test.txt', '[')).toBe(false); // Invalid regex
      });
    });
  });

  describe('getFileInfo', () => {
    beforeEach(async () => {
      await fileWatcherService.startWatching({
        watchPaths: ['/test/path'],
      });

      mockFileSystemTraversal['isBinaryFile'] = jest.fn().mockResolvedValue(false);
      mockFileSystemTraversal['calculateFileHash'] = jest.fn().mockResolvedValue('test-hash');
    });

    it('should return file info for valid files', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 2048,
        mtime: new Date('2023-01-01'),
      } as any);

      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/file.ts', '/test/path');

      expect(fileInfo).toEqual({
        path: '/test/path/file.ts',
        relativePath: 'file.ts',
        name: 'file.ts',
        extension: '.ts',
        size: 2048,
        hash: 'test-hash',
        lastModified: expect.any(Date),
        language: 'typescript',
        isBinary: false,
      });
    });

    it('should return null for files outside watch path', async () => {
      mockPath.resolve.mockImplementation((...paths) => {
        if (paths.includes('outside')) return '/outside/file.ts';
        return '/test/path';
      });

      const fileInfo = await (fileWatcherService as any).getFileInfo('/outside/file.ts', '/test/path');
      expect(fileInfo).toBeNull();
    });

    it('should return null for files that are too large', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 20 * 1024 * 1024, // 20MB, larger than default 10MB
        mtime: new Date(),
      } as any);

      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/large.ts', '/test/path');
      expect(fileInfo).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalledWith('File too large: large.ts (20971520 bytes)');
    });

    it('should return null for files that should be ignored', async () => {
      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/.gitignore', '/test/path');
      expect(fileInfo).toBeNull();
    });

    it('should return null for unsupported file types', async () => {
      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/file.txt', '/test/path');
      expect(fileInfo).toBeNull();
    });

    it('should return null for binary files', async () => {
      mockFileSystemTraversal['isBinaryFile'] = jest.fn().mockResolvedValue(true);

      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/file.ts', '/test/path');
      expect(fileInfo).toBeNull();
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.stat.mockRejectedValue(new Error('Stat failed'));

      const fileInfo = await (fileWatcherService as any).getFileInfo('/test/path/error.ts', '/test/path');
      expect(fileInfo).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith('Error getting file info for /test/path/error.ts', expect.any(Error));
    });
  });
});