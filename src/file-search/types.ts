/**
 * Represents a failed file in an upload operation.
 */
export interface FailedFile {
  /** Path to the file that failed */
  file: string;
  /** Error message describing the failure */
  error: string;
}

/**
 * Status of an upload operation.
 */
export type UploadOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Represents the state of an upload operation.
 */
export interface UploadOperation {
  /** Unique identifier for the operation */
  id: string;
  /** Current status of the operation */
  status: UploadOperationStatus;
  /** Path being uploaded (file or directory) */
  path: string;
  /** Target store name */
  storeName: string;
  /** Whether smart sync is enabled */
  smartSync: boolean;
  /** Total number of files to process */
  totalFiles: number;
  /** Number of files successfully uploaded */
  completedFiles: number;
  /** Number of files skipped (unchanged in smart sync) */
  skippedFiles: number;
  /** Number of files that failed to upload */
  failedFiles: number;
  /** List of files that failed with error details */
  failedFilesList: FailedFile[];
  /** ISO timestamp when the operation started */
  startedAt: string;
  /** ISO timestamp when the operation completed (if finished) */
  completedAt?: string;
  /** Error message if the operation failed */
  error?: string;
}

/**
 * Storage interface for persisting upload operations.
 * Implement this interface to provide custom storage (file-based, database, etc.)
 */
export interface OperationStorage {
  /** Get an operation by ID */
  get(id: string): UploadOperation | undefined;
  /** Save an operation */
  set(id: string, operation: UploadOperation): void;
  /** Get all operations */
  getAll(): Record<string, UploadOperation>;
}
