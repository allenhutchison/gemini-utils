/**
 * Progress display utilities for CLI commands.
 * Simple implementation without external dependencies.
 */

import { UploadProgressEvent } from '../../file-search/index.js';

export interface ProgressOptions {
  showProgress: boolean;
  quiet: boolean;
}

/**
 * Creates a progress callback for upload operations.
 */
export function createProgressCallback(options: ProgressOptions): ((event: UploadProgressEvent) => void) | undefined {
  if (!options.showProgress || options.quiet) {
    return undefined;
  }

  let lastLine = '';

  return (event: UploadProgressEvent) => {
    // Clear previous line
    if (lastLine) {
      process.stdout.write('\r' + ' '.repeat(lastLine.length) + '\r');
    }

    switch (event.type) {
      case 'start':
        lastLine = `Preparing to upload ${event.totalFiles} files...`;
        process.stdout.write(lastLine);
        break;

      case 'file_start':
        lastLine = `Uploading: ${event.currentFile}`;
        process.stdout.write(lastLine);
        break;

      case 'file_complete': {
        const processed = (event.completedFiles ?? 0) + (event.skippedFiles ?? 0);
        lastLine = `[${processed}/${event.totalFiles}] Uploaded: ${event.currentFile}`;
        process.stdout.write(lastLine);
        break;
      }

      case 'file_skipped': {
        const processed = (event.completedFiles ?? 0) + (event.skippedFiles ?? 0);
        lastLine = `[${processed}/${event.totalFiles}] Skipped: ${event.currentFile}`;
        process.stdout.write(lastLine);
        break;
      }

      case 'file_error':
        // Print error on new line
        process.stdout.write('\n');
        console.error(`Failed: ${event.currentFile} - ${event.error}`);
        lastLine = '';
        break;

      case 'complete':
        // Print final summary on new line
        process.stdout.write('\n');
        console.log(`Complete: ${event.completedFiles} uploaded, ${event.skippedFiles} skipped, ${event.failedFiles} failed`);
        lastLine = '';
        break;
    }
  };
}
