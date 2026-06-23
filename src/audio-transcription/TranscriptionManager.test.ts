import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TranscriptionManager } from './TranscriptionManager.js';

/** Builds a completed interaction whose model_output contains the given text. */
const interactionWithText = (text: string) => ({
  id: 'interaction-123',
  status: 'completed',
  steps: [
    {
      type: 'model_output',
      content: [{ type: 'text', text }],
    },
  ],
});

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

  describe('transcribe', () => {
    // A small local audio file used to exercise the inline-data path.
    const tmpAudioPath = path.join(os.tmpdir(), 'gemini-utils-transcribe-test.mp3');

    beforeEach(() => {
      fs.writeFileSync(tmpAudioPath, Buffer.from('fake-mp3-bytes'));
    });

    afterAll(() => {
      if (fs.existsSync(tmpAudioPath)) fs.unlinkSync(tmpAudioPath);
    });

    it('transcribes a remote URI via the Interactions API', async () => {
      mockClient.interactions.create.mockResolvedValue(interactionWithText('Hello world'));

      const result = await manager.transcribe({
        audioSource: 'https://example.com/audio.mp3',
        model: 'gemini-3-flash-preview',
      });

      expect(result.text).toBe('Hello world');
      expect(result.model).toBe('gemini-3-flash-preview');
      expect(mockClient.interactions.create).toHaveBeenCalledTimes(1);

      const params = mockClient.interactions.create.mock.calls[0][0] as Record<string, unknown>;
      expect(params.model).toBe('gemini-3-flash-preview');
      const input = params.input as Array<Record<string, unknown>>;
      expect(input[0]).toEqual({
        type: 'audio',
        uri: 'https://example.com/audio.mp3',
        mime_type: 'audio/mpeg',
      });
      expect(input[1]).toMatchObject({ type: 'text' });
      expect(typeof input[1].text).toBe('string');
    });

    it('transcribes a small local file using inline base64 data', async () => {
      mockClient.interactions.create.mockResolvedValue(interactionWithText('Local transcript'));

      const result = await manager.transcribe({ audioSource: tmpAudioPath });

      expect(result.text).toBe('Local transcript');

      const params = mockClient.interactions.create.mock.calls[0][0] as Record<string, unknown>;
      const input = params.input as Array<Record<string, unknown>>;
      const expectedData = Buffer.from('fake-mp3-bytes').toString('base64');
      expect(input[0]).toEqual({
        type: 'audio',
        data: expectedData,
        mime_type: 'audio/mpeg',
      });
      // Inline path must not upload via the File API.
      expect(mockClient.files.upload).not.toHaveBeenCalled();
      expect(result.metadata?.uploadedViaFileApi).toBe(false);
    });

    it('maps audio/mp4 (.m4a) to the Interactions audio/m4a MIME type', async () => {
      mockClient.interactions.create.mockResolvedValue(interactionWithText('m4a transcript'));

      await manager.transcribe({ audioSource: 'https://example.com/audio.m4a' });

      const params = mockClient.interactions.create.mock.calls[0][0] as Record<string, unknown>;
      const input = params.input as Array<Record<string, unknown>>;
      expect(input[0].mime_type).toBe('audio/m4a');
    });

    it('parses JSON timestamped output from the interaction', async () => {
      const json = JSON.stringify({
        text: 'Full transcript',
        duration: 12.5,
        segments: [{ startTime: 0, endTime: 5, text: 'Full' }],
      });
      mockClient.interactions.create.mockResolvedValue(interactionWithText('```json\n' + json + '\n```'));

      const result = await manager.transcribe({
        audioSource: 'https://example.com/audio.mp3',
        timestamps: true,
      });

      expect(result.text).toBe('Full transcript');
      expect(result.duration).toBe(12.5);
      expect(result.segments).toHaveLength(1);
    });

    it('throws when the interaction returns no text', async () => {
      mockClient.interactions.create.mockResolvedValue({
        id: 'interaction-123',
        status: 'completed',
        steps: [],
      });

      await expect(
        manager.transcribe({ audioSource: 'https://example.com/audio.mp3' })
      ).rejects.toThrow('no text in response');
    });
  });

  describe('getStatus', () => {
    it('should get transcription status', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'text', text: 'Transcribed text' }],
          },
        ],
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
