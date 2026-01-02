/**
 * Upload command - upload files to file search stores.
 */

import { Command } from 'commander';
import { FileUploader } from '../../file-search/index.js';
import { output } from '../utils/output.js';
import { handleError } from '../utils/errors.js';
import { createProgressCallback } from '../utils/progress.js';

export function registerUploadCommands(program: Command): void {
  const upload = program
    .command('upload')
    .description('Upload files to a file search store');

  // upload file <path> <store>
  upload
    .command('file <path> <store>')
    .description('Upload a single file')
    .action(async function (this: Command, filePath: string, storeName: string) {
      const { client, outputContext } = this.ctx!;
      const uploader = new FileUploader(client);

      try {
        const result = await uploader.uploadFile(filePath, storeName) as { name?: string };
        output(outputContext, result, () => `Uploaded: ${result.name ?? filePath}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // upload directory <path> <store>
  upload
    .command('directory <path> <store>')
    .description('Upload all files in a directory')
    .option('--smart-sync', 'Skip unchanged files based on content hash')
    .option('-c, --concurrency <n>', 'Max concurrent uploads', '5')
    .option('--no-progress', 'Disable progress display')
    .action(async function (
      this: Command,
      dirPath: string,
      storeName: string,
      options: { smartSync?: boolean; concurrency: string; progress: boolean }
    ) {
      const { client, outputContext } = this.ctx!;
      const uploader = new FileUploader(client);

      // Validate concurrency
      const DEFAULT_CONCURRENCY = 5;
      let concurrency = parseInt(options.concurrency, 10);
      if (!Number.isFinite(concurrency) || concurrency <= 0) {
        if (!outputContext.quiet && !outputContext.json) {
          console.warn(`Invalid concurrency "${options.concurrency}", using default ${DEFAULT_CONCURRENCY}`);
        }
        concurrency = DEFAULT_CONCURRENCY;
      }

      const progressCallback = createProgressCallback({
        showProgress: options.progress,
        quiet: outputContext.quiet,
      });

      try {
        const results = await uploader.uploadDirectory(dirPath, storeName, {
          smartSync: options.smartSync,
          parallel: { maxConcurrent: concurrency },
          onProgress: progressCallback,
        });

        const summary = {
          uploaded: results.length,
          store: storeName,
          path: dirPath,
        };

        output(outputContext, summary, () =>
          `Successfully uploaded ${results.length} files to ${storeName}`
        );
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
