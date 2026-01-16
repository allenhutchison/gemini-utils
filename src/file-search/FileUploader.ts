import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import ignore, { Ignore } from 'ignore';
import {
  getMimeTypeWithFallback,
  FILE_SIZE_LIMITS,
  UnsupportedFileTypeError,
  FileSizeExceededError,
  FileUploadError,
  ProgressCallback,
} from './mimeTypes.js';
import { FileSearchManager } from './FileSearchManager.js';
import { FileSystemAdapter, FileContent } from './FileSystemAdapter.js';

/**
 * Represents metadata for an existing file in the store.
 * Used by smart sync to compare local files against stored documents.
 */
export interface ExistingFileInfo {
  /** SHA-256 hash of the file content */
  hash: string;
  /** Full resource name of the document (e.g., "documents/123") */
  documentName: string;
}

/**
 * Optional logger interface for debugging output.
 * If not provided, no logging occurs.
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Configuration options for file upload operations.
 */
export interface UploadConfig {
  /** Chunking configuration for the upload */
  chunkingConfig?: unknown;
  /** Relative path to use for the file (defaults to filename) */
  relativePath?: string;
  /** Progress callback for tracking upload status */
  onProgress?: ProgressCallback;
  /** Callback when a file completes (for counter updates) */
  onFileComplete?: () => void;
}

/**
 * Configuration options for directory/batch upload operations.
 */
export interface BatchUploadConfig {
  /** Chunking configuration for uploads */
  chunkingConfig?: unknown;
  /** Progress callback for tracking upload status */
  onProgress?: ProgressCallback;
  /** Parallel upload configuration */
  parallel?: {
    /** Maximum concurrent uploads (default: 5) */
    maxConcurrent?: number;
  };
  /** Enable smart sync to skip unchanged files based on hash comparison */
  smartSync?: boolean;
  /** Optional logger for debug output */
  logger?: Logger;
}

/**
 * Handles file and directory uploads to Google's Gemini File Search API.
 * Supports smart sync, parallel uploads, progress tracking, and custom file system adapters.
 */
export class FileUploader {
  private fileSearchManager: FileSearchManager;
  private logger?: Logger;

  constructor(private client: GoogleGenAI, logger?: Logger) {
    this.fileSearchManager = new FileSearchManager(client);
    this.logger = logger;
  }

  /**
   * Fetches existing file hashes from the store for comparison.
   * Returns a map of relative path -> { hash, documentName }
   */
  async getExistingFileHashes(storeName: string): Promise<Map<string, ExistingFileInfo>> {
    const hashMap = new Map<string, ExistingFileInfo>();

    try {
      const documents = await this.fileSearchManager.listDocuments(storeName);

      for (const doc of documents) {
        // Extract hash and path from customMetadata with defensive checks
        const metadata = Array.isArray(doc.customMetadata) ? doc.customMetadata : [];
        let filePath: string | undefined;
        let hash: string | undefined;

        for (const meta of metadata) {
          if (!meta || typeof meta.key !== 'string') continue;
          if (meta.key === 'path') {
            filePath = meta.stringValue;
          } else if (meta.key === 'hash') {
            hash = meta.stringValue;
          }
        }

        if (filePath && hash && doc.name) {
          hashMap.set(filePath, { hash, documentName: doc.name });
        }
      }
    } catch (error) {
      // If we can't list documents (e.g., empty store), return empty map
      this.logger?.debug('Note: Could not fetch existing documents:', (error as Error).message);
    }

    return hashMap;
  }

  // ==================== Content-based Upload (works with any adapter) ====================

  /**
   * Uploads file content directly to a file search store.
   * This method works with any file system adapter - the content is already prepared.
   *
   * @param content - The file content to upload
   * @param storeName - The store to upload to
   * @param config - Upload configuration
   */
  async uploadContent(
    content: FileContent,
    storeName: string,
    config?: UploadConfig
  ): Promise<unknown> {
    // Validate size
    let size: number;
    if (content.data instanceof Blob) {
      size = content.data.size;
    } else if (Buffer.isBuffer(content.data)) {
      size = content.data.length;
    } else {
      // String path - get file size
      size = fs.statSync(content.data).size;
    }

    if (size > FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new FileSizeExceededError(
        content.relativePath,
        size,
        FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES
      );
    }

    try {
      // Emit progress event if callback provided
      config?.onProgress?.({
        type: 'file_start',
        currentFile: content.displayName,
      });

      this.logger?.debug(`Uploading ${content.displayName} to ${storeName}...`);

      // Prepare the file data for upload
      let fileData: Blob | string;
      if (content.data instanceof Blob) {
        fileData = content.data;
      } else if (Buffer.isBuffer(content.data)) {
        fileData = new Blob([new Uint8Array(content.data)], { type: content.mimeType });
      } else {
        // String path - pass directly
        fileData = content.data;
      }

      const op = await this.client.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName,
        file: fileData,
        config: {
          displayName: content.displayName,
          mimeType: content.mimeType,
          chunkingConfig: config?.chunkingConfig,
          customMetadata: [
            { key: 'path', stringValue: content.relativePath },
            { key: 'hash', stringValue: content.hash },
            { key: 'last_modified', stringValue: content.lastModified },
            ...(content.customMetadata || []),
          ],
        } as any,
      });

      // Call completion callback before emitting progress event
      config?.onFileComplete?.();

      // Emit complete event
      config?.onProgress?.({
        type: 'file_complete',
        currentFile: content.displayName,
      });

      return op;
    } catch (error) {
      this.logger?.error(`Failed to upload ${content.displayName}:`, (error as Error).message);

      // Emit error event
      config?.onProgress?.({
        type: 'file_error',
        currentFile: content.displayName,
        error: error as Error,
      });

      throw new FileUploadError(content.relativePath, error as Error);
    }
  }

  /**
   * Uploads files using a FileSystemAdapter.
   * This is the recommended method for custom environments (e.g., Obsidian, browser).
   *
   * @param adapter - The file system adapter to use
   * @param basePath - Base path to list files from
   * @param storeName - The store to upload to
   * @param config - Upload configuration
   */
  async uploadWithAdapter(
    adapter: FileSystemAdapter,
    basePath: string,
    storeName: string,
    config?: BatchUploadConfig
  ): Promise<unknown[]> {
    const maxConcurrent = config?.parallel?.maxConcurrent ?? 5;
    const smartSync = config?.smartSync ?? false;

    // List files using the adapter
    const allFiles = await adapter.listFiles(basePath);

    // Fetch existing file hashes if smart sync is enabled
    let existingHashes = new Map<string, ExistingFileInfo>();
    if (smartSync) {
      this.logger?.debug('Smart sync enabled: fetching existing file hashes...');
      existingHashes = await this.getExistingFileHashes(storeName);
      this.logger?.debug(`Found ${existingHashes.size} existing files in store`);
    }

    // Emit start event
    config?.onProgress?.({
      type: 'start',
      totalFiles: allFiles.length,
      percentage: 0,
    });

    const results: unknown[] = [];
    let completedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;

    // Process files in batches of maxConcurrent
    for (let i = 0; i < allFiles.length; i += maxConcurrent) {
      const batch = allFiles.slice(i, i + maxConcurrent);

      // Use Promise.allSettled to continue on failures
      const batchResults = await Promise.allSettled(
        batch.map(async (filePath, idx) => {
          const fileIndex = i + idx + 1;

          // Check if we should skip this file (smart sync)
          if (smartSync) {
            const existingInfo = existingHashes.get(filePath);
            if (existingInfo) {
              // Calculate local file hash
              const localHash = await adapter.computeHash(filePath);
              if (localHash === existingInfo.hash) {
                // File unchanged, skip upload
                skippedFiles++;
                config?.onProgress?.({
                  type: 'file_skipped',
                  currentFile: filePath,
                  currentFileIndex: fileIndex,
                  totalFiles: allFiles.length,
                  completedFiles,
                  skippedFiles,
                  percentage: Math.round(((completedFiles + skippedFiles) / allFiles.length) * 100),
                });
                return { skipped: true, path: filePath };
              }
            }
          }

          // Read file content using adapter
          const content = await adapter.readFileForUpload(filePath, filePath);
          if (!content) {
            throw new Error(`Failed to read file: ${filePath}`);
          }

          return this.uploadContent(content, storeName, {
            ...config,
            onFileComplete: () => {
              completedFiles++;
            },
            onProgress: (event) => {
              // Augment progress events with batch context
              const augmentedEvent = {
                ...event,
                currentFileIndex: fileIndex,
                totalFiles: allFiles.length,
                completedFiles,
                skippedFiles,
                percentage: Math.round(((completedFiles + skippedFiles) / allFiles.length) * 100),
              };
              config?.onProgress?.(augmentedEvent);
            },
          });
        })
      );

      // Track results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          // Don't add skipped files to results
          const value = result.value as { skipped?: boolean };
          if (!value?.skipped) {
            results.push(result.value);
          }
        } else {
          this.logger?.error('Upload failed:', result.reason);
          failedFiles++;
        }
      }
    }

    // Emit complete event
    config?.onProgress?.({
      type: 'complete',
      totalFiles: allFiles.length,
      completedFiles,
      skippedFiles,
      failedFiles,
      percentage: 100,
    });

    return results;
  }

  // ==================== Path-based Upload (Node.js filesystem) ====================

  /**
   * Loads gitignore rules from a directory.
   * Looks for .gitignore in the root directory and returns an Ignore instance.
   */
  private loadGitignoreRules(rootDir: string): Ignore {
    const ig = ignore();

    // Always ignore .git directory
    ig.add('.git');

    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    }

    return ig;
  }

  private determineMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const result = getMimeTypeWithFallback(filePath);

    if (!result) {
      throw new UnsupportedFileTypeError(filePath, ext);
    }

    return result.mimeType;
  }

  private validateFileSize(filePath: string, stats: fs.Stats): void {
    if (stats.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new FileSizeExceededError(
        filePath,
        stats.size,
        FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES
      );
    }
  }

  /**
   * Computes the SHA-256 hash of a file's contents.
   */
  getFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Uploads a single file from the filesystem to a file search store.
   * For custom file systems, use uploadContent() or uploadWithAdapter() instead.
   */
  async uploadFile(
    filePath: string,
    storeName: string,
    config?: UploadConfig
  ): Promise<unknown> {
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);

    // Validate size BEFORE expensive hashing operation
    this.validateFileSize(filePath, stats);

    // Validate MIME type (will throw if unsupported)
    const mimeType = this.determineMimeType(filePath);

    // Now proceed with hashing
    const hash = this.getFileHash(filePath);
    const lastModified = stats.mtime.toISOString();
    const relativePath = config?.relativePath || fileName;

    // Create FileContent and delegate to uploadContent
    const content: FileContent = {
      data: filePath, // Pass path directly - SDK handles it
      mimeType,
      displayName: fileName,
      relativePath,
      hash,
      lastModified,
    };

    return this.uploadContent(content, storeName, config);
  }

  /**
   * Uploads all files in a directory to a file search store.
   * Uses the Node.js filesystem. For custom file systems, use uploadWithAdapter().
   */
  async uploadDirectory(
    dirPath: string,
    storeName: string,
    config?: BatchUploadConfig
  ): Promise<unknown[]> {
    const absoluteDirPath = path.resolve(dirPath);
    const maxConcurrent = config?.parallel?.maxConcurrent ?? 5;
    const smartSync = config?.smartSync ?? false;

    // Load gitignore rules from the directory
    const ig = this.loadGitignoreRules(absoluteDirPath);

    const getFiles = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const res = path.resolve(dir, entry.name);
        const relativePath = path.relative(absoluteDirPath, res);

        // Check if path should be ignored (add trailing slash for directories)
        const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
        if (ig.ignores(checkPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...getFiles(res));
        } else {
          files.push(res);
        }
      }
      return files;
    };

    const allFiles = getFiles(absoluteDirPath)
      .filter(f => !path.basename(f).startsWith('.')); // Skip hidden files

    // Fetch existing file hashes if smart sync is enabled
    let existingHashes = new Map<string, ExistingFileInfo>();
    if (smartSync) {
      this.logger?.debug('Smart sync enabled: fetching existing file hashes...');
      existingHashes = await this.getExistingFileHashes(storeName);
      this.logger?.debug(`Found ${existingHashes.size} existing files in store`);
    }

    // Emit start event
    config?.onProgress?.({
      type: 'start',
      totalFiles: allFiles.length,
      percentage: 0,
    });

    const results: unknown[] = [];
    let completedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;

    // Process files in batches of maxConcurrent
    for (let i = 0; i < allFiles.length; i += maxConcurrent) {
      const batch = allFiles.slice(i, i + maxConcurrent);

      // Use Promise.allSettled to continue on failures
      const batchResults = await Promise.allSettled(
        batch.map(async (filePath, idx) => {
          const relativePath = path.relative(absoluteDirPath, filePath);
          const fileIndex = i + idx + 1;
          const fileName = path.basename(filePath);

          // Check if we should skip this file (smart sync)
          if (smartSync) {
            const existingInfo = existingHashes.get(relativePath);
            if (existingInfo) {
              // Calculate local file hash
              const localHash = this.getFileHash(filePath);
              if (localHash === existingInfo.hash) {
                // File unchanged, skip upload
                skippedFiles++;
                config?.onProgress?.({
                  type: 'file_skipped',
                  currentFile: fileName,
                  currentFileIndex: fileIndex,
                  totalFiles: allFiles.length,
                  completedFiles,
                  skippedFiles,
                  percentage: Math.round(((completedFiles + skippedFiles) / allFiles.length) * 100),
                });
                return { skipped: true, path: relativePath };
              }
            }
          }

          return this.uploadFile(filePath, storeName, {
            ...config,
            relativePath,
            onFileComplete: () => {
              completedFiles++;
            },
            onProgress: (event) => {
              // Augment progress events with batch context
              const augmentedEvent = {
                ...event,
                currentFileIndex: fileIndex,
                totalFiles: allFiles.length,
                completedFiles,
                skippedFiles,
                percentage: Math.round(((completedFiles + skippedFiles) / allFiles.length) * 100),
              };
              config?.onProgress?.(augmentedEvent);
            },
          });
        })
      );

      // Track results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          // Don't add skipped files to results
          const value = result.value as { skipped?: boolean };
          if (!value?.skipped) {
            results.push(result.value);
          }
        } else {
          this.logger?.error('Upload failed:', result.reason);
          failedFiles++;
        }
      }
    }

    // Emit complete event
    config?.onProgress?.({
      type: 'complete',
      totalFiles: allFiles.length,
      completedFiles,
      skippedFiles,
      failedFiles,
      percentage: 100,
    });

    return results;
  }
}
