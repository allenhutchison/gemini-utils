import * as crypto from 'crypto';
import { UploadOperation, OperationStorage, FailedFile } from './types.js';

/**
 * In-memory storage implementation for upload operations.
 * Useful for testing or when persistence isn't needed.
 */
export class InMemoryOperationStorage implements OperationStorage {
  private operations: Record<string, UploadOperation> = {};

  get(id: string): UploadOperation | undefined {
    return this.operations[id];
  }

  set(id: string, operation: UploadOperation): void {
    this.operations[id] = operation;
  }

  getAll(): Record<string, UploadOperation> {
    return { ...this.operations };
  }
}

/**
 * Manages upload operations with customizable storage.
 * Tracks progress, status, and failed files for long-running upload operations.
 */
export class UploadOperationManager {
  private storage: OperationStorage;

  /**
   * Creates a new UploadOperationManager.
   * @param storage - Storage implementation for persisting operations.
   *                  Defaults to in-memory storage if not provided.
   */
  constructor(storage?: OperationStorage) {
    this.storage = storage ?? new InMemoryOperationStorage();
  }

  /**
   * Creates a new upload operation and persists it.
   * Returns the generated operation.
   */
  createOperation(
    path: string,
    storeName: string,
    smartSync: boolean,
    totalFiles: number = 0
  ): UploadOperation {
    const id = crypto.randomUUID();
    const operation: UploadOperation = {
      id,
      status: 'pending',
      path,
      storeName,
      smartSync,
      totalFiles,
      completedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      failedFilesList: [],
      startedAt: new Date().toISOString(),
    };

    this.storage.set(id, operation);
    return operation;
  }

  /**
   * Retrieves an upload operation by ID.
   * Returns undefined if not found.
   */
  getOperation(id: string): UploadOperation | undefined {
    return this.storage.get(id);
  }

  /**
   * Updates an existing upload operation with partial updates.
   * Persists the changes to storage.
   */
  updateOperation(id: string, updates: Partial<Omit<UploadOperation, 'id'>>): UploadOperation | undefined {
    const existing = this.getOperation(id);
    if (!existing) {
      return undefined;
    }

    const updated: UploadOperation = {
      ...existing,
      ...updates,
    };

    this.storage.set(id, updated);
    return updated;
  }

  /**
   * Lists all upload operations.
   */
  listOperations(): UploadOperation[] {
    const ops = this.storage.getAll();
    return Object.values(ops);
  }

  /**
   * Marks an operation as in progress.
   */
  markInProgress(id: string, totalFiles: number): UploadOperation | undefined {
    return this.updateOperation(id, {
      status: 'in_progress',
      totalFiles,
    });
  }

  /**
   * Marks an operation as completed.
   */
  markCompleted(id: string): UploadOperation | undefined {
    return this.updateOperation(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Marks an operation as failed with an error message.
   */
  markFailed(id: string, error: string): UploadOperation | undefined {
    return this.updateOperation(id, {
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Updates progress counters for an operation.
   */
  updateProgress(
    id: string,
    completedFiles: number,
    skippedFiles: number,
    failedFiles: number
  ): UploadOperation | undefined {
    return this.updateOperation(id, {
      completedFiles,
      skippedFiles,
      failedFiles,
    });
  }

  /**
   * Adds a failed file to the operation's failed files list.
   */
  addFailedFile(id: string, file: string, error: string): UploadOperation | undefined {
    const existing = this.getOperation(id);
    if (!existing) {
      return undefined;
    }

    const failedFilesList: FailedFile[] = [...(existing.failedFilesList || []), { file, error }];
    return this.updateOperation(id, {
      failedFiles: failedFilesList.length,
      failedFilesList,
    });
  }
}
