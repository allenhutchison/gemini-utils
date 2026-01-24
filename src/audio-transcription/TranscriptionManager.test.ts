import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TranscriptionManager } from './TranscriptionManager.js';

// Mock the GoogleGenAI client
const createMockClient = () => ({
  interactions: {
    create: jest.fn(),
    get: jest.fn(),
  },
  files: {
    upload: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  },
});

describe('TranscriptionManager', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let manager: TranscriptionManager;

  beforeEach(() => {
    mockClient = createMockClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager = new TranscriptionManager(mockClient as any);
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should get transcription status', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        status: 'completed',
        outputs: [{ type: 'text', text: 'Transcribed text' }],
      };
      mockClient.interactions.get.mockResolvedValue(mockInteraction);

      const result = await manager.getStatus('interaction-123');

      expect(mockClient.interactions.get).toHaveBeenCalledWith('interaction-123');
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('listAudioFiles', () => {
    it('should list only audio files', async () => {
      const mockFiles = [
        { name: 'file1', uri: 'uri1', mimeType: 'audio/mpeg', displayName: 'test1.mp3' },
        { name: 'file2', uri: 'uri2', mimeType: 'application/pdf', displayName: 'doc.pdf' },
        { name: 'file3', uri: 'uri3', mimeType: 'audio/wav', displayName: 'test2.wav' },
      ];

      // Create an async iterable
      const asyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          for (const file of mockFiles) {
            yield file;
          }
        },
      };
      mockClient.files.list.mockResolvedValue(asyncIterable);

      const result = await manager.listAudioFiles();

      expect(result).toHaveLength(2);
      expect(result[0].mimeType).toBe('audio/mpeg');
      expect(result[1].mimeType).toBe('audio/wav');
    });

    it('should return empty array when no audio files', async () => {
      const mockFiles = [
        { name: 'file1', uri: 'uri1', mimeType: 'application/pdf', displayName: 'doc.pdf' },
      ];

      const asyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          for (const file of mockFiles) {
            yield file;
          }
        },
      };
      mockClient.files.list.mockResolvedValue(asyncIterable);

      const result = await manager.listAudioFiles();

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteAudioFile', () => {
    it('should delete audio file by name', async () => {
      mockClient.files.delete.mockResolvedValue({});

      await manager.deleteAudioFile('files/123');

      expect(mockClient.files.delete).toHaveBeenCalledWith({ name: 'files/123' });
    });
  });

  describe('poll', () => {
    it('should poll until completion', async () => {
      mockClient.interactions.get
        .mockResolvedValueOnce({ id: 'interaction-123', status: 'in_progress' })
        .mockResolvedValueOnce({
          id: 'interaction-123',
          status: 'completed',
          outputs: [{ type: 'text', text: 'Result' }],
        });

      const result = await manager.poll('interaction-123', 10);

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('completed');
    });

    it('should return on failed status', async () => {
      mockClient.interactions.get.mockResolvedValue({
        id: 'interaction-123',
        status: 'failed',
        error: { message: 'Error' },
      });

      const result = await manager.poll('interaction-123', 10);

      expect(result.status).toBe('failed');
    });

    it('should return on cancelled status', async () => {
      mockClient.interactions.get.mockResolvedValue({
        id: 'interaction-123',
        status: 'cancelled',
      });

      const result = await manager.poll('interaction-123', 10);

      expect(result.status).toBe('cancelled');
    });

    it('should poll with default interval', async () => {
      mockClient.interactions.get.mockResolvedValueOnce({
        id: 'interaction-123',
        status: 'completed',
      });

      // Completes immediately in this mock
      const result = await manager.poll('interaction-123');

      expect(mockClient.interactions.get).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('completed');
    });
  });
});
