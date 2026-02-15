/**
 * Types for the Gemini MIME Type Support Registry.
 */

/** The 5 content categories consumers care about. */
export type MimeCategory = 'image' | 'audio' | 'video' | 'document' | 'text';

/** Error classification for probe failures. */
export type ErrorClass =
  | 'mime_rejected'
  | 'content_invalid'
  | 'rate_limited'
  | 'unknown';

/** Per-model support status from probe results. */
export interface ModelSupport {
  /** Whether inline base64 upload succeeded. */
  inline: boolean;
  /** Whether File API upload succeeded. */
  fileApi: boolean;
  /** If inline failed, the classified error. */
  inlineErrorClass?: ErrorClass;
  /** If File API failed, the classified error. */
  fileApiErrorClass?: ErrorClass;
}

/** Shape of each entry in the generated support matrix JSON. */
export interface MimeSupportMatrixEntry {
  /** MIME type category (may include probe-internal categories like 'data', 'archive'). */
  category: string;
  /** File extension (with leading dot). */
  extension: string;
  /** Human-readable description. */
  description: string;
  /** Per-model support results keyed by model name. */
  models: Record<string, ModelSupport>;
}

/** Consumer-facing support info for a MIME type. */
export interface MimeSupportEntry {
  /** The MIME type string. */
  mimeType: string;
  /** Mapped file extensions (with leading dots). */
  extensions: string[];
  /** Category (mapped to the 5 consumer categories). */
  category: MimeCategory;
  /** Models that support this MIME type (inline or file API). */
  supportedModels: string[];
  /** Whether at least one model requires File API (inline not supported). */
  requiresFileApi: boolean;
  /** Inline size limit in bytes (hardcoded from docs). */
  inlineSizeLimit: number;
}

/** Per-model capability summary. */
export interface ModelCapabilities {
  supportsImages: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsPdf: boolean;
  inlineSizeLimit: number;
}
