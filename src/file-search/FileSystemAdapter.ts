import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import ignore, { Ignore } from 'ignore';
import { getMimeTypeWithFallback } from './mimeTypes.js';

/**
 * Represents file metadata
 */
export interface FileInfo {
  /** File path (relative or absolute depending on context) */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modified time as ISO string */
  mtime: string;
  /** MIME type if known */
  mimeType?: string;
}

/**
 * Represents file content that can be uploaded
 */
export interface FileContent {
  /** The file data - can be a Blob, Buffer, or file path */
  data: Blob | Buffer | string;
  /** The MIME type of the content */
  mimeType: string;
  /** Display name for the file */
  displayName: string;
  /** Relative path for metadata */
  relativePath: string;
  /** Content hash for change detection */
  hash: string;
  /** Last modified time as ISO string */
  lastModified: string;
}

/**
 * Abstract interface for file system operations.
 * Implement this to provide custom file access (e.g., Obsidian Vault, browser, etc.)
 */
export interface FileSystemAdapter {
  /**
   * List all files in a directory recursively.
   * Should respect ignore patterns (like .gitignore).
   * @param dirPath - Directory to list
   * @returns Array of file paths relative to dirPath
   */
  listFiles(dirPath: string): Promise<string[]>;

  /**
   * Get file info/metadata.
   * @param filePath - Path to the file
   * @returns File metadata or null if file doesn't exist
   */
  getFileInfo(filePath: string): Promise<FileInfo | null>;

  /**
   * Read file content for upload.
   * @param filePath - Path to the file
   * @param relativePath - Relative path to use in metadata
   * @returns FileContent ready for upload, or null if file can't be read
   */
  readFileForUpload(filePath: string, relativePath: string): Promise<FileContent | null>;

  /**
   * Compute a hash for change detection.
   * Can use SHA-256 of content, or mtime+size, depending on implementation.
   * @param filePath - Path to the file
   * @returns Hash string for change detection
   */
  computeHash(filePath: string): Promise<string>;

  /**
   * Check if a file should be indexed.
   * Implementations can filter by extension, path patterns, etc.
   * @param filePath - Path to the file
   * @returns true if file should be indexed
   */
  shouldIndex(filePath: string): boolean;
}

/**
 * Default Node.js filesystem implementation of FileSystemAdapter.
 * Uses fs module for file operations and supports .gitignore patterns.
 */
export class NodeFileSystemAdapter implements FileSystemAdapter {
  private readonly ignoreRules: Ignore;
  private readonly rootDir: string;
  private readonly supportedExtensions: Set<string>;

  /**
   * Create a new Node.js filesystem adapter.
   * @param rootDir - Root directory for file operations
   * @param options - Configuration options
   */
  constructor(
    rootDir: string,
    private options: {
      /** Extensions to index (e.g., ['.md', '.txt']). If empty, indexes all supported types. */
      extensions?: string[];
      /** Additional patterns to ignore (in addition to .gitignore) */
      ignorePatterns?: string[];
      /** Whether to skip hidden files (starting with .) */
      skipHidden?: boolean;
    } = {}
  ) {
    this.rootDir = path.resolve(rootDir);
    this.supportedExtensions = new Set(options.extensions || []);
    this.ignoreRules = this.loadIgnoreRules(this.rootDir);
  }

  /**
   * Load gitignore rules from a directory.
   */
  private loadIgnoreRules(rootDir: string): Ignore {
    const ig = ignore();

    // Always ignore .git directory
    ig.add('.git');

    // Add user-specified ignore patterns
    if (this.options.ignorePatterns) {
      ig.add(this.options.ignorePatterns);
    }

    // Load .gitignore if it exists
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    }

    return ig;
  }

  async listFiles(_dirPath: string): Promise<string[]> {
    // Note: dirPath parameter is ignored - rootDir is set in constructor
    const getFilesRecursive = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.resolve(dir, entry.name);
        const relativePath = path.relative(this.rootDir, fullPath);

        // Skip hidden files if configured
        if (this.options.skipHidden !== false && entry.name.startsWith('.')) {
          continue;
        }

        // Check ignore rules
        const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
        if (this.ignoreRules.ignores(checkPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...getFilesRecursive(fullPath));
        } else if (this.shouldIndex(relativePath)) {
          files.push(relativePath);
        }
      }

      return files;
    };

    return getFilesRecursive(this.rootDir);
  }

  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const fullPath = path.join(this.rootDir, filePath);
      const stats = fs.statSync(fullPath);

      return {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async readFileForUpload(filePath: string, relativePath: string): Promise<FileContent | null> {
    try {
      const fullPath = path.join(this.rootDir, filePath);
      const stats = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath);

      // Compute hash from buffer directly (avoid reading file twice)
      const hashSum = crypto.createHash('sha256');
      hashSum.update(content);
      const hash = hashSum.digest('hex');

      // Determine MIME type using shared utility
      const mimeResult = getMimeTypeWithFallback(filePath);
      const mimeType = mimeResult?.mimeType || 'text/plain';

      return {
        data: content,
        mimeType,
        displayName: path.basename(filePath),
        relativePath,
        hash,
        lastModified: stats.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async computeHash(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.rootDir, filePath);
      const fileBuffer = fs.readFileSync(fullPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch {
      return '';
    }
  }

  shouldIndex(filePath: string): boolean {
    // If no extensions specified, index all files
    if (this.supportedExtensions.size === 0) {
      return true;
    }

    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }
}
