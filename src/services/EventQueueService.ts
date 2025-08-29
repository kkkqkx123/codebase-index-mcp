import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService, ErrorContext, CodebaseIndexError } from '../core/ErrorHandlerService';
import { ChangeDetectionService, FileChangeEvent } from './filesystem/ChangeDetectionService';
import fs from 'fs/promises';
import path from 'path';

export interface EventQueueOptions {
  maxQueueSize?: number;
  batchSize?: number;
  batchTimeout?: number;
  priorityLevels?: number;
  persistencePath?: string;
  enablePersistence?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableOverflowHandling?: boolean;
  overflowStrategy?: 'drop' | 'persist' | 'block';
}

export interface QueuedEvent {
  id: string;
  type: 'created' | 'modified' | 'deleted';
  path: string;
  relativePath: string;
  previousHash?: string | undefined;
  currentHash?: string | undefined;
  timestamp: Date;
  size?: number | undefined;
  language?: string | undefined;
  priority: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface EventBatch {
  id: string;
  events: QueuedEvent[];
  timestamp: Date;
  priority: number;
}

export interface QueueStatus {
  totalEvents: number;
  eventsByPriority: Record<number, number>;
  isProcessing: boolean;
  lastProcessed?: Date | undefined;
  batchesProcessed: number;
  eventsProcessed: number;
  errorsEncountered: number;
  averageProcessingTime: number;
  queueSize: number;
  maxQueueSize: number;
  overflowCount: number;
}

export interface EventQueueCallbacks {
  onEventEnqueued?: (event: QueuedEvent) => void;
  onEventDequeued?: (event: QueuedEvent) => void;
  onBatchProcessed?: (batch: EventBatch) => void;
  onError?: (error: Error, event?: QueuedEvent) => void;
  onQueueOverflow?: (events: QueuedEvent[]) => void;
  onStatusChange?: (status: QueueStatus) => void;
}

@injectable()
export class EventQueueService extends EventEmitter {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private changeDetectionService: ChangeDetectionService;
  
  private queue: Map<string, QueuedEvent> = new Map();
  private priorityQueues: Map<number, string[]> = new Map();
  private isProcessing: boolean = false;
  private processingTimer?: NodeJS.Timeout | undefined;
  private options: Required<EventQueueOptions>;
  private callbacks: EventQueueCallbacks = {};
  
  // Statistics and monitoring
  private stats = {
    totalEvents: 0,
    eventsProcessed: 0,
    batchesProcessed: 0,
    errorsEncountered: 0,
    totalProcessingTime: 0,
    overflowCount: 0,
    lastProcessedTime: 0
  };
  
  // Persistence
  private persistencePath: string;
  private persistenceEnabled: boolean;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ChangeDetectionService) changeDetectionService: ChangeDetectionService,
    options?: EventQueueOptions
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.changeDetectionService = changeDetectionService;
    
    // Set default options
    this.options = {
      maxQueueSize: options?.maxQueueSize ?? 10000,
      batchSize: options?.batchSize ?? 50,
      batchTimeout: options?.batchTimeout ?? 5000,
      priorityLevels: options?.priorityLevels ?? 5,
      persistencePath: options?.persistencePath ?? path.join(process.cwd(), 'data', 'event-queue'),
      enablePersistence: options?.enablePersistence ?? true,
      maxRetries: options?.maxRetries ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
      enableOverflowHandling: options?.enableOverflowHandling ?? true,
      overflowStrategy: options?.overflowStrategy ?? 'persist'
    };
    
    this.persistencePath = this.options.persistencePath;
    this.persistenceEnabled = this.options.enablePersistence;
    
    // Initialize priority queues
    for (let i = 0; i < this.options.priorityLevels; i++) {
      this.priorityQueues.set(i, []);
    }
    
    this.setupChangeDetectionCallbacks();
    this.initializePersistence();
  }

  setCallbacks(callbacks: EventQueueCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setupChangeDetectionCallbacks(): void {
    const callbacks = {
      onFileCreated: (event: FileChangeEvent) => this.handleFileCreated(event),
      onFileModified: (event: FileChangeEvent) => this.handleFileModified(event),
      onFileDeleted: (event: FileChangeEvent) => this.handleFileDeleted(event),
      onError: (error: Error) => this.handleError(error)
    };
    
    this.changeDetectionService.setCallbacks(callbacks);
  }

  private async initializePersistence(): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });
      await this.loadPersistedEvents();
      this.logger.info('Event queue persistence initialized', { path: this.persistencePath });
    } catch (error) {
      this.logger.error('Failed to initialize event queue persistence', error);
      this.persistenceEnabled = false;
    }
  }

  private async loadPersistedEvents(): Promise<void> {
    try {
      const files = await fs.readdir(this.persistencePath);
      const eventFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of eventFiles) {
        try {
          const content = await fs.readFile(path.join(this.persistencePath, file), 'utf-8');
          const event: QueuedEvent = JSON.parse(content);
          this.enqueueInternal(event, false); // Don't persist already persisted events
        } catch (error) {
          this.logger.error(`Failed to load persisted event from ${file}`, error);
        }
      }
      
      this.logger.info(`Loaded ${eventFiles.length} persisted events`);
    } catch (error) {
      this.logger.error('Failed to load persisted events', error);
    }
  }

  private async persistEvent(event: QueuedEvent): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      const filePath = path.join(this.persistencePath, `${event.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(event, null, 2));
    } catch (error) {
      this.logger.error('Failed to persist event', { eventId: event.id, error });
    }
  }

  private async removePersistedEvent(eventId: string): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      const filePath = path.join(this.persistencePath, `${eventId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error('Failed to remove persisted event', { eventId, error });
    }
  }

  private calculatePriority(event: FileChangeEvent): number {
    // Higher priority for deletions, then modifications, then creations
    let priority = 0;
    
    switch (event.type) {
      case 'deleted':
        priority = 4; // Highest priority
        break;
      case 'modified':
        priority = 2;
        break;
      case 'created':
        priority = 1;
        break;
    }
    
    // Adjust priority based on file size (smaller files get higher priority)
    if (event.size) {
      if (event.size < 1024) priority += 1; // Small files
      else if (event.size > 1024 * 1024) priority -= 1; // Large files
    }
    
    // Adjust priority based on language (some languages are more critical)
    const criticalLanguages = ['typescript', 'javascript', 'python', 'java'];
    if (event.language && criticalLanguages.includes(event.language.toLowerCase())) {
      priority += 1;
    }
    
    // Ensure priority is within bounds
    return Math.max(0, Math.min(priority, this.options.priorityLevels - 1));
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleFileCreated(event: FileChangeEvent): Promise<void> {
    const priority = this.calculatePriority(event);
    const queuedEvent: QueuedEvent = {
      id: this.generateEventId(),
      type: event.type,
      path: event.path,
      relativePath: event.relativePath,
      currentHash: event.currentHash,
      timestamp: event.timestamp,
      size: event.size,
      language: event.language,
      priority,
      retryCount: 0,
      previousHash: undefined
    };
    
    await this.enqueue(queuedEvent);
  }

  private async handleFileModified(event: FileChangeEvent): Promise<void> {
    const priority = this.calculatePriority(event);
    const queuedEvent: QueuedEvent = {
      id: this.generateEventId(),
      type: event.type,
      path: event.path,
      relativePath: event.relativePath,
      previousHash: event.previousHash,
      currentHash: event.currentHash,
      timestamp: event.timestamp,
      size: event.size,
      language: event.language,
      priority,
      retryCount: 0
    };
    
    await this.enqueue(queuedEvent);
  }

  private async handleFileDeleted(event: FileChangeEvent): Promise<void> {
    const priority = this.calculatePriority(event);
    const queuedEvent: QueuedEvent = {
      id: this.generateEventId(),
      type: event.type,
      path: event.path,
      relativePath: event.relativePath,
      previousHash: event.previousHash,
      timestamp: event.timestamp,
      priority,
      retryCount: 0,
      currentHash: undefined,
      size: undefined,
      language: undefined
    };
    
    await this.enqueue(queuedEvent);
  }

  private handleError(error: Error): void {
    const errorContext: ErrorContext = {
      component: 'EventQueueService',
      operation: 'changeDetection',
      metadata: {}
    };
    
    this.errorHandler.handleError(error, errorContext);
    this.logger.error('Error in change detection', error);
    
    if (this.callbacks.onError) {
      try {
        this.callbacks.onError(error);
      } catch (callbackError) {
        this.logger.error('Error in onError callback', callbackError);
      }
    }
  }

  async enqueue(event: QueuedEvent): Promise<boolean> {
    return this.enqueueInternal(event, true);
  }

  private async enqueueInternal(event: QueuedEvent, persist: boolean): Promise<boolean> {
    try {
      // Check queue size limits
      if (this.queue.size >= this.options.maxQueueSize) {
        await this.handleQueueOverflow([event]);
        return false;
      }
      
      // Add to queue
      this.queue.set(event.id, event);
      this.priorityQueues.get(event.priority)!.push(event.id);
      
      // Update statistics
      this.stats.totalEvents++;
      
      // Persist event if needed
      if (persist) {
        await this.persistEvent(event);
      }
      
      // Notify callbacks
      if (this.callbacks.onEventEnqueued) {
        try {
          this.callbacks.onEventEnqueued(event);
        } catch (error) {
          this.logger.error('Error in onEventEnqueued callback', error);
        }
      }
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }
      
      this.logger.debug('Event enqueued', { eventId: event.id, type: event.type, priority: event.priority });
      return true;
    } catch (error) {
      this.logger.error('Failed to enqueue event', { eventId: event.id, error });
      return false;
    }
  }

  private async handleQueueOverflow(events: QueuedEvent[]): Promise<void> {
    this.stats.overflowCount += events.length;
    
    if (!this.options.enableOverflowHandling) {
      this.logger.warn('Queue overflow detected, events dropped', { count: events.length });
      return;
    }
    
    switch (this.options.overflowStrategy) {
      case 'drop':
        this.logger.warn('Queue overflow detected, events dropped', { count: events.length });
        break;
        
      case 'persist':
        try {
          const overflowPath = path.join(this.persistencePath, 'overflow');
          await fs.mkdir(overflowPath, { recursive: true });
          
          for (const event of events) {
            const filePath = path.join(overflowPath, `${event.id}.json`);
            await fs.writeFile(filePath, JSON.stringify(event, null, 2));
          }
          
          this.logger.info('Queue overflow detected, events persisted to overflow directory', { 
            count: events.length, 
            path: overflowPath 
          });
        } catch (error) {
          this.logger.error('Failed to persist overflow events', error);
        }
        break;
        
      case 'block':
        this.logger.warn('Queue overflow detected, blocking until space available', { count: events.length });
        // In a real implementation, we might wait for space to become available
        break;
    }
    
    if (this.callbacks.onQueueOverflow) {
      try {
        this.callbacks.onQueueOverflow(events);
      } catch (error) {
        this.logger.error('Error in onQueueOverflow callback', error);
      }
    }
  }

  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.logger.info('Event queue processing started');
    
    // Process batches immediately and then on a timer
    this.processNextBatch();
    
    // Set up timer for batch processing
    this.processingTimer = setInterval(() => {
      this.processNextBatch();
    }, this.options.batchTimeout);
  }

  private stopProcessing(): void {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
    
    this.logger.info('Event queue processing stopped');
  }

  private async processNextBatch(): Promise<void> {
    if (!this.isProcessing || this.queue.size === 0) {
      if (this.queue.size === 0) {
        this.stopProcessing();
      }
      return;
    }
    
    try {
      const batch = this.createBatch();
      if (batch.events.length === 0) return;
      
      const startTime = Date.now();
      await this.processBatch(batch);
      const processingTime = Date.now() - startTime;
      
      // Update statistics
      this.stats.batchesProcessed++;
      this.stats.eventsProcessed += batch.events.length;
      this.stats.totalProcessingTime += processingTime;
      this.stats.lastProcessedTime = Date.now();
      
      this.logger.debug('Batch processed', { 
        batchId: batch.id, 
        eventCount: batch.events.length,
        processingTime 
      });
      
      // Notify callbacks
      if (this.callbacks.onBatchProcessed) {
        try {
          this.callbacks.onBatchProcessed(batch);
        } catch (error) {
          this.logger.error('Error in onBatchProcessed callback', error);
        }
      }
      
      // Notify status change
      this.notifyStatusChange();
    } catch (error) {
      this.logger.error('Failed to process batch', error);
      this.stats.errorsEncountered++;
      
      if (this.callbacks.onError) {
        try {
          this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        } catch (callbackError) {
          this.logger.error('Error in onError callback', callbackError);
        }
      }
    }
  }

  private createBatch(): EventBatch {
    const events: QueuedEvent[] = [];
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let highestPriority = 0;
    
    // Collect events from highest to lowest priority
    for (let priority = this.options.priorityLevels - 1; priority >= 0; priority--) {
      const queue = this.priorityQueues.get(priority)!;
      
      while (queue.length > 0 && events.length < this.options.batchSize) {
        const eventId = queue.shift()!;
        const event = this.queue.get(eventId);
        
        if (event) {
          events.push(event);
          highestPriority = Math.max(highestPriority, priority);
        }
      }
      
      if (events.length >= this.options.batchSize) {
        break;
      }
    }
    
    return {
      id: batchId,
      events,
      timestamp: new Date(),
      priority: highestPriority
    };
  }

  private async processBatch(batch: EventBatch): Promise<void> {
    const failedEvents: QueuedEvent[] = [];
    
    for (const event of batch.events) {
      try {
        await this.processEvent(event);
        
        // Remove from queue and persistence
        this.queue.delete(event.id);
        await this.removePersistedEvent(event.id);
        
        // Notify callbacks
        if (this.callbacks.onEventDequeued) {
          try {
            this.callbacks.onEventDequeued(event);
          } catch (error) {
            this.logger.error('Error in onEventDequeued callback', error);
          }
        }
      } catch (error) {
        this.logger.error('Failed to process event', { eventId: event.id, error });
        this.stats.errorsEncountered++;
        
        // Handle retries
        if (event.retryCount < this.options.maxRetries) {
          event.retryCount++;
          this.logger.info('Retrying event', { eventId: event.id, retryCount: event.retryCount });
          
          // Add back to queue with delay
          setTimeout(() => {
            this.enqueueInternal(event, false);
          }, this.options.retryDelay * event.retryCount);
        } else {
          this.logger.error('Event exceeded max retries, dropping', { eventId: event.id });
          failedEvents.push(event);
          
          // Remove from queue and persistence
          this.queue.delete(event.id);
          await this.removePersistedEvent(event.id);
        }
        
        if (this.callbacks.onError) {
          try {
            this.callbacks.onError(error instanceof Error ? error : new Error(String(error)), event);
          } catch (callbackError) {
            this.logger.error('Error in onError callback', callbackError);
          }
        }
      }
    }
    
    // Handle failed events
    if (failedEvents.length > 0) {
      await this.handleQueueOverflow(failedEvents);
    }
  }

  private async processEvent(event: QueuedEvent): Promise<void> {
    // This is where the actual event processing would happen
    // For now, we'll simulate processing with a delay
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
    
    // Emit event for other services to handle
    this.emit('eventProcessed', event);
    
    this.logger.debug('Event processed', { eventId: event.id, type: event.type });
  }

  private notifyStatusChange(): void {
    if (this.callbacks.onStatusChange) {
      try {
        this.callbacks.onStatusChange(this.getStatus());
      } catch (error) {
        this.logger.error('Error in onStatusChange callback', error);
      }
    }
  }

  getStatus(): QueueStatus {
    const eventsByPriority: Record<number, number> = {};
    
    for (let i = 0; i < this.options.priorityLevels; i++) {
      eventsByPriority[i] = this.priorityQueues.get(i)!.length;
    }
    
    const averageProcessingTime = this.stats.eventsProcessed > 0 
      ? this.stats.totalProcessingTime / this.stats.eventsProcessed 
      : 0;
    
    return {
      totalEvents: this.queue.size,
      eventsByPriority,
      isProcessing: this.isProcessing,
      lastProcessed: this.stats.lastProcessedTime ? new Date(this.stats.lastProcessedTime) : undefined,
      batchesProcessed: this.stats.batchesProcessed,
      eventsProcessed: this.stats.eventsProcessed,
      errorsEncountered: this.stats.errorsEncountered,
      averageProcessingTime,
      queueSize: this.queue.size,
      maxQueueSize: this.options.maxQueueSize,
      overflowCount: this.stats.overflowCount
    };
  }

  async clear(): Promise<void> {
    this.logger.info('Clearing event queue');
    
    // Stop processing
    this.stopProcessing();
    
    // Clear in-memory queues
    this.queue.clear();
    for (let i = 0; i < this.options.priorityLevels; i++) {
      this.priorityQueues.get(i)!.length = 0;
    }
    
    // Clear persisted events
    if (this.persistenceEnabled) {
      try {
        const files = await fs.readdir(this.persistencePath);
        const eventFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('overflow'));
        
        for (const file of eventFiles) {
          await fs.unlink(path.join(this.persistencePath, file));
        }
        
        // Clear overflow directory
        const overflowPath = path.join(this.persistencePath, 'overflow');
        try {
          const overflowFiles = await fs.readdir(overflowPath);
          for (const file of overflowFiles) {
            await fs.unlink(path.join(overflowPath, file));
          }
          await fs.rmdir(overflowPath);
        } catch (error) {
          // Overflow directory might not exist
        }
        
        this.logger.info('Event queue cleared successfully');
      } catch (error) {
        this.logger.error('Failed to clear persisted events', error);
      }
    }
    
    // Reset statistics
    this.stats = {
      totalEvents: 0,
      eventsProcessed: 0,
      batchesProcessed: 0,
      errorsEncountered: 0,
      totalProcessingTime: 0,
      overflowCount: 0,
      lastProcessedTime: 0
    };
    
    this.notifyStatusChange();
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down event queue service');
    
    // Stop processing
    this.stopProcessing();
    
    // Persist any remaining events
    if (this.persistenceEnabled && this.queue.size > 0) {
      this.logger.info(`Persisting ${this.queue.size} remaining events before shutdown`);
      // Events are already persisted, so we just need to ensure they're saved
    }
    
    this.logger.info('Event queue service shutdown completed');
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  getEventsByPriority(priority: number): QueuedEvent[] {
    const queue = this.priorityQueues.get(priority) || [];
    return queue.map(eventId => this.queue.get(eventId)).filter((event): event is QueuedEvent => event !== undefined);
  }

  async retryFailedEvents(): Promise<number> {
    if (!this.persistenceEnabled) return 0;
    
    try {
      const overflowPath = path.join(this.persistencePath, 'overflow');
      const files = await fs.readdir(overflowPath);
      const eventFiles = files.filter(f => f.endsWith('.json'));
      
      let retryCount = 0;
      
      for (const file of eventFiles) {
        try {
          const content = await fs.readFile(path.join(overflowPath, file), 'utf-8');
          const event: QueuedEvent = JSON.parse(content);
          
          // Reset retry count
          event.retryCount = 0;
          
          if (await this.enqueueInternal(event, false)) {
            await fs.unlink(path.join(overflowPath, file));
            retryCount++;
          }
        } catch (error) {
          this.logger.error(`Failed to retry event from ${file}`, error);
        }
      }
      
      this.logger.info(`Retried ${retryCount} failed events`);
      return retryCount;
    } catch (error) {
      this.logger.error('Failed to retry failed events', error);
      return 0;
    }
  }
}