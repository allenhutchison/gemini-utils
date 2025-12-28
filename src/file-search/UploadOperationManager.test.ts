import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryOperationStorage, UploadOperationManager } from './UploadOperationManager.js';
import { OperationStorage, UploadOperation } from './types.js';

describe('InMemoryOperationStorage', () => {
  let storage: InMemoryOperationStorage;

  beforeEach(() => {
    storage = new InMemoryOperationStorage();
  });

  it('should store and retrieve an operation', () => {
    const operation: UploadOperation = {
      id: 'test-id',
      status: 'pending',
      path: '/test/path',
      storeName: 'test-store',
      smartSync: false,
      totalFiles: 10,
      completedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      failedFilesList: [],
      startedAt: new Date().toISOString(),
    };

    storage.set('test-id', operation);
    expect(storage.get('test-id')).toEqual(operation);
  });

  it('should return undefined for non-existent operation', () => {
    expect(storage.get('non-existent')).toBeUndefined();
  });

  it('should return all operations', () => {
    const op1: UploadOperation = {
      id: 'id1',
      status: 'pending',
      path: '/path1',
      storeName: 'store1',
      smartSync: false,
      totalFiles: 5,
      completedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      failedFilesList: [],
      startedAt: new Date().toISOString(),
    };

    const op2: UploadOperation = {
      id: 'id2',
      status: 'completed',
      path: '/path2',
      storeName: 'store2',
      smartSync: true,
      totalFiles: 10,
      completedFiles: 10,
      skippedFiles: 0,
      failedFiles: 0,
      failedFilesList: [],
      startedAt: new Date().toISOString(),
    };

    storage.set('id1', op1);
    storage.set('id2', op2);

    const all = storage.getAll();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['id1']).toEqual(op1);
    expect(all['id2']).toEqual(op2);
  });

  it('should return a shallow copy of the operations map', () => {
    const operation: UploadOperation = {
      id: 'test-id',
      status: 'pending',
      path: '/test/path',
      storeName: 'test-store',
      smartSync: false,
      totalFiles: 10,
      completedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      failedFilesList: [],
      startedAt: new Date().toISOString(),
    };

    storage.set('test-id', operation);
    const all = storage.getAll();

    // Adding a new key to the returned object should not affect the original storage
    all['new-id'] = { ...operation, id: 'new-id' };
    expect(storage.get('new-id')).toBeUndefined();
  });
});

describe('UploadOperationManager', () => {
  let manager: UploadOperationManager;

  beforeEach(() => {
    manager = new UploadOperationManager();
  });

  describe('createOperation', () => {
    it('should create a new operation with pending status', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false, 10);

      expect(operation.id).toBeDefined();
      expect(operation.status).toBe('pending');
      expect(operation.path).toBe('/test/path');
      expect(operation.storeName).toBe('test-store');
      expect(operation.smartSync).toBe(false);
      expect(operation.totalFiles).toBe(10);
      expect(operation.completedFiles).toBe(0);
      expect(operation.skippedFiles).toBe(0);
      expect(operation.failedFiles).toBe(0);
      expect(operation.failedFilesList).toEqual([]);
      expect(operation.startedAt).toBeDefined();
    });

    it('should generate unique IDs for each operation', () => {
      const op1 = manager.createOperation('/path1', 'store1', false);
      const op2 = manager.createOperation('/path2', 'store2', true);

      expect(op1.id).not.toBe(op2.id);
    });

    it('should default totalFiles to 0', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false);
      expect(operation.totalFiles).toBe(0);
    });
  });

  describe('getOperation', () => {
    it('should retrieve an existing operation', () => {
      const created = manager.createOperation('/test/path', 'test-store', false);
      const retrieved = manager.getOperation(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.getOperation('non-existent-id')).toBeUndefined();
    });
  });

  describe('updateOperation', () => {
    it('should update operation with partial updates', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false, 10);
      const updated = manager.updateOperation(operation.id, { completedFiles: 5 });

      expect(updated?.completedFiles).toBe(5);
      expect(updated?.status).toBe('pending'); // Other fields unchanged
    });

    it('should return undefined for non-existent operation', () => {
      const result = manager.updateOperation('non-existent', { completedFiles: 5 });
      expect(result).toBeUndefined();
    });
  });

  describe('listOperations', () => {
    it('should return empty array when no operations exist', () => {
      expect(manager.listOperations()).toEqual([]);
    });

    it('should return all operations', () => {
      manager.createOperation('/path1', 'store1', false);
      manager.createOperation('/path2', 'store2', true);

      const operations = manager.listOperations();
      expect(operations).toHaveLength(2);
    });
  });

  describe('markInProgress', () => {
    it('should update status to in_progress and set totalFiles', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false);
      const updated = manager.markInProgress(operation.id, 15);

      expect(updated?.status).toBe('in_progress');
      expect(updated?.totalFiles).toBe(15);
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.markInProgress('non-existent', 10)).toBeUndefined();
    });
  });

  describe('markCompleted', () => {
    it('should update status to completed and set completedAt', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false);
      manager.markInProgress(operation.id, 10);
      const updated = manager.markCompleted(operation.id);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.markCompleted('non-existent')).toBeUndefined();
    });
  });

  describe('markFailed', () => {
    it('should update status to failed with error message', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false);
      manager.markInProgress(operation.id, 10);
      const updated = manager.markFailed(operation.id, 'Network error');

      expect(updated?.status).toBe('failed');
      expect(updated?.error).toBe('Network error');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.markFailed('non-existent', 'Error')).toBeUndefined();
    });
  });

  describe('updateProgress', () => {
    it('should update progress counters', () => {
      const operation = manager.createOperation('/test/path', 'test-store', true, 10);
      manager.markInProgress(operation.id, 10);
      const updated = manager.updateProgress(operation.id, 5, 2, 1);

      expect(updated?.completedFiles).toBe(5);
      expect(updated?.skippedFiles).toBe(2);
      expect(updated?.failedFiles).toBe(1);
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.updateProgress('non-existent', 1, 0, 0)).toBeUndefined();
    });
  });

  describe('addFailedFile', () => {
    it('should add failed file to the list', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false, 10);
      manager.markInProgress(operation.id, 10);

      const updated = manager.addFailedFile(operation.id, '/test/file.txt', 'Upload failed');

      expect(updated?.failedFiles).toBe(1);
      expect(updated?.failedFilesList).toHaveLength(1);
      expect(updated?.failedFilesList[0]).toEqual({
        file: '/test/file.txt',
        error: 'Upload failed',
      });
    });

    it('should accumulate multiple failed files', () => {
      const operation = manager.createOperation('/test/path', 'test-store', false, 10);
      manager.markInProgress(operation.id, 10);

      manager.addFailedFile(operation.id, '/test/file1.txt', 'Error 1');
      const updated = manager.addFailedFile(operation.id, '/test/file2.txt', 'Error 2');

      expect(updated?.failedFiles).toBe(2);
      expect(updated?.failedFilesList).toHaveLength(2);
    });

    it('should return undefined for non-existent operation', () => {
      expect(manager.addFailedFile('non-existent', '/file.txt', 'Error')).toBeUndefined();
    });
  });

  describe('custom storage', () => {
    it('should use provided custom storage', () => {
      const customStorage: OperationStorage = {
        get: jest.fn(),
        set: jest.fn(),
        getAll: jest.fn().mockReturnValue({}),
      };

      const customManager = new UploadOperationManager(customStorage);
      customManager.createOperation('/test', 'store', false);

      expect(customStorage.set).toHaveBeenCalled();
    });
  });
});
