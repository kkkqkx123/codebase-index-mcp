import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  hash: string;
  lastModified: Date;
  language: string;
  isBinary: boolean;
}

export interface TraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  supportedExtensions?: string[];
  followSymlinks?: boolean;
  ignoreHiddenFiles?: boolean;
  ignoreDirectories?: string[];
}

export interface TraversalResult {
  files: FileInfo[];
  directories: string[];
  errors: string[];
  totalSize: number;
  processingTime: number;
}

export class FileSystemTraversal {
  private defaultOptions: Required<TraversalOptions>;

  constructor(options?: TraversalOptions) {
    this.defaultOptions = {
      includePatterns: options?.includePatterns ?? [],
      excludePatterns: options?.excludePatterns ?? ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      maxFileSize: options?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      supportedExtensions: options?.supportedExtensions ?? ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h', '.hpp'],
      followSymlinks: options?.followSymlinks ?? false,
      ignoreHiddenFiles: options?.ignoreHiddenFiles ?? true,
      ignoreDirectories: options?.ignoreDirectories ?? ['node_modules', '.git', 'dist', 'build', 'coverage', 'logs']
    };
  }

  async traverseDirectory(rootPath: string, options?: TraversalOptions): Promise<TraversalResult> {
    const startTime = Date.now();
    const traversalOptions = { ...this.defaultOptions, ...options };
    
    const result: TraversalResult = {
      files: [],
      directories: [],
      errors: [],
      totalSize: 0,
      processingTime: 0
    };

    try {
      await this.traverseRecursive(rootPath, rootPath, result, traversalOptions);
      result.processingTime = Date.now() - startTime;
    } catch (error) {
      result.errors.push(`Failed to traverse directory: ${error instanceof Error ? error.message : String(error)}`);
      result.processingTime = Date.now() - startTime;
    }

    return result;
  }

  private async traverseRecursive(
    currentPath: string,
    rootPath: string,
    result: TraversalResult,
    options: Required<TraversalOptions>
  ): Promise<void> {
    try {
      const stats = await fs.stat(currentPath);
      const relativePath = path.relative(rootPath, currentPath);

      if (stats.isDirectory()) {
        await this.processDirectory(currentPath, relativePath, rootPath, result, options);
      } else if (stats.isFile()) {
        await this.processFile(currentPath, relativePath, stats, result, options);
      }
    } catch (error) {
      // If this is the root path, rethrow to be caught by the outer try-catch
      if (currentPath === rootPath) {
        throw error;
      }
      result.errors.push(`Error accessing ${currentPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processDirectory(
    dirPath: string,
    relativePath: string,
    rootPath: string,
    result: TraversalResult,
    options: Required<TraversalOptions>
  ): Promise<void> {
    const dirName = path.basename(dirPath);

    if (this.shouldIgnoreDirectory(dirName, options)) {
      return;
    }

    if (relativePath !== '') {
      result.directories.push(relativePath);
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.traverseRecursive(fullPath, rootPath, result, options);
        } else if (entry.isFile() || (entry.isSymbolicLink() && options.followSymlinks)) {
          await this.traverseRecursive(fullPath, rootPath, result, options);
        }
      }
    } catch (error) {
      result.errors.push(`Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processFile(
    filePath: string,
    relativePath: string,
    stats: fsSync.Stats,
    result: TraversalResult,
    options: Required<TraversalOptions>
  ): Promise<void> {
    if (this.shouldIgnoreFile(relativePath, options)) {
      return;
    }

    if (stats.size > options.maxFileSize) {
      result.errors.push(`File too large: ${relativePath} (${stats.size} bytes)`);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(extension, options.supportedExtensions);
    
    if (!language) {
      return;
    }

    try {
      const isBinary = await this.isBinaryFile(filePath);
      
      if (isBinary) {
        return;
      }

      const hash = await this.calculateFileHash(filePath);
      
      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        name: path.basename(filePath),
        extension,
        size: stats.size,
        hash,
        lastModified: stats.mtime,
        language,
        isBinary
      };

      result.files.push(fileInfo);
      result.totalSize += stats.size;
    } catch (error) {
      result.errors.push(`Error processing file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private shouldIgnoreDirectory(dirName: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && dirName.startsWith('.')) {
      return true;
    }

    return options.ignoreDirectories.includes(dirName);
  }

  private shouldIgnoreFile(relativePath: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && path.basename(relativePath).startsWith('.')) {
      return true;
    }

    const fileName = path.basename(relativePath).toLowerCase();
    
    for (const pattern of options.excludePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    if (options.includePatterns.length > 0) {
      for (const pattern of options.includePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      // Convert glob pattern to regex
      let regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\./g, '\\.');
      
      // Ensure the pattern matches the entire path
      if (!regexPattern.startsWith('^')) {
        regexPattern = '^' + regexPattern;
      }
      if (!regexPattern.endsWith('$')) {
        regexPattern = regexPattern + '$';
      }
      
      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    } catch (error) {
      // If the pattern is invalid, return false
      return false;
    }
  }

  private detectLanguage(extension: string, supportedExtensions: string[]): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c++': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp'
    };

    const language = languageMap[extension];
    return language && supportedExtensions.includes(extension) ? language : null;
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });
      
      for (let i = 0; i < Math.min(1024, buffer.length); i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return true;
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  async findChangedFiles(rootPath: string, previousHashes: Map<string, string>, options?: TraversalOptions): Promise<FileInfo[]> {
    const result = await this.traverseDirectory(rootPath, options);
    const changedFiles: FileInfo[] = [];

    for (const file of result.files) {
      const previousHash = previousHashes.get(file.relativePath);
      
      if (!previousHash || previousHash !== file.hash) {
        changedFiles.push(file);
      }
    }

    return changedFiles;
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDirectoryStats(rootPath: string, options?: TraversalOptions): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByLanguage: Record<string, number>;
    largestFiles: FileInfo[];
  }> {
    const result = await this.traverseDirectory(rootPath, options);
    
    const filesByLanguage: Record<string, number> = {};
    const largestFiles = [...result.files].sort((a, b) => b.size - a.size).slice(0, 10);

    for (const file of result.files) {
      filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;
    }

    return {
      totalFiles: result.files.length,
      totalSize: result.totalSize,
      filesByLanguage,
      largestFiles
    };
  }
}