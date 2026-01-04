import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { FileSearchManager } from './FileSearchManager.js';

// Mock the GoogleGenAI client
const createMockClient = () => ({
  fileSearchStores: {
    create: jest.fn().mockResolvedValue({ name: 'stores/new-store', displayName: 'Test Store' }),
    list: jest.fn().mockResolvedValue([
      { name: 'stores/store1', displayName: 'Store 1' },
      { name: 'stores/store2', displayName: 'Store 2' },
    ]),
    get: jest.fn().mockResolvedValue({ name: 'stores/store1', displayName: 'Store 1' }),
    delete: jest.fn().mockResolvedValue({}),
    documents: {
      list: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'documents/1', displayName: 'doc1.txt' };
          yield { name: 'documents/2', displayName: 'doc2.txt' };
        },
      }),
      get: jest.fn().mockResolvedValue({ name: 'documents/1', displayName: 'doc1.txt' }),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  },
  interactions: {
    create: jest.fn().mockResolvedValue({ response: 'Query result' }),
  },
});

describe('FileSearchManager', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let manager: FileSearchManager;

  beforeEach(() => {
    mockClient = createMockClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager = new FileSearchManager(mockClient as any);
  });

  describe('createStore', () => {
    it('should create a new file search store', async () => {
      const result = await manager.createStore('My Store');

      expect(mockClient.fileSearchStores.create).toHaveBeenCalledWith({
        config: {
          displayName: 'My Store',
        },
      });
      expect(result.name).toBe('stores/new-store');
    });
  });

  describe('listStores', () => {
    it('should list all file search stores', async () => {
      const result = await manager.listStores();

      expect(mockClient.fileSearchStores.list).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('getStore', () => {
    it('should get a file search store by name', async () => {
      const result = await manager.getStore('stores/store1');

      expect(mockClient.fileSearchStores.get).toHaveBeenCalledWith({ name: 'stores/store1' });
      expect(result.name).toBe('stores/store1');
    });
  });

  describe('deleteStore', () => {
    it('should delete a file search store', async () => {
      await manager.deleteStore('stores/store1');

      expect(mockClient.fileSearchStores.delete).toHaveBeenCalledWith({
        name: 'stores/store1',
        config: { force: false },
      });
    });

    it('should force delete when force flag is true', async () => {
      await manager.deleteStore('stores/store1', true);

      expect(mockClient.fileSearchStores.delete).toHaveBeenCalledWith({
        name: 'stores/store1',
        config: { force: true },
      });
    });
  });

  describe('queryStore', () => {
    it('should query a store with default model', async () => {
      await manager.queryStore('stores/store1', 'What is the answer?');

      expect(mockClient.interactions.create).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        input: 'What is the answer?',
        tools: [
          {
            type: 'file_search',
            file_search_store_names: ['stores/store1'],
          },
        ],
      });
    });

    it('should query a store with custom model', async () => {
      await manager.queryStore('stores/store1', 'Query text', 'gemini-2.5-pro');

      expect(mockClient.interactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
        })
      );
    });
  });

  describe('listDocuments', () => {
    it('should list all documents in a store', async () => {
      const result = await manager.listDocuments('stores/store1');

      expect(mockClient.fileSearchStores.documents.list).toHaveBeenCalledWith({
        parent: 'stores/store1',
        config: { pageSize: 20 },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('documents/1');
      expect(result[1].name).toBe('documents/2');
    });

    it('should handle pagination automatically', async () => {
      // Mock multiple pages
      mockClient.fileSearchStores.documents.list.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (let i = 1; i <= 150; i++) {
            yield { name: `documents/${i}`, displayName: `doc${i}.txt` };
          }
        },
      });

      const result = await manager.listDocuments('stores/store1');

      expect(result).toHaveLength(150);
    });
  });

  describe('getDocument', () => {
    it('should get a single document by name', async () => {
      const result = await manager.getDocument('documents/1');

      expect(mockClient.fileSearchStores.documents.get).toHaveBeenCalledWith({ name: 'documents/1' });
      expect(result.name).toBe('documents/1');
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      await manager.deleteDocument('documents/1');

      expect(mockClient.fileSearchStores.documents.delete).toHaveBeenCalledWith({ name: 'documents/1' });
    });
  });
});
