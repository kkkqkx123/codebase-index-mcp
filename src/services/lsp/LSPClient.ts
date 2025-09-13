import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface LSPClientConfig {
  command: string;
  args?: string[];
  workspaceRoot: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface LSPMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

export interface LSPSymbol {
  name: string;
  kind: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  detail?: string;
}

export class LSPError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly data?: any
  ) {
    super(message);
    this.name = 'LSPError';
  }
}

export class LSPClient extends EventEmitter {
  private process?: ChildProcess;
  private messageId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isInitialized = false;
  private buffer = '';

  constructor(private readonly config: LSPClientConfig) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      await this.startProcess();
      await this.sendInitialize();
      this.isInitialized = true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private async startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.workspaceRoot,
      });

      if (!this.process.pid) {
        reject(new LSPError('Failed to start language server process'));
        return;
      }

      this.process.on('error', (error) => {
        this.emit('error', new LSPError(`Process error: ${error.message}`));
      });

      this.process.on('exit', (code, signal) => {
        this.emit('exit', { code, signal });
        this.cleanup();
      });

      this.process.stdout?.on('data', (data) => {
        this.handleData(data);
      });

      this.process.stderr?.on('data', (data) => {
        this.emit('stderr', data.toString());
      });

      // 给进程一些启动时间
      setTimeout(resolve, 100);
    });
  }

  private async sendInitialize(): Promise<void> {
    const capabilities = {
      textDocument: {
        synchronization: {
          dynamicRegistration: false,
          willSave: false,
          willSaveWaitUntil: false,
          didSave: true,
        },
        completion: {
          dynamicRegistration: false,
          completionItem: {
            snippetSupport: false,
          },
        },
        hover: {
          dynamicRegistration: false,
        },
        documentSymbol: {
          dynamicRegistration: false,
        },
        diagnostics: {
          dynamicRegistration: false,
        },
      },
    };

    await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${this.config.workspaceRoot}`,
      rootPath: this.config.workspaceRoot,
      capabilities,
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    
    while (true) {
      const message = this.parseMessage();
      if (!message) break;
      
      this.handleMessage(message);
    }
  }

  private parseMessage(): LSPMessage | null {
    const headerEnd = this.buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return null;

    const headerStr = this.buffer.substring(0, headerEnd);
    const headers = this.parseHeaders(headerStr);
    
    const contentLength = headers['content-length'];
    if (!contentLength) return null;

    const contentStart = headerEnd + 4;
    const contentEnd = contentStart + parseInt(contentLength);

    if (this.buffer.length < contentEnd) return null;

    const content = this.buffer.substring(contentStart, contentEnd);
    this.buffer = this.buffer.substring(contentEnd);

    try {
      return JSON.parse(content);
    } catch (error) {
      this.emit('error', new LSPError('Failed to parse JSON message'));
      return null;
    }
  }

  private parseHeaders(headerStr: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerStr.split('\r\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    return headers;
  }

  private handleMessage(message: LSPMessage): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new LSPError(
            message.error.message,
            message.error.code,
            message.error.data
          ));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      this.emit('notification', message);
    }
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process || this.process.killed) {
      throw new LSPError('Language server process not running');
    }

    const id = ++this.messageId;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new LSPError(`Request timeout: ${method}`));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.sendRawMessage(message);
    });
  }

  private sendRawMessage(message: LSPMessage): void {
    const content = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    
    if (this.process && !this.process.killed) {
      this.process.stdin?.write(headers + content);
    }
  }

  async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    const uri = `file://${path.resolve(filePath)}`;
    
    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: 'typescript',
        version: 1,
        text: '', // 实际文本应该由调用者提供
      },
    });

    // 等待诊断结果
    return new Promise((resolve) => {
      const onNotification = (message: LSPMessage) => {
        if (message.method === 'textDocument/publishDiagnostics') {
          if (message.params?.uri === uri) {
            this.removeListener('notification', onNotification);
            resolve(message.params.diagnostics || []);
          }
        }
      };
      
      this.on('notification', onNotification);
      
      // 超时处理
      setTimeout(() => {
        this.removeListener('notification', onNotification);
        resolve([]);
      }, 5000);
    });
  }

  async getDocumentSymbols(filePath: string, content?: string): Promise<LSPSymbol[]> {
    const uri = `file://${path.resolve(filePath)}`;
    
    if (content) {
      await this.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'typescript',
          version: 1,
          text: content,
        },
      });
    }

    const result = await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri },
    });

    return result || [];
  }

  private async sendNotification(method: string, params?: any): Promise<void> {
    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    
    this.sendRawMessage(message);
  }

  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      try {
        await this.sendRequest('shutdown');
        await this.sendNotification('exit');
      } catch (error) {
        // 忽略关闭时的错误
      }
    }
    
    this.cleanup();
  }

  private cleanup(): void {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new LSPError('Connection closed'));
    });
    
    this.pendingRequests.clear();
    
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    
    this.process = undefined;
    this.isInitialized = false;
  }

  isConnected(): boolean {
    return this.isInitialized && this.process !== undefined && !this.process.killed;
  }

  getWorkspaceRoot(): string {
    return this.config.workspaceRoot;
  }
}