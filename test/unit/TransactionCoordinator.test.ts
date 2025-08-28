import { TransactionCoordinator } from '../../src/services/sync/TransactionCoordinator';
import { EntityMappingService } from '../../src/services/sync/EntityMappingService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { CodebaseIndexError } from '../../src/core/ErrorHandlerService';
import { createTestContainer, createMockTransaction, createMockSyncOperation } from '../setup';

// Mock dependencies
jest.mock('../../src/core/LoggerService');
jest.mock('../../src/core/ErrorHandlerService');
jest.mock('../../src/services/sync/EntityMappingService');

describe('TransactionCoordinator', () => {
  let transactionCoordinator: TransactionCoordinator;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEntityMappingService: jest.Mocked<EntityMappingService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockEntityMappingService = {
      createEntity: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn(),
      syncEntity: jest.fn(),
      syncProject: jest.fn(),
      createBatch: jest.fn(),
      executeBatch: jest.fn(),
    } as any;

    // Create TransactionCoordinator instance
    transactionCoordinator = new TransactionCoordinator(
      mockLoggerService,
      mockErrorHandlerService,
      mockEntityMappingService
    );
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      const projectId = 'test_project';
      const operations = [
        {
          type: 'vector' as const,
          operation: { type: 'storeChunks', chunks: [{ id: 'chunk1' }] },
          compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] },
        },
        {
          type: 'graph' as const,
          operation: { type: 'storeChunks', chunks: [{ id: 'node1' }] },
          compensatingOperation: { type: 'deleteNodes', nodeIds: ['node1'] },
        },
      ];

      const result = await transactionCoordinator.executeTransaction(projectId, operations);

      expect(result).toEqual({
        transactionId: expect.any(String),
        success: true,
        executedSteps: 2,
        duration: expect.any(Number),
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting transaction', {
        transactionId: expect.any(String),
        stepCount: 2,
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Transaction completed successfully', {
        transactionId: expect.any(String),
        duration: expect.any(Number),
      });
    });

    it('should handle transaction failure and execute compensating operations', async () => {
      const projectId = 'test_project';
      const operations = [
        {
          type: 'vector' as const,
          operation: { type: 'storeChunks', chunks: [{ id: 'chunk1' }] },
          compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] },
        },
        {
          type: 'graph' as const,
          operation: { type: 'storeChunks', chunks: [{ id: 'node1' }] },
          compensatingOperation: { type: 'deleteNodes', nodeIds: ['node1'] },
        },
      ];

      // Make the second operation fail
      jest.spyOn(transactionCoordinator as any, 'executeStep')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Operation failed'));

      const result = await transactionCoordinator.executeTransaction(projectId, operations);

      expect(result).toEqual({
        transactionId: expect.any(String),
        success: false,
        executedSteps: 1,
        error: 'Operation failed',
        duration: expect.any(Number),
      });

      expect(mockLoggerService.error).toHaveBeenCalledWith('Transaction failed, starting compensation', {
        transactionId: expect.any(String),
        error: 'Operation failed',
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting transaction compensation', {
        transactionId: expect.any(String),
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Transaction compensation completed', {
        transactionId: expect.any(String),
      });
    });

    it('should handle transaction with no operations', async () => {
      const projectId = 'test_project';
      const operations: any[] = [];

      const result = await transactionCoordinator.executeTransaction(projectId, operations);

      expect(result).toEqual({
        transactionId: expect.any(String),
        success: true,
        executedSteps: 0,
        duration: expect.any(Number),
      });
    });

    it('should handle transaction with unknown step type', async () => {
      const projectId = 'test_project';
      const operations = [
        {
          type: 'unknown' as any,
          operation: { type: 'test' },
        },
      ];

      await expect(transactionCoordinator.executeTransaction(projectId, operations))
        .rejects.toThrow(CodebaseIndexError);
    });
  });

  describe('executeStep', () => {
    it('should execute vector operation', async () => {
      const transaction = createMockTransaction();
      const step = {
        id: 'step_1',
        type: 'vector' as const,
        operation: { type: 'storeChunks', chunks: [{ id: 'chunk1' }] },
        executed: false,
        compensated: false,
      };

      await (transactionCoordinator as any).executeStep(transaction, step);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing transaction step', {
        transactionId: transaction.id,
        stepId: step.id,
        type: step.type,
      });

      expect(step.executed).toBe(true);
    });

    it('should execute graph operation', async () => {
      const transaction = createMockTransaction();
      const step = {
        id: 'step_1',
        type: 'graph' as const,
        operation: { type: 'storeChunks', chunks: [{ id: 'node1' }] },
        executed: false,
        compensated: false,
      };

      await (transactionCoordinator as any).executeStep(transaction, step);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing transaction step', {
        transactionId: transaction.id,
        stepId: step.id,
        type: step.type,
      });

      expect(step.executed).toBe(true);
    });

    it('should execute mapping operation', async () => {
      const transaction = createMockTransaction();
      const step = {
        id: 'step_1',
        type: 'mapping' as const,
        operation: { type: 'updateMapping' },
        executed: false,
        compensated: false,
      };

      await (transactionCoordinator as any).executeStep(transaction, step);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing transaction step', {
        transactionId: transaction.id,
        stepId: step.id,
        type: step.type,
      });

      expect(step.executed).toBe(true);
    });

    it('should handle step execution failure', async () => {
      const transaction = createMockTransaction();
      const step = {
        id: 'step_1',
        type: 'vector' as const,
        operation: { type: 'storeChunks', chunks: [{ id: 'chunk1' }] },
        executed: false,
        compensated: false,
      };

      // Make the operation fail
      jest.spyOn(transactionCoordinator as any, 'executeVectorOperation')
        .mockRejectedValueOnce(new Error('Vector operation failed'));

      await expect((transactionCoordinator as any).executeStep(transaction, step))
        .rejects.toThrow('Vector operation failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Step execution failed', {
        transactionId: transaction.id,
        stepId: step.id,
        error: 'Vector operation failed',
      });

      expect(step.executed).toBe(false);
    });
  });

  describe('compensateTransaction', () => {
    it('should execute compensating operations in reverse order', async () => {
      const transaction = createMockTransaction({
        steps: [
          {
            id: 'step_1',
            type: 'vector' as const,
            operation: { type: 'storeChunks' },
            compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] },
            executed: true,
            compensated: false,
          },
          {
            id: 'step_2',
            type: 'graph' as const,
            operation: { type: 'storeChunks' },
            compensatingOperation: { type: 'deleteNodes', nodeIds: ['node1'] },
            executed: true,
            compensated: false,
          },
        ],
      });

      await (transactionCoordinator as any).compensateTransaction(transaction);

      expect(transaction.status).toBe('compensating');

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting transaction compensation', {
        transactionId: transaction.id,
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Transaction compensation completed', {
        transactionId: transaction.id,
      });

      // Check that compensating operations were executed in reverse order
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', {
        transactionId: transaction.id,
        stepId: 'step_2',
      });

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', {
        transactionId: transaction.id,
        stepId: 'step_1',
      });

      expect((transaction.steps[1] as any).compensated).toBe(true);
      expect((transaction.steps[0] as any).compensated).toBe(true);
    });

    it('should skip compensating operations for unexecuted steps', async () => {
      const transaction = createMockTransaction({
        steps: [
          {
            id: 'step_1',
            type: 'vector' as const,
            operation: { type: 'storeChunks' },
            compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] },
            executed: false, // Not executed
            compensated: false,
          },
          {
            id: 'step_2',
            type: 'graph' as const,
            operation: { type: 'storeChunks' },
            compensatingOperation: { type: 'deleteNodes', nodeIds: ['node1'] },
            executed: true,
            compensated: false,
          },
        ],
      });

      await (transactionCoordinator as any).compensateTransaction(transaction);

      // Only step_2 should be compensated
      expect((transaction.steps[1] as any)).toBe(false);
      expect((transaction.steps[0] as any).compensated).toBe(true);
    });

    it('should handle compensating operation failures gracefully', async () => {
      const transaction = createMockTransaction({
        steps: [
          {
            id: 'step_1',
            type: 'vector' as const,
            operation: { type: 'storeChunks' },
            compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] },
            executed: true,
            compensated: false,
          },
        ],
      });

      // Make the compensating operation fail
      jest.spyOn(transactionCoordinator as any, 'executeCompensatingOperation')
        .mockRejectedValueOnce(new Error('Compensation failed'));

      await (transactionCoordinator as any).compensateTransaction(transaction);

      expect(mockLoggerService.error).toHaveBeenCalledWith('Compensating operation failed', {
        transactionId: transaction.id,
        stepId: 'step_1',
        error: 'Compensation failed',
      });

      // Transaction should still complete compensation despite the error
      expect(mockLoggerService.info).toHaveBeenCalledWith('Transaction compensation completed', {
        transactionId: transaction.id,
      });
    });
  });

  describe('executeVectorOperation', () => {
    it('should execute storeChunks operation', async () => {
      const operation = {
        type: 'storeChunks',
        chunks: [{ id: 'chunk1' }, { id: 'chunk2' }],
        options: { projectId: 'test_project' },
      };

      await (transactionCoordinator as any).executeVectorOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing vector operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Storing chunks in vector database', {
        chunkCount: 2,
        projectId: 'test_project',
      });
    });

    it('should execute deleteChunks operation', async () => {
      const operation = {
        type: 'deleteChunks',
        chunkIds: ['chunk1', 'chunk2'],
      };

      await (transactionCoordinator as any).executeVectorOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing vector operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Deleting chunks from vector database', {
        chunkCount: 2,
      });
    });

    it('should handle unknown vector operation type', async () => {
      const operation = {
        type: 'unknown',
      };

      await (transactionCoordinator as any).executeVectorOperation(operation);

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Unknown vector operation type', {
        type: 'unknown',
      });
    });

    it('should handle vector operation failure', async () => {
      const operation = {
        type: 'storeChunks',
        chunks: [{ id: 'chunk1' }],
      };

      // Make the operation fail
      jest.spyOn(transactionCoordinator as any, 'executeVectorOperation')
        .mockImplementationOnce(async (op: any) => {
          throw new Error('Vector operation failed');
        });

      await expect((transactionCoordinator as any).executeVectorOperation(operation))
        .rejects.toThrow('Vector operation failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to execute vector operation', {
        operation,
        error: 'Vector operation failed',
      });
    });
  });

  describe('executeGraphOperation', () => {
    it('should execute storeChunks operation', async () => {
      const operation = {
        type: 'storeChunks',
        chunks: [{ id: 'node1' }, { id: 'node2' }],
        options: { projectId: 'test_project' },
      };

      await (transactionCoordinator as any).executeGraphOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing graph operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Storing chunks in graph database', {
        chunkCount: 2,
        projectId: 'test_project',
      });
    });

    it('should execute deleteNodes operation', async () => {
      const operation = {
        type: 'deleteNodes',
        nodeIds: ['node1', 'node2'],
      };

      await (transactionCoordinator as any).executeGraphOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing graph operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Deleting nodes from graph database', {
        nodeCount: 2,
      });
    });

    it('should handle unknown graph operation type', async () => {
      const operation = {
        type: 'unknown',
      };

      await (transactionCoordinator as any).executeGraphOperation(operation);

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Unknown graph operation type', {
        type: 'unknown',
      });
    });

    it('should handle graph operation failure', async () => {
      const operation = {
        type: 'storeChunks',
        chunks: [{ id: 'node1' }],
      };

      // Make the operation fail
      jest.spyOn(transactionCoordinator as any, 'executeGraphOperation')
        .mockImplementationOnce(async (op: any) => {
          throw new Error('Graph operation failed');
        });

      await expect((transactionCoordinator as any).executeGraphOperation(operation))
        .rejects.toThrow('Graph operation failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to execute graph operation', {
        operation,
        error: 'Graph operation failed',
      });
    });
  });

  describe('executeCompensatingOperation', () => {
    it('should execute deleteChunks compensating operation', async () => {
      const operation = {
        type: 'deleteChunks',
        chunkIds: ['chunk1', 'chunk2'],
      };

      await (transactionCoordinator as any).executeCompensatingOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Compensating: Deleting chunks from vector database', {
        chunkCount: 2,
      });
    });

    it('should execute restoreChunks compensating operation', async () => {
      const operation = {
        type: 'restoreChunks',
        chunkIds: ['chunk1', 'chunk2'],
      };

      await (transactionCoordinator as any).executeCompensatingOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Compensating: Restoring chunks to vector database', {
        chunkCount: 2,
      });
    });

    it('should execute deleteNodes compensating operation', async () => {
      const operation = {
        type: 'deleteNodes',
        nodeIds: ['node1', 'node2'],
      };

      await (transactionCoordinator as any).executeCompensatingOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Compensating: Deleting nodes from graph database', {
        nodeCount: 2,
      });
    });

    it('should execute restoreNodes compensating operation', async () => {
      const operation = {
        type: 'restoreNodes',
        nodeIds: ['node1', 'node2'],
      };

      await (transactionCoordinator as any).executeCompensatingOperation(operation);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Executing compensating operation', operation);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Compensating: Restoring nodes to graph database', {
        nodeCount: 2,
      });
    });

    it('should handle unknown compensating operation type', async () => {
      const operation = {
        type: 'unknown',
      };

      await (transactionCoordinator as any).executeCompensatingOperation(operation);

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Unknown compensating operation type', {
        type: 'unknown',
      });
    });

    it('should handle compensating operation failure', async () => {
      const operation = {
        type: 'deleteChunks',
        chunkIds: ['chunk1'],
      };

      // Make the operation fail
      jest.spyOn(transactionCoordinator as any, 'executeCompensatingOperation')
        .mockImplementationOnce(async (op: any) => {
          throw new Error('Compensating operation failed');
        });

      await expect((transactionCoordinator as any).executeCompensatingOperation(operation))
        .rejects.toThrow('Compensating operation failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to execute compensating operation', {
        operation,
        error: 'Compensating operation failed',
      });
    });
  });

  describe('getTransaction', () => {
    it('should return active transaction', async () => {
      const transaction = createMockTransaction();
      (transactionCoordinator as any).activeTransactions.set(transaction.id, transaction);

      const result = await transactionCoordinator.getTransaction(transaction.id);

      expect(result).toEqual(transaction);
    });

    it('should return null for non-existent transaction', async () => {
      const result = await transactionCoordinator.getTransaction('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveTransactions', () => {
    it('should return all active transactions', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx_1' }),
        createMockTransaction({ id: 'tx_2' }),
      ];

      transactions.forEach(tx => {
        (transactionCoordinator as any).activeTransactions.set(tx.id, tx);
      });

      const result = await transactionCoordinator.getActiveTransactions();

      expect(result).toEqual(transactions);
    });

    it('should return empty array when no active transactions', async () => {
      const result = await transactionCoordinator.getActiveTransactions();

      expect(result).toEqual([]);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history with default limit', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx_1' }),
        createMockTransaction({ id: 'tx_2' }),
      ];

      (transactionCoordinator as any).transactionHistory = transactions;

      const result = await transactionCoordinator.getTransactionHistory();

      expect(result).toEqual(transactions);
    });

    it('should respect the limit parameter', async () => {
      const transactions = [
        createMockTransaction({ id: 'tx_1' }),
        createMockTransaction({ id: 'tx_2' }),
        createMockTransaction({ id: 'tx_3' }),
      ];

      (transactionCoordinator as any).transactionHistory = transactions;

      const result = await transactionCoordinator.getTransactionHistory(2);

      expect(result).toEqual(transactions.slice(-2));
    });

    it('should handle empty transaction history', async () => {
      (transactionCoordinator as any).transactionHistory = [];

      const result = await transactionCoordinator.getTransactionHistory();

      expect(result).toEqual([]);
    });
  });

  describe('cancelTransaction', () => {
    it('should cancel executing transaction', async () => {
      const transaction = createMockTransaction({
        status: 'executing' as const,
      });

      (transactionCoordinator as any).activeTransactions.set(transaction.id, transaction);

      const result = await transactionCoordinator.cancelTransaction(transaction.id);

      expect(result).toBe(true);

      expect(transaction.status).toBe('failed');
      expect(transaction.error).toBe('Cancelled by user');
      expect(transaction.completedAt).toBeDefined();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Transaction cancelled', {
        transactionId: transaction.id,
      });

      expect((transactionCoordinator as any).activeTransactions.has(transaction.id)).toBe(false);
    });

    it('should cancel pending transaction', async () => {
      const transaction = createMockTransaction({
        status: 'pending' as const,
      });

      (transactionCoordinator as any).activeTransactions.set(transaction.id, transaction);

      const result = await transactionCoordinator.cancelTransaction(transaction.id);

      expect(result).toBe(true);

      expect(transaction.status).toBe('failed');
      expect(transaction.error).toBe('Cancelled by user');
    });

    it('should return false for non-existent transaction', async () => {
      const result = await transactionCoordinator.cancelTransaction('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('beginTransaction', () => {
    it('should begin new transaction', async () => {
      const transactionId = await transactionCoordinator.beginTransaction();

      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);

      const currentTransaction = (transactionCoordinator as any).currentTransaction;
      expect(currentTransaction).toBeDefined();
      expect(currentTransaction.id).toBe(transactionId);
      expect(currentTransaction.status).toBe('pending');

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Transaction began', {
        transactionId,
      });
    });

    it('should throw error when transaction already in progress', async () => {
      // Start first transaction
      await transactionCoordinator.beginTransaction();

      // Try to start second transaction
      await expect(transactionCoordinator.beginTransaction())
        .rejects.toThrow('A transaction is already in progress');
    });
  });

  describe('commitTransaction', () => {
    it('should commit transaction with no steps', async () => {
      const transactionId = await transactionCoordinator.beginTransaction();

      const result = await transactionCoordinator.commitTransaction();

      expect(result).toBe(true);

      expect((transactionCoordinator as any).currentTransaction).toBeNull();
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Transaction committed', {
        transactionId,
      });
    });

    it('should commit transaction with steps', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      // Add steps to the transaction
      (transactionCoordinator as any).currentTransaction.steps = [
        {
          id: 'step_1',
          type: 'vector' as const,
          operation: { type: 'storeChunks' },
          executed: false,
          compensated: false,
        },
      ];

      const result = await transactionCoordinator.commitTransaction();

      expect(result).toBe(true);

      expect((transactionCoordinator as any).currentTransaction).toBeNull();
    });

    it('should rollback on commit failure', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      // Add steps to the transaction
      (transactionCoordinator as any).currentTransaction.steps = [
        {
          id: 'step_1',
          type: 'vector' as const,
          operation: { type: 'storeChunks' },
          executed: false,
          compensated: false,
        },
      ];

      // Make execution fail
      jest.spyOn(transactionCoordinator as any, 'executeTransactionSteps')
        .mockResolvedValueOnce({
          success: false,
          error: 'Execution failed',
        });

      const result = await transactionCoordinator.commitTransaction();

      expect(result).toBe(false);

      expect((transactionCoordinator as any).currentTransaction).toBeNull();
    });

    it('should throw error when no active transaction', async () => {
      await expect(transactionCoordinator.commitTransaction())
        .rejects.toThrow('No active transaction to commit');
    });
  });

  describe('rollbackTransaction', () => {
    it('should rollback active transaction', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      // Add steps to the transaction
      (transactionCoordinator as any).currentTransaction.steps = [
        {
          id: 'step_1',
          type: 'vector' as const,
          operation: { type: 'storeChunks' },
          executed: true,
          compensated: false,
        },
      ];

      const result = await transactionCoordinator.rollbackTransaction();

      expect(result).toBe(true);

      expect((transactionCoordinator as any).currentTransaction).toBeNull();
      // expect(mockLoggerService.debug).toHaveBeenCalledWith('Transaction rolled back', {
      //   transactionId,
      // });
    });

    it('should handle rollback failure', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      // Make compensation fail
      jest.spyOn(transactionCoordinator as any, 'compensateTransaction')
        .mockRejectedValueOnce(new Error('Compensation failed'));

      const result = await transactionCoordinator.rollbackTransaction();

      expect(result).toBe(false);

      expect((transactionCoordinator as any).currentTransaction).toBeNull();
    });
  });

  describe('addVectorOperation', () => {
    it('should add vector operation to current transaction', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      const operation = { type: 'storeChunks' };
      const compensatingOperation = { type: 'deleteChunks' };

      await transactionCoordinator.addVectorOperation(operation, compensatingOperation);

      const currentTransaction = (transactionCoordinator as any).currentTransaction;
      expect(currentTransaction.steps).toHaveLength(1);
      expect(currentTransaction.steps[0]).toEqual({
        id: 'step_0',
        type: 'vector',
        operation,
        compensatingOperation,
        executed: false,
        compensated: false,
      });
    });

  describe('addGraphOperation', () => {
    it('should add graph operation to current transaction', async () => {
      // const transactionId = await transactionCoordinator.beginTransaction();

      const operation = { type: 'storeChunks' };
      const compensatingOperation = { type: 'deleteNodes' };

      await transactionCoordinator.addGraphOperation(operation, compensatingOperation);

      const currentTransaction = (transactionCoordinator as any).currentTransaction;
      expect(currentTransaction.steps).toHaveLength(1);
      expect(currentTransaction.steps[0]).toEqual({
        id: 'step_0',
        type: 'graph',
        operation,
        compensatingOperation,
        executed: false,
        compensated: false,
      });
    });

    it('should throw error when no active transaction', async () => {
      await expect(transactionCoordinator.addGraphOperation({ type: 'storeChunks' }))
        .rejects.toThrow('No active transaction');
    });
  });

  describe('getStats', () => {
    it('should return correct stats with no transactions', () => {
      const stats = transactionCoordinator.getStats();

      expect(stats).toEqual({
        activeTransactions: 0,
        recentSuccessRate: 0,
        averageTransactionTime: 0,
      });
    });

    it('should return correct stats with transactions', () => {
      const now = Date.now();
      const transactions = [
        createMockTransaction({
          id: 'tx_1',
          status: 'completed' as const,
          createdAt: new Date(now - 1000),
          completedAt: new Date(now),
        }),
        createMockTransaction({
          id: 'tx_2',
          status: 'failed' as const,
          createdAt: new Date(now - 2000),
          completedAt: new Date(now - 1000),
        }),
        createMockTransaction({
          id: 'tx_3',
          status: 'completed' as const,
          createdAt: new Date(now - 3000),
          completedAt: new Date(now - 2000),
        }),
      ];

      (transactionCoordinator as any).transactionHistory = transactions;

      const stats = transactionCoordinator.getStats();

      expect(stats).toEqual({
        activeTransactions: 0,
        recentSuccessRate: (2 / 3) * 100, // 2 out of 3 transactions succeeded
        averageTransactionTime: 1000, // Average of 1000ms, 1000ms, and 1000ms
      });
    });
  });
});
});