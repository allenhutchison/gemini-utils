import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileUploader } from './FileUploader.js';
import { FileContent, FileSystemAdapter } from './FileSystemAdapter.js';
import { FileSizeExceededError, UnsupportedFileTypeError, FileUploadError } from './mimeTypes.js';

// Mock the GoogleGenAI client
const createMockClient = () => ({
  fileSearchStores: {
    uploadToFileSearchStore: jest.fn().mockResolvedValue({ name: 'documents/123' }),
    documents: {
      list: jest.fn().mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield { name: 'documents/1', customMetadata: [{ key: 'path', stringValue: 'file1.txt' }, { key: 'hash', stringValue: 'hash1' }] };
        },
      }),
    },
  },
});

describe('FileUploader', () => {
  let tempDir: string;
  let mockClient: ReturnType<typeof createMockClient>;
  let uploader: FileUploader;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-uploader-test-'));
    mockClient = createMockClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploader = new FileUploader(mockClient as any);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getFileHash', () => {
    it('should compute SHA-256 hash of file', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');

      const hash = uploader.getFileHash(filePath);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return same hash for same content', () => {
      const filePath1 = path.join(tempDir, 'test1.txt');
      const filePath2 = path.join(tempDir, 'test2.txt');
      fs.writeFileSync(filePath1, 'identical content');
      fs.writeFileSync(filePath2, 'identical content');

      expect(uploader.getFileHash(filePath1)).toBe(uploader.getFileHash(filePath2));
    });

    it('should return different hash for different content', () => {
      const filePath1 = path.join(tempDir, 'test1.txt');
      const filePath2 = path.join(tempDir, 'test2.txt');
      fs.writeFileSync(filePath1, 'content 1');
      fs.writeFileSync(filePath2, 'content 2');

      expect(uploader.getFileHash(filePath1)).not.toBe(uploader.getFileHash(filePath2));
    });
  });

  describe('uploadContent', () => {
    it('should upload file content to store', async () => {
      const content: FileContent = {
        data: Buffer.from('test content'),
        mimeType: 'text/plain',
        displayName: 'test.txt',
        relativePath: 'test.txt',
        hash: 'abc123',
        lastModified: new Date().toISOString(),
      };

      await uploader.uploadContent(content, 'stores/test-store');

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalledWith(
        expect.objectContaining({
          fileSearchStoreName: 'stores/test-store',
          config: expect.objectContaining({
            displayName: 'test.txt',
            mimeType: 'text/plain',
          }),
        })
      );
    });

    it('should throw FileSizeExceededError for oversized files', async () => {
      const content: FileContent = {
        data: Buffer.alloc(101 * 1024 * 1024), // 101 MB
        mimeType: 'text/plain',
        displayName: 'large.txt',
        relativePath: 'large.txt',
        hash: 'abc123',
        lastModified: new Date().toISOString(),
      };

      await expect(uploader.uploadContent(content, 'stores/test-store')).rejects.toThrow(FileSizeExceededError);
    });

    it('should call onProgress callback with file_start event', async () => {
      const content: FileContent = {
        data: Buffer.from('test'),
        mimeType: 'text/plain',
        displayName: 'test.txt',
        relativePath: 'test.txt',
        hash: 'abc123',
        lastModified: new Date().toISOString(),
      };

      const onProgress = jest.fn();
      await uploader.uploadContent(content, 'stores/test-store', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_start',
          currentFile: 'test.txt',
        })
      );
    });

    it('should call onProgress callback with file_complete event', async () => {
      const content: FileContent = {
        data: Buffer.from('test'),
        mimeType: 'text/plain',
        displayName: 'test.txt',
        relativePath: 'test.txt',
        hash: 'abc123',
        lastModified: new Date().toISOString(),
      };

      const onProgress = jest.fn();
      await uploader.uploadContent(content, 'stores/test-store', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_complete',
          currentFile: 'test.txt',
        })
      );
    });

    it('should throw FileUploadError on API failure', async () => {
      mockClient.fileSearchStores.uploadToFileSearchStore.mockRejectedValue(new Error('API Error'));

      const content: FileContent = {
        data: Buffer.from('test'),
        mimeType: 'text/plain',
        displayName: 'test.txt',
        relativePath: 'test.txt',
        hash: 'abc123',
        lastModified: new Date().toISOString(),
      };

      await expect(uploader.uploadContent(content, 'stores/test-store')).rejects.toThrow(FileUploadError);
    });
  });

  describe('uploadFile', () => {
    it('should upload a single file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');

      await uploader.uploadFile(filePath, 'stores/test-store');

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalled();
    });

    it('should throw UnsupportedFileTypeError for unsupported extensions', async () => {
      const filePath = path.join(tempDir, 'test.xyz');
      fs.writeFileSync(filePath, 'content');

      await expect(uploader.uploadFile(filePath, 'stores/test-store')).rejects.toThrow(UnsupportedFileTypeError);
    });

    it('should throw FileSizeExceededError for oversized files', async () => {
      const filePath = path.join(tempDir, 'large.txt');
      // Create a file larger than 100MB using a sparse file
      const fd = fs.openSync(filePath, 'w');
      fs.writeSync(fd, 'x', 101 * 1024 * 1024 - 1);
      fs.closeSync(fd);

      await expect(uploader.uploadFile(filePath, 'stores/test-store')).rejects.toThrow(FileSizeExceededError);
    });

    it('should use provided relativePath in config', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'content');

      await uploader.uploadFile(filePath, 'stores/test-store', {
        relativePath: 'custom/path/test.txt',
      });

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            customMetadata: expect.arrayContaining([
              { key: 'path', stringValue: 'custom/path/test.txt' },
            ]),
          }),
        })
      );
    });
  });

  describe('uploadDirectory', () => {
    it('should upload all files in directory', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content2');

      await uploader.uploadDirectory(tempDir, 'stores/test-store');

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalledTimes(2);
    });

    it('should skip hidden files', async () => {
      fs.writeFileSync(path.join(tempDir, 'visible.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, '.hidden'), 'hidden');

      await uploader.uploadDirectory(tempDir, 'stores/test-store');

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalledTimes(1);
    });

    it('should respect .gitignore patterns', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'ignored.txt');
      fs.writeFileSync(path.join(tempDir, 'tracked.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, 'ignored.txt'), 'ignored');

      await uploader.uploadDirectory(tempDir, 'stores/test-store');

      expect(mockClient.fileSearchStores.uploadToFileSearchStore).toHaveBeenCalledTimes(1);
    });

    it('should emit start event with total files', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content2');

      const onProgress = jest.fn();
      await uploader.uploadDirectory(tempDir, 'stores/test-store', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'start',
          totalFiles: 2,
        })
      );
    });

    it('should emit complete event', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content');

      const onProgress = jest.fn();
      await uploader.uploadDirectory(tempDir, 'stores/test-store', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'complete',
          percentage: 100,
        })
      );
    });

    it('should continue on individual file failures', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.txt'), 'content2');

      // Fail on first call, succeed on second
      mockClient.fileSearchStores.uploadToFileSearchStore
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({ name: 'documents/123' });

      const results = await uploader.uploadDirectory(tempDir, 'stores/test-store');

      // Should have one successful result
      expect(results).toHaveLength(1);
    });
  });

  describe('uploadWithAdapter', () => {
    it('should use provided adapter for file operations', async () => {
      const mockAdapter: FileSystemAdapter = {
        listFiles: jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
        getFileInfo: jest.fn().mockResolvedValue({ path: 'file.txt', size: 100, mtime: new Date().toISOString() }),
        readFileForUpload: jest.fn().mockResolvedValue({
          data: Buffer.from('content'),
          mimeType: 'text/plain',
          displayName: 'file.txt',
          relativePath: 'file.txt',
          hash: 'abc123',
          lastModified: new Date().toISOString(),
        }),
        computeHash: jest.fn().mockResolvedValue('abc123'),
        shouldIndex: jest.fn().mockReturnValue(true),
      };

      await uploader.uploadWithAdapter(mockAdapter, '/base', 'stores/test-store');

      expect(mockAdapter.listFiles).toHaveBeenCalledWith('/base');
      expect(mockAdapter.readFileForUpload).toHaveBeenCalledTimes(2);
    });

    it('should skip unchanged files in smart sync mode', async () => {
      const mockAdapter: FileSystemAdapter = {
        listFiles: jest.fn().mockResolvedValue(['file1.txt']),
        getFileInfo: jest.fn().mockResolvedValue({ path: 'file1.txt', size: 100, mtime: new Date().toISOString() }),
        readFileForUpload: jest.fn().mockResolvedValue({
          data: Buffer.from('content'),
          mimeType: 'text/plain',
          displayName: 'file1.txt',
          relativePath: 'file1.txt',
          hash: 'hash1',
          lastModified: new Date().toISOString(),
        }),
        computeHash: jest.fn().mockResolvedValue('hash1'), // Same as existing hash
        shouldIndex: jest.fn().mockReturnValue(true),
      };

      const onProgress = jest.fn();
      await uploader.uploadWithAdapter(mockAdapter, '/base', 'stores/test-store', {
        smartSync: true,
        onProgress,
      });

      // File should be skipped since hash matches
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file_skipped',
          currentFile: 'file1.txt',
        })
      );
      expect(mockClient.fileSearchStores.uploadToFileSearchStore).not.toHaveBeenCalled();
    });
  });

  describe('getExistingFileHashes', () => {
    it('should return map of file paths to hash info', async () => {
      const hashes = await uploader.getExistingFileHashes('stores/test-store');

      expect(hashes.size).toBe(1);
      expect(hashes.get('file1.txt')).toEqual({
        hash: 'hash1',
        documentName: 'documents/1',
      });
    });

    it('should return empty map on API error', async () => {
      mockClient.fileSearchStores.documents.list.mockImplementation(() => {
        throw new Error('API Error');
      });

      const hashes = await uploader.getExistingFileHashes('stores/test-store');

      expect(hashes.size).toBe(0);
    });
  });
});
