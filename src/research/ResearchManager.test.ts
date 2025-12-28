import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ResearchManager } from './ResearchManager.js';

// Mock the GoogleGenAI client
const createMockClient = () => ({
  interactions: {
    create: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    cancel: jest.fn(),
  },
});

describe('ResearchManager', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let manager: ResearchManager;

  beforeEach(() => {
    mockClient = createMockClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager = new ResearchManager(mockClient as any);
    jest.clearAllMocks();
  });

  describe('startResearch', () => {
    it('should start a background research interaction with default model', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'in_progress' };
      mockClient.interactions.create.mockResolvedValue(mockInteraction);

      const result = await manager.startResearch({
        input: 'Who is Allen Hutchison?',
      });

      expect(mockClient.interactions.create).toHaveBeenCalledWith({
        input: 'Who is Allen Hutchison?',
        agent: 'deep-research-pro-preview-12-2025',
        background: true,
        tools: undefined,
      });
      expect(result).toEqual(mockInteraction);
    });

    it('should start research with custom model', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'in_progress' };
      mockClient.interactions.create.mockResolvedValue(mockInteraction);

      const result = await manager.startResearch({
        input: 'Search query',
        model: 'gemini-2.5-flash',
      });

      expect(mockClient.interactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'gemini-2.5-flash',
        })
      );
      expect(result).toEqual(mockInteraction);
    });

    it('should start research with file search store names', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'in_progress' };
      mockClient.interactions.create.mockResolvedValue(mockInteraction);

      const result = await manager.startResearch({
        input: 'Search my files',
        fileSearchStoreNames: ['store-1', 'store-2'],
      });

      expect(mockClient.interactions.create).toHaveBeenCalledWith({
        input: 'Search my files',
        agent: 'deep-research-pro-preview-12-2025',
        background: true,
        tools: [
          {
            type: 'file_search',
            file_search_store_names: ['store-1', 'store-2'],
          },
        ],
      });
      expect(result).toEqual(mockInteraction);
    });

    it('should allow disabling background mode', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'completed' };
      mockClient.interactions.create.mockResolvedValue(mockInteraction);

      await manager.startResearch({
        input: 'Quick query',
        background: false,
      });

      expect(mockClient.interactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          background: false,
        })
      );
    });
  });

  describe('getStatus', () => {
    it('should get research status', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'completed' };
      mockClient.interactions.get.mockResolvedValue(mockInteraction);

      const result = await manager.getStatus('interaction-123');

      expect(mockClient.interactions.get).toHaveBeenCalledWith('interaction-123');
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('cancel', () => {
    it('should cancel an interaction', async () => {
      const mockInteraction = { id: 'interaction-123', status: 'cancelled' };
      mockClient.interactions.cancel.mockResolvedValue(mockInteraction);

      const result = await manager.cancel('interaction-123');

      expect(mockClient.interactions.cancel).toHaveBeenCalledWith('interaction-123');
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('delete', () => {
    it('should delete an interaction', async () => {
      const mockInteraction = { id: 'interaction-123' };
      mockClient.interactions.delete.mockResolvedValue(mockInteraction);

      const result = await manager.delete('interaction-123');

      expect(mockClient.interactions.delete).toHaveBeenCalledWith('interaction-123');
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('poll', () => {
    it('should poll research status until completion', async () => {
      mockClient.interactions.get
        .mockResolvedValueOnce({ id: 'interaction-123', status: 'in_progress' })
        .mockResolvedValueOnce({
          id: 'interaction-123',
          status: 'completed',
          outputs: [{ type: 'text', text: 'Result' }],
        });

      const result = await manager.poll('interaction-123', 10); // 10ms interval for test

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('completed');
      expect(result.outputs).toEqual([{ type: 'text', text: 'Result' }]);
    });

    it('should poll research status until failure', async () => {
      mockClient.interactions.get
        .mockResolvedValueOnce({ id: 'interaction-123', status: 'in_progress' })
        .mockResolvedValueOnce({
          id: 'interaction-123',
          status: 'failed',
          error: { message: 'Oops' },
        });

      const result = await manager.poll('interaction-123', 10);

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('failed');
    });

    it('should poll research status until cancelled', async () => {
      mockClient.interactions.get
        .mockResolvedValueOnce({ id: 'interaction-123', status: 'in_progress' })
        .mockResolvedValueOnce({ id: 'interaction-123', status: 'cancelled' });

      const result = await manager.poll('interaction-123', 10);

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('cancelled');
    });

    it('should poll research status with default interval', async () => {
      mockClient.interactions.get.mockResolvedValueOnce({
        id: 'interaction-123',
        status: 'completed',
      });

      // Completes immediately in this mock so no actual wait
      const result = await manager.poll('interaction-123');

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('completed');
    });
  });
});
