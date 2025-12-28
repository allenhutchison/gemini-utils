import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { NodeFileSystemAdapter } from './FileSystemAdapter.js';

describe('NodeFileSystemAdapter', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-utils-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('listFiles', () => {
    it('should list files in a directory', async () => {
      // Create test files
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content2');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const files = await adapter.listFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.md');
    });

    it('should list files recursively', async () => {
      // Create nested structure
      fs.mkdirSync(path.join(tempDir, 'subdir'));
      fs.writeFileSync(path.join(tempDir, 'root.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, 'subdir', 'nested.txt'), 'nested content');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const files = await adapter.listFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files).toContain('root.txt');
      expect(files).toContain(path.join('subdir', 'nested.txt'));
    });

    it('should skip hidden files by default', async () => {
      fs.writeFileSync(path.join(tempDir, 'visible.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, '.hidden'), 'hidden content');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const files = await adapter.listFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files).toContain('visible.txt');
      expect(files).not.toContain('.hidden');
    });

    it('should include hidden files when skipHidden is false', async () => {
      fs.writeFileSync(path.join(tempDir, 'visible.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, '.hidden'), 'hidden content');

      const adapter = new NodeFileSystemAdapter(tempDir, { skipHidden: false });
      const files = await adapter.listFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files).toContain('visible.txt');
      expect(files).toContain('.hidden');
    });

    it('should respect .gitignore rules', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'ignored.txt\nbuild/');
      fs.writeFileSync(path.join(tempDir, 'tracked.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, 'ignored.txt'), 'ignored content');
      fs.mkdirSync(path.join(tempDir, 'build'));
      fs.writeFileSync(path.join(tempDir, 'build', 'output.txt'), 'build output');

      const adapter = new NodeFileSystemAdapter(tempDir, { skipHidden: false });
      const files = await adapter.listFiles(tempDir);

      expect(files).toContain('tracked.txt');
      expect(files).not.toContain('ignored.txt');
      expect(files).not.toContain(path.join('build', 'output.txt'));
    });

    it('should respect custom ignore patterns', async () => {
      fs.writeFileSync(path.join(tempDir, 'keep.txt'), 'content');
      fs.writeFileSync(path.join(tempDir, 'ignore.log'), 'log content');

      const adapter = new NodeFileSystemAdapter(tempDir, {
        ignorePatterns: ['*.log'],
      });
      const files = await adapter.listFiles(tempDir);

      expect(files).toContain('keep.txt');
      expect(files).not.toContain('ignore.log');
    });

    it('should always ignore .git directory', async () => {
      fs.mkdirSync(path.join(tempDir, '.git'));
      fs.writeFileSync(path.join(tempDir, '.git', 'config'), 'git config');
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');

      const adapter = new NodeFileSystemAdapter(tempDir, { skipHidden: false });
      const files = await adapter.listFiles(tempDir);

      expect(files).not.toContain(path.join('.git', 'config'));
      expect(files).toContain('file.txt');
    });

    it('should filter by extensions when specified', async () => {
      fs.writeFileSync(path.join(tempDir, 'file.md'), 'markdown');
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'text');
      fs.writeFileSync(path.join(tempDir, 'file.js'), 'javascript');

      const adapter = new NodeFileSystemAdapter(tempDir, {
        extensions: ['.md', '.txt'],
      });
      const files = await adapter.listFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files).toContain('file.md');
      expect(files).toContain('file.txt');
      expect(files).not.toContain('file.js');
    });
  });

  describe('getFileInfo', () => {
    it('should return file info for existing file', async () => {
      const filePath = 'test.txt';
      const content = 'test content';
      fs.writeFileSync(path.join(tempDir, filePath), content);

      const adapter = new NodeFileSystemAdapter(tempDir);
      const info = await adapter.getFileInfo(filePath);

      expect(info).not.toBeNull();
      expect(info?.path).toBe(filePath);
      expect(info?.size).toBe(content.length);
      expect(info?.mtime).toBeDefined();
    });

    it('should return null for non-existent file', async () => {
      const adapter = new NodeFileSystemAdapter(tempDir);
      const info = await adapter.getFileInfo('non-existent.txt');

      expect(info).toBeNull();
    });
  });

  describe('readFileForUpload', () => {
    it('should read file content for upload', async () => {
      const filePath = 'test.txt';
      const content = 'test content for upload';
      fs.writeFileSync(path.join(tempDir, filePath), content);

      const adapter = new NodeFileSystemAdapter(tempDir);
      const fileContent = await adapter.readFileForUpload(filePath, 'relative/path/test.txt');

      expect(fileContent).not.toBeNull();
      expect(fileContent?.displayName).toBe('test.txt');
      expect(fileContent?.relativePath).toBe('relative/path/test.txt');
      expect(fileContent?.mimeType).toBe('text/plain');
      expect(fileContent?.hash).toBeDefined();
      expect(fileContent?.lastModified).toBeDefined();
      expect(Buffer.isBuffer(fileContent?.data)).toBe(true);
    });

    it('should compute correct hash', async () => {
      const filePath = 'test.txt';
      const content = 'test content';
      fs.writeFileSync(path.join(tempDir, filePath), content);

      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const fileContent = await adapter.readFileForUpload(filePath, filePath);

      expect(fileContent?.hash).toBe(expectedHash);
    });

    it('should return null for non-existent file', async () => {
      const adapter = new NodeFileSystemAdapter(tempDir);
      const fileContent = await adapter.readFileForUpload('non-existent.txt', 'non-existent.txt');

      expect(fileContent).toBeNull();
    });

    it('should determine correct MIME type based on extension', async () => {
      fs.writeFileSync(path.join(tempDir, 'test.md'), '# Markdown');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const fileContent = await adapter.readFileForUpload('test.md', 'test.md');

      expect(fileContent?.mimeType).toBe('text/markdown');
    });
  });

  describe('computeHash', () => {
    it('should compute SHA-256 hash of file content', async () => {
      const filePath = 'test.txt';
      const content = 'hash test content';
      fs.writeFileSync(path.join(tempDir, filePath), content);

      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      const adapter = new NodeFileSystemAdapter(tempDir);
      const hash = await adapter.computeHash(filePath);

      expect(hash).toBe(expectedHash);
    });

    it('should return empty string for non-existent file', async () => {
      const adapter = new NodeFileSystemAdapter(tempDir);
      const hash = await adapter.computeHash('non-existent.txt');

      expect(hash).toBe('');
    });
  });

  describe('shouldIndex', () => {
    it('should return true for all files when no extensions specified', () => {
      const adapter = new NodeFileSystemAdapter(tempDir);

      expect(adapter.shouldIndex('file.txt')).toBe(true);
      expect(adapter.shouldIndex('file.md')).toBe(true);
      expect(adapter.shouldIndex('file.xyz')).toBe(true);
    });

    it('should filter by extension when extensions are specified', () => {
      const adapter = new NodeFileSystemAdapter(tempDir, {
        extensions: ['.md', '.txt'],
      });

      expect(adapter.shouldIndex('file.md')).toBe(true);
      expect(adapter.shouldIndex('file.txt')).toBe(true);
      expect(adapter.shouldIndex('file.js')).toBe(false);
      expect(adapter.shouldIndex('file.xyz')).toBe(false);
    });

    it('should be case-insensitive for extensions', () => {
      const adapter = new NodeFileSystemAdapter(tempDir, {
        extensions: ['.md'],
      });

      expect(adapter.shouldIndex('file.md')).toBe(true);
      expect(adapter.shouldIndex('file.MD')).toBe(true);
    });
  });
});
