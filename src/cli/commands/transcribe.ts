/**
 * Transcribe command - audio transcription using Gemini.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  TranscriptionManager,
  TranscriptFormatter,
  TranscriptFormat,
  TranscriptionResult,
} from '../../audio-transcription/index.js';
import { output, OutputContext, outputError, formatTable } from '../utils/output.js';
import { handleError, ExitCode } from '../utils/errors.js';

const VALID_FORMATS: TranscriptFormat[] = ['text', 'timestamped', 'srt', 'vtt', 'json'];

/**
 * Writes transcript to a file.
 */
async function writeTranscript(
  outputPath: string,
  result: TranscriptionResult,
  format: TranscriptFormat,
  outputContext: OutputContext
): Promise<void> {
  const formatter = new TranscriptFormatter();
  const content = formatter.format(result, format);
  await fs.promises.writeFile(outputPath, content);
  if (!outputContext.quiet && !outputContext.json) {
    console.log(`Transcript saved to: ${outputPath}`);
  }
}

/**
 * Uploads transcript to a file search store.
 */
async function uploadToStore(
  storeName: string,
  result: TranscriptionResult,
  format: TranscriptFormat,
  fileName: string,
  command: Command
): Promise<void> {
  const { client, outputContext } = command.ctx!;
  const formatter = new TranscriptFormatter();
  const content = formatter.format(result, format);

  // Upload as a text document to the file search store
  const blob = new Blob([content], { type: 'text/plain' });

  await client.fileSearchStores.uploadToFileSearchStore({
    fileSearchStoreName: storeName,
    file: blob,
    config: {
      displayName: fileName,
      mimeType: 'text/plain',
    },
  });

  if (!outputContext.quiet && !outputContext.json) {
    console.log(`Transcript uploaded to store: ${storeName}`);
  }
}

export function registerTranscribeCommands(program: Command): void {
  const transcribe = program
    .command('transcribe')
    .description('Audio transcription using Gemini');

  // transcribe file <audio-file>
  transcribe
    .command('file <audio-file>')
    .description('Transcribe an audio file')
    .option('-m, --model <model>', 'Model to use', 'gemini-3-flash-preview')
    .option('-l, --language <lang>', 'Language hint (e.g., "en", "es", "fr")')
    .option('-t, --timestamps', 'Include timestamps in output')
    .option('-d, --diarization', 'Identify different speakers')
    .option(
      '-f, --format <format>',
      `Output format: ${VALID_FORMATS.join(', ')}`,
      'text'
    )
    .option('-o, --output <file>', 'Save transcript to file')
    .option('-s, --store <name>', 'Upload transcript to file search store')
    .action(async function (
      this: Command,
      audioFile: string,
      options: {
        model: string;
        language?: string;
        timestamps?: boolean;
        diarization?: boolean;
        format: string;
        output?: string;
        store?: string;
      }
    ) {
      const { client, outputContext } = this.ctx!;

      // Determine format - default to 'timestamped' if -t flag is used without explicit format
      let format = options.format as TranscriptFormat;
      if (options.timestamps && options.format === 'text') {
        // If timestamps requested but format not explicitly set, use timestamped format
        format = 'timestamped';
      }

      // Validate format
      if (!VALID_FORMATS.includes(format)) {
        outputError(
          outputContext,
          `Invalid format: ${options.format}. Valid formats: ${VALID_FORMATS.join(', ')}`,
          ExitCode.MISSING_ARGUMENT
        );
        return;
      }

      // Validate file exists
      if (!fs.existsSync(audioFile)) {
        outputError(outputContext, `File not found: ${audioFile}`, ExitCode.NOT_FOUND);
        return;
      }

      const transcriber = new TranscriptionManager(client);

      try {
        // Show progress
        if (!outputContext.quiet && !outputContext.json) {
          console.log(`Transcribing: ${audioFile}`);
          if (options.timestamps || options.diarization) {
            console.log(
              `Options: ${options.timestamps ? 'timestamps' : ''}${options.timestamps && options.diarization ? ', ' : ''}${options.diarization ? 'speaker diarization' : ''}`
            );
          }
        }

        const result = await transcriber.transcribe(
          {
            audioSource: audioFile,
            model: options.model,
            language: options.language,
            timestamps: options.timestamps || options.diarization,
            diarization: options.diarization,
          },
          (event) => {
            if (!outputContext.quiet && !outputContext.json && event.message) {
              console.log(event.message);
            }
          }
        );

        // Save to file if specified
        if (options.output) {
          await writeTranscript(options.output, result, format, outputContext);
        }

        // Upload to store if specified
        if (options.store) {
          const fileName = options.output
            ? path.basename(options.output)
            : `${path.basename(audioFile)}.transcript.txt`;
          await uploadToStore(options.store, result, format, fileName, this);
        }

        // Output result
        const formatter = new TranscriptFormatter();
        output(outputContext, result, () => {
          const lines: string[] = [];

          if (!options.output && !options.store) {
            // Only show transcript if not saving to file/store
            lines.push(formatter.format(result, format));
            lines.push('');
          }

          lines.push('---');
          lines.push(`Model: ${result.model}`);
          if (result.duration) {
            lines.push(`Duration: ${result.duration.toFixed(1)}s`);
          }
          if (result.metadata?.processingTimeMs) {
            lines.push(`Processing time: ${(result.metadata.processingTimeMs / 1000).toFixed(1)}s`);
          }
          if (result.segments?.length) {
            lines.push(`Segments: ${result.segments.length}`);
          }

          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // transcribe upload <audio-file>
  transcribe
    .command('upload <audio-file>')
    .description('Upload an audio file to Gemini File API (for large files)')
    .action(async function (this: Command, audioFile: string) {
      const { client, outputContext } = this.ctx!;

      // Validate file exists
      if (!fs.existsSync(audioFile)) {
        outputError(outputContext, `File not found: ${audioFile}`, ExitCode.NOT_FOUND);
        return;
      }

      const transcriber = new TranscriptionManager(client);

      try {
        if (!outputContext.quiet && !outputContext.json) {
          console.log(`Uploading: ${audioFile}`);
        }

        const metadata = await transcriber.uploadAudioFile(audioFile);

        output(outputContext, metadata, () =>
          [
            `File uploaded successfully`,
            `URI: ${metadata.uri}`,
            `Size: ${(metadata.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
            `Expires: ${metadata.expirationTime || 'unknown'}`,
          ].join('\n')
        );
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // transcribe list
  transcribe
    .command('list')
    .description('List uploaded audio files')
    .action(async function (this: Command) {
      const { client, outputContext } = this.ctx!;
      const transcriber = new TranscriptionManager(client);

      try {
        const files = await transcriber.listAudioFiles();

        output(outputContext, files, () => {
          if (files.length === 0) {
            return 'No audio files found';
          }

          return formatTable(
            ['Name', 'Display Name', 'MIME Type'],
            files.map((f) => [f.name, f.displayName || '', f.mimeType])
          );
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // transcribe delete <file-id>
  transcribe
    .command('delete <file-id>')
    .description('Delete an uploaded audio file')
    .action(async function (this: Command, fileId: string) {
      const { client, outputContext } = this.ctx!;
      const transcriber = new TranscriptionManager(client);

      try {
        await transcriber.deleteAudioFile(fileId);
        output(outputContext, { deleted: fileId }, () => `Deleted: ${fileId}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
