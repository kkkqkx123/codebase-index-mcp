import 'reflect-metadata';
import { Container, ContainerModule, interfaces } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { IndexService } from '../services/index/IndexService';
import { GraphService } from '../services/graph/GraphService';
import { ParserService } from '../services/parser/ParserService';
import { QdrantService } from '../database/QdrantService';
import { Neo4jService } from '../database/Neo4jService';
import { OpenAIEmbedder } from '../embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../embedders/GeminiEmbedder';
import { MistralEmbedder } from '../embedders/MistralEmbedder';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { TreeSitterService } from '../services/parser/TreeSitterService';
import { SmartCodeParser } from '../services/parser/SmartCodeParser';
import { FileSystemTraversal } from '../services/filesystem/FileSystemTraversal';
import { HashBasedDeduplicator } from '../services/deduplication/HashBasedDeduplicator';
import { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';
import { Neo4jConnectionManager } from '../database/neo4j/Neo4jConnectionManager';
import { VectorStorageService } from '../services/storage/VectorStorageService';
import { GraphPersistenceService } from '../services/storage/GraphPersistenceService';
import { EntityIdManager } from '../services/sync/EntityIdManager';
import { EntityMappingService } from '../services/sync/EntityMappingService';
import { TransactionCoordinator } from '../services/sync/TransactionCoordinator';
import { ConsistencyChecker } from '../services/sync/ConsistencyChecker';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  IndexService: Symbol.for('IndexService'),
  GraphService: Symbol.for('GraphService'),
  ParserService: Symbol.for('ParserService'),
  QdrantService: Symbol.for('QdrantService'),
  Neo4jService: Symbol.for('Neo4jService'),
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  OpenAIEmbedder: Symbol.for('OpenAIEmbedder'),
  OllamaEmbedder: Symbol.for('OllamaEmbedder'),
  GeminiEmbedder: Symbol.for('GeminiEmbedder'),
  MistralEmbedder: Symbol.for('MistralEmbedder'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  SmartCodeParser: Symbol.for('SmartCodeParser'),
  FileSystemTraversal: Symbol.for('FileSystemTraversal'),
  HashBasedDeduplicator: Symbol.for('HashBasedDeduplicator'),
  QdrantClientWrapper: Symbol.for('QdrantClientWrapper'),
  Neo4jConnectionManager: Symbol.for('Neo4jConnectionManager'),
  VectorStorageService: Symbol.for('VectorStorageService'),
  GraphPersistenceService: Symbol.for('GraphPersistenceService'),
  EntityIdManager: Symbol.for('EntityIdManager'),
  EntityMappingService: Symbol.for('EntityMappingService'),
  TransactionCoordinator: Symbol.for('TransactionCoordinator'),
  ConsistencyChecker: Symbol.for('ConsistencyChecker')
};

const coreModule = new ContainerModule((bind: interfaces.Bind) => {
  bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
});

const databaseModule = new ContainerModule((bind: interfaces.Bind) => {
  bind(TYPES.QdrantService).to(QdrantService).inSingletonScope();
  bind(TYPES.Neo4jService).to(Neo4jService).inSingletonScope();
  bind(TYPES.QdrantClientWrapper).to(QdrantClientWrapper).inSingletonScope();
  bind(TYPES.Neo4jConnectionManager).to(Neo4jConnectionManager).inSingletonScope();
});

const embedderModule = new ContainerModule((bind: interfaces.Bind) => {
  bind(TYPES.OpenAIEmbedder).to(OpenAIEmbedder).inSingletonScope();
  bind(TYPES.OllamaEmbedder).to(OllamaEmbedder).inSingletonScope();
  bind(TYPES.GeminiEmbedder).to(GeminiEmbedder).inSingletonScope();
  bind(TYPES.MistralEmbedder).to(MistralEmbedder).inSingletonScope();
  bind(TYPES.EmbedderFactory).to(EmbedderFactory).inSingletonScope();
});

const serviceModule = new ContainerModule((bind: interfaces.Bind) => {
  bind(TYPES.IndexService).to(IndexService).inSingletonScope();
  bind(TYPES.GraphService).to(GraphService).inSingletonScope();
  bind(TYPES.ParserService).to(ParserService).inSingletonScope();
  bind(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
  bind(TYPES.SmartCodeParser).to(SmartCodeParser).inSingletonScope();
  bind(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
  bind(TYPES.HashBasedDeduplicator).to(HashBasedDeduplicator).inSingletonScope();
  bind(TYPES.VectorStorageService).to(VectorStorageService).inSingletonScope();
  bind(TYPES.GraphPersistenceService).to(GraphPersistenceService).inSingletonScope();
});

const syncModule = new ContainerModule((bind: interfaces.Bind) => {
  bind(TYPES.EntityIdManager).to(EntityIdManager).inSingletonScope();
  bind(TYPES.EntityMappingService).to(EntityMappingService).inSingletonScope();
  bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();
  bind(TYPES.ConsistencyChecker).to(ConsistencyChecker).inSingletonScope();
});

export class DIContainer {
  private static instance: Container;

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container();
      DIContainer.instance.load(coreModule, databaseModule, embedderModule, serviceModule, syncModule);
    }
    return DIContainer.instance;
  }

  static reset(): void {
    DIContainer.instance = null;
  }
}