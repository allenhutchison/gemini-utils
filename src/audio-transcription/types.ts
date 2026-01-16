/**
 * Types for the audio transcription module.
 */

/**
 * Supported audio file formats for transcription.
 */
export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'aac' | 'ogg' | 'm4a' | 'webm';

/**
 * Output format options for transcripts.
 */
export type TranscriptFormat = 'text' | 'timestamped' | 'srt' | 'vtt' | 'json';

/**
 * A timestamped segment of a transcript.
 */
export interface TranscriptSegment {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Transcribed text for this segment */
  text: string;
  /** Speaker identifier (when diarization is enabled) */
  speaker?: string;
}

/**
 * Full transcription result.
 */
export interface TranscriptionResult {
  /** Plain text transcription */
  text: string;
  /** Timestamped segments (when timestamps are enabled) */
  segments?: TranscriptSegment[];
  /** Total duration of audio in seconds */
  duration?: number;
  /** Detected or specified language */
  language?: string;
  /** Model used for transcription */
  model: string;
  /** Additional metadata */
  metadata?: {
    /** Original audio file name */
    fileName?: string;
    /** Audio file size in bytes */
    fileSize?: number;
    /** Audio MIME type */
    mimeType?: string;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Whether file was uploaded via File API */
    uploadedViaFileApi?: boolean;
  };
}

/**
 * Parameters for starting a transcription.
 */
export interface TranscribeParams {
  /** Path to the audio file or URI of uploaded file */
  audioSource: string;
  /** Language hint for transcription (default: auto-detect) */
  language?: string;
  /** Model to use (default: gemini-3-flash) */
  model?: string;
  /** Whether to include timestamps in output */
  timestamps?: boolean;
  /** Whether to identify different speakers */
  diarization?: boolean;
}

/**
 * Options for transcript output.
 */
export interface TranscriptionOutputOptions {
  /** Path to save transcript file */
  filePath?: string;
  /** Name of file search store to upload to */
  storeName?: string;
  /** Output format */
  format?: TranscriptFormat;
}

/**
 * Progress callback for transcription operations.
 */
export type TranscriptionProgressCallback = (event: TranscriptionProgressEvent) => void;

/**
 * Progress event during transcription.
 */
export interface TranscriptionProgressEvent {
  /** Type of progress event */
  type: 'upload_start' | 'upload_complete' | 'transcription_start' | 'transcription_progress' | 'transcription_complete';
  /** Progress message */
  message?: string;
  /** Percentage complete (0-100) */
  percentage?: number;
  /** Interaction ID for polling */
  interactionId?: string;
}

/**
 * Metadata about an uploaded audio file.
 */
export interface AudioFileMetadata {
  /** File URI from Gemini File API */
  uri: string;
  /** Display name */
  displayName?: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Upload timestamp */
  createTime?: string;
  /** Expiration timestamp */
  expirationTime?: string;
}

/**
 * Transcription interaction status types.
 */
export type TranscriptionStatus = 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';

/**
 * Terminal statuses that indicate transcription has finished.
 */
export const TRANSCRIPTION_TERMINAL_STATUSES: ReadonlyArray<TranscriptionStatus> = ['completed', 'failed', 'cancelled'];

/**
 * Checks if a status indicates the transcription interaction has finished.
 */
export function isTranscriptionTerminalStatus(status: string): status is TranscriptionStatus {
  return TRANSCRIPTION_TERMINAL_STATUSES.includes(status as TranscriptionStatus);
}
