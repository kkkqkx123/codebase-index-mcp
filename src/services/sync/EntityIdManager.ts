import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../core/ErrorHandlerService';

export interface EntityId {
  id: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'project';
  projectId: string;
  source: 'vector' | 'graph' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityMapping {
  vectorId: string | undefined;
  graphId: string | undefined;
  entityId: string;
  entityType: string;
  projectId: string;
  lastSynced: Date;
  syncStatus: 'synced' | 'vector_only' | 'graph_only' | 'conflict';
}

@injectable()
export class EntityIdManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private entityMappings: Map<string, EntityMapping> = new Map();
  private idCounter: number = 0;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  generateEntityId(type: EntityId['type'], projectId: string): string {
    const timestamp = Date.now();
    const counter = ++this.idCounter;
    return `${type}_${projectId}_${timestamp}_${counter.toString(36)}`;
  }

  createEntityId(type: EntityId['type'], projectId: string, source: EntityId['source']): EntityId {
    const id = this.generateEntityId(type, projectId);
    
    return {
      id,
      type,
      projectId,
      source,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  createMapping(
    entityId: string,
    entityType: string,
    projectId: string,
    vectorId?: string,
    graphId?: string
  ): EntityMapping {
    const mapping: EntityMapping = {
      vectorId,
      graphId,
      entityId,
      entityType,
      projectId,
      lastSynced: new Date(),
      syncStatus: this.determineSyncStatus(vectorId, graphId)
    };

    this.entityMappings.set(entityId, mapping);
    this.logger.debug('Created entity mapping', { entityId, entityType, syncStatus: mapping.syncStatus });
    
    return mapping;
  }

  updateMapping(
    entityId: string,
    updates: {
      vectorId: string | undefined;
      graphId: string | undefined;
      syncStatus?: EntityMapping['syncStatus'];
    }
  ): EntityMapping | null {
    const mapping = this.entityMappings.get(entityId);
    if (!mapping) {
      this.logger.warn('Attempted to update non-existent mapping', { entityId });
      return null;
    }

    const updatedMapping = {
      ...mapping,
      ...updates,
      lastSynced: new Date()
    };

    if (updates.vectorId !== undefined || updates.graphId !== undefined) {
      updatedMapping.syncStatus = this.determineSyncStatus(
        updates.vectorId ?? mapping.vectorId,
        updates.graphId ?? mapping.graphId
      );
    }

    this.entityMappings.set(entityId, updatedMapping);
    this.logger.debug('Updated entity mapping', { entityId, syncStatus: updatedMapping.syncStatus });
    
    return updatedMapping;
  }

  getMapping(entityId: string): EntityMapping | null {
    return this.entityMappings.get(entityId) || null;
  }

  getMappingByVectorId(vectorId: string): EntityMapping | null {
    for (const mapping of this.entityMappings.values()) {
      if (mapping.vectorId === vectorId) {
        return mapping;
      }
    }
    return null;
  }

  getMappingByGraphId(graphId: string): EntityMapping | null {
    for (const mapping of this.entityMappings.values()) {
      if (mapping.graphId === graphId) {
        return mapping;
      }
    }
    return null;
  }

  getMappingsByProject(projectId: string): EntityMapping[] {
    return Array.from(this.entityMappings.values())
      .filter(mapping => mapping.projectId === projectId);
  }

  getMappingsByType(projectId: string, entityType: string): EntityMapping[] {
    return Array.from(this.entityMappings.values())
      .filter(mapping => mapping.projectId === projectId && mapping.entityType === entityType);
  }

  getUnsyncedMappings(projectId?: string): EntityMapping[] {
    return Array.from(this.entityMappings.values())
      .filter(mapping => 
        mapping.syncStatus !== 'synced' &&
        (projectId ? mapping.projectId === projectId : true)
      );
  }

  deleteMapping(entityId: string): boolean {
    return this.entityMappings.delete(entityId);
  }

  clearProjectMappings(projectId: string): number {
    let deletedCount = 0;
    for (const [entityId, mapping] of this.entityMappings.entries()) {
      if (mapping.projectId === projectId) {
        this.entityMappings.delete(entityId);
        deletedCount++;
      }
    }
    this.logger.info('Cleared project mappings', { projectId, deletedCount });
    return deletedCount;
  }

  getSyncStats(projectId?: string): {
    total: number;
    synced: number;
    vectorOnly: number;
    graphOnly: number;
    conflicts: number;
  } {
    const mappings = projectId 
      ? Array.from(this.entityMappings.values()).filter(m => m.projectId === projectId)
      : Array.from(this.entityMappings.values());

    return {
      total: mappings.length,
      synced: mappings.filter(m => m.syncStatus === 'synced').length,
      vectorOnly: mappings.filter(m => m.syncStatus === 'vector_only').length,
      graphOnly: mappings.filter(m => m.syncStatus === 'graph_only').length,
      conflicts: mappings.filter(m => m.syncStatus === 'conflict').length
    };
  }

  exportMappings(): string {
    const data = Array.from(this.entityMappings.entries());
    return JSON.stringify(data, null, 2);
  }

  importMappings(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      this.entityMappings.clear();
      
      for (const [entityId, mapping] of data) {
        this.entityMappings.set(entityId, mapping as EntityMapping);
      }
      
      this.logger.info('Imported entity mappings', { count: this.entityMappings.size });
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new CodebaseIndexError('Failed to import entity mappings', { component: 'EntityIdManager', operation: 'import' }),
        { component: 'EntityIdManager', operation: 'import' }
      );
      return false;
    }
  }

  private determineSyncStatus(vectorId?: string, graphId?: string): EntityMapping['syncStatus'] {
    if (vectorId && graphId) {
      return 'synced';
    } else if (vectorId) {
      return 'vector_only';
    } else if (graphId) {
      return 'graph_only';
    } else {
      return 'conflict';
    }
  }
}