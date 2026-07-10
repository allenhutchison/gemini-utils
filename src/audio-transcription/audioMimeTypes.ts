/**
 * Audio MIME type validation for transcription.
 * Based on Gemini API supported audio formats.
 */

import { extname } from '../common/pathHelpers.js';

/**
 * Mapping of audio file extensions to MIME types supported by Gemini.
 */
export const AUDIO_EXTENSION_TO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

/**
 * File size limits for audio uploads.
 */
export const AUDIO_FILE_SIZE_LIMITS = {
  /** Maximum size for inline base64 upload (20 MB) */
  MAX_INLINE_SIZE_BYTES: 20 * 1024 * 1024,
  MAX_INLINE_SIZE_MB: 20,
  /** Maximum size for File API upload (2 GB) */
  MAX_FILE_API_SIZE_BYTES: 2 * 1024 * 1024 * 1024,
  MAX_FILE_API_SIZE_GB: 2,
} as const;

/**
 * Custom error for unsupported audio file types.
 */
export class UnsupportedAudioTypeError extends Error {
  constructor(filePath: string, extension: string) {
    const supportedExts = getSupportedAudioExtensions().join(', ');
    super(
      `Unsupported audio type: ${filePath} (extension: ${extension})\n` +
      `Supported audio extensions: ${supportedExts}`
    );
    this.name = 'UnsupportedAudioTypeError';
  }
}

/**
 * Custom error for audio files exceeding size limits.
 */
export class AudioFileSizeExceededError extends Error {
  constructor(filePath: string, sizeBytes: number, limitBytes: number) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const limitMB = (limitBytes / 1024 / 1024).toFixed(2);
    super(
      `Audio file size exceeded: ${filePath} (${sizeMB} MB) exceeds limit of ${limitMB} MB`
    );
    this.name = 'AudioFileSizeExceededError';
  }
}

/**
 * Checks if an audio file extension is supported.
 *
 * @param extension - File extension (with or without leading dot, case-insensitive)
 * @returns true if the extension is supported
 */
export function isAudioExtensionSupported(extension: string): boolean {
  const normalizedExt = extension.toLowerCase();
  const withDot = normalizedExt.startsWith('.') ? normalizedExt : `.${normalizedExt}`;
  return withDot in AUDIO_EXTENSION_TO_MIME;
}

/**
 * Gets the MIME type for an audio file based on its extension.
 *
 * @param filePath - Path to the audio file
 * @returns MIME type string, or null if extension is not supported
 */
export function getAudioMimeType(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return AUDIO_EXTENSION_TO_MIME[ext] || null;
}

/**
 * Gets the MIME type for an audio file, throwing if unsupported.
 *
 * @param filePath - Path to the audio file
 * @returns MIME type string
 * @throws UnsupportedAudioTypeError if the file type is not supported
 */
export function requireAudioMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeType = AUDIO_EXTENSION_TO_MIME[ext];
  if (!mimeType) {
    throw new UnsupportedAudioTypeError(filePath, ext);
  }
  return mimeType;
}

/**
 * Returns an array of all supported audio file extensions.
 *
 * @returns Array of supported extensions (with leading dots)
 */
export function getSupportedAudioExtensions(): string[] {
  return Object.keys(AUDIO_EXTENSION_TO_MIME);
}

/**
 * Determines whether a file should be uploaded via the File API based on size.
 *
 * @param sizeBytes - File size in bytes
 * @returns true if file should use File API, false if inline upload is acceptable
 */
export function shouldUseFileApi(sizeBytes: number): boolean {
  return sizeBytes > AUDIO_FILE_SIZE_LIMITS.MAX_INLINE_SIZE_BYTES;
}

/**
 * Validates audio file size against the maximum limit.
 *
 * @param filePath - Path to the audio file
 * @param sizeBytes - File size in bytes
 * @throws AudioFileSizeExceededError if file exceeds maximum size
 */
export function validateAudioFileSize(filePath: string, sizeBytes: number): void {
  if (sizeBytes > AUDIO_FILE_SIZE_LIMITS.MAX_FILE_API_SIZE_BYTES) {
    throw new AudioFileSizeExceededError(
      filePath,
      sizeBytes,
      AUDIO_FILE_SIZE_LIMITS.MAX_FILE_API_SIZE_BYTES
    );
  }
}
