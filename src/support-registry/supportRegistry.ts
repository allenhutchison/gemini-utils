/**
 * Gemini MIME Type Support Registry.
 *
 * Provides query functions for checking which MIME types the Gemini API
 * supports, based on data from the generated support matrix.
 */

import matrixData from '../generated/gemini-support-matrix.json' with { type: 'json' };
import { COMPREHENSIVE_EXTENSION_MAP, getMimeToExtensionsMap } from './extensionMap.js';
import type {
  MimeCategory,
  MimeSupportMatrixEntry,
  MimeSupportEntry,
  ModelCapabilities,
} from './types.js';

/** Hardcoded inline size limit from Gemini docs: 20 MB. */
export const INLINE_SIZE_LIMIT = 20 * 1024 * 1024;

/** Hardcoded File API size limit from Gemini docs: 2 GB. */
export const FILE_API_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

/** The raw generated support matrix. */
export const GEMINI_SUPPORT_MATRIX: Record<string, MimeSupportMatrixEntry> =
  matrixData as Record<string, MimeSupportMatrixEntry>;

/** The 5 consumer categories. Internal probe categories map to these. */
const CATEGORY_MAP: Record<string, MimeCategory> = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  document: 'document',
  text: 'text',
  // Probe-internal categories → consumer categories
  data: 'text',
  archive: 'document',
  font: 'document',
  application: 'text',
};

function toConsumerCategory(raw: string): MimeCategory {
  return CATEGORY_MAP[raw] ?? 'text';
}

/**
 * Check if a MIME type is supported for inline base64 upload.
 *
 * @param mimeType - The MIME type to check.
 * @param model - Optional model name. If omitted, returns true if any model supports it.
 */
export function isInlineSupported(mimeType: string, model?: string): boolean {
  const entry = GEMINI_SUPPORT_MATRIX[mimeType];
  if (!entry) return false;

  if (model) {
    return entry.models[model]?.inline === true;
  }

  return Object.values(entry.models).some(m => m.inline);
}

/**
 * Get full support info for a MIME type.
 *
 * @param mimeType - The MIME type to look up.
 * @returns Support entry or undefined if not in the matrix.
 */
export function getMimeSupport(mimeType: string): MimeSupportEntry | undefined {
  const entry = GEMINI_SUPPORT_MATRIX[mimeType];
  if (!entry) return undefined;

  const reverseMap = getMimeToExtensionsMap();
  const extensions = [...(reverseMap.get(mimeType) ?? [entry.extension])];

  const supportedModels = Object.entries(entry.models)
    .filter(([, m]) => m.inline || m.fileApi)
    .map(([name]) => name);

  const requiresFileApi =
    supportedModels.length > 0 &&
    Object.values(entry.models).some(m => m.fileApi && !m.inline);

  return {
    mimeType,
    extensions,
    category: toConsumerCategory(entry.category),
    supportedModels,
    requiresFileApi,
    inlineSizeLimit: INLINE_SIZE_LIMIT,
  };
}

/**
 * Get all supported MIME types for a category.
 *
 * @param category - One of the 5 consumer categories.
 * @param model - Optional model filter.
 */
export function getSupportedMimes(
  category: MimeCategory,
  model?: string,
): MimeSupportEntry[] {
  const results: MimeSupportEntry[] = [];

  for (const [mimeType, entry] of Object.entries(GEMINI_SUPPORT_MATRIX)) {
    if (toConsumerCategory(entry.category) !== category) continue;

    // Check if any (or the specific) model supports it
    const hasSupport = model
      ? entry.models[model]?.inline || entry.models[model]?.fileApi
      : Object.values(entry.models).some(m => m.inline || m.fileApi);

    if (!hasSupport) continue;

    const support = getMimeSupport(mimeType);
    if (support) results.push(support);
  }

  return results;
}

/**
 * Look up the canonical MIME type for a file extension.
 *
 * @param extension - File extension (with or without leading dot, case-insensitive).
 * @returns The MIME type, or undefined if not recognized.
 */
export function mimeForExtension(extension: string): string | undefined {
  const normalized = extension.toLowerCase();
  const withDot = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return COMPREHENSIVE_EXTENSION_MAP[withDot];
}

/** Well-known application/* MIME types that are documents. */
const DOCUMENT_APPLICATION_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/epub+zip',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

function guessCategoryFromMime(mimeType: string): MimeCategory {
  if (DOCUMENT_APPLICATION_MIMES.has(mimeType)) return 'document';
  const prefix = mimeType.split('/')[0];
  return CATEGORY_MAP[prefix] ?? 'text';
}

/**
 * Classify a file extension: determine its category, MIME type, and support status.
 *
 * @param extension - File extension (with or without leading dot, case-insensitive).
 * @param model - Optional model to check support against.
 */
export function classifyExtension(
  extension: string,
  model?: string,
): { category: MimeCategory; mimeType: string; supported: boolean } | undefined {
  const mimeType = mimeForExtension(extension);
  if (!mimeType) return undefined;

  const matrixEntry = GEMINI_SUPPORT_MATRIX[mimeType];
  if (!matrixEntry) {
    // Known extension but not in matrix — guess category from MIME type
    const category = guessCategoryFromMime(mimeType);
    return { category, mimeType, supported: false };
  }

  const category = toConsumerCategory(matrixEntry.category);
  const supported = model
    ? (matrixEntry.models[model]?.inline || matrixEntry.models[model]?.fileApi) === true
    : Object.values(matrixEntry.models).some(m => m.inline || m.fileApi);

  return { category, mimeType, supported };
}

/**
 * Get a summary of what a model supports.
 *
 * @param model - The model name.
 */
export function getModelCapabilities(model: string): ModelCapabilities {
  let supportsImages = false;
  let supportsAudio = false;
  let supportsVideo = false;
  let supportsPdf = false;

  for (const [mimeType, entry] of Object.entries(GEMINI_SUPPORT_MATRIX)) {
    const modelSupport = entry.models[model];
    if (!modelSupport) continue;
    if (!modelSupport.inline && !modelSupport.fileApi) continue;

    const cat = toConsumerCategory(entry.category);
    if (cat === 'image') supportsImages = true;
    if (cat === 'audio') supportsAudio = true;
    if (cat === 'video') supportsVideo = true;
    if (mimeType === 'application/pdf') supportsPdf = true;
  }

  return {
    supportsImages,
    supportsAudio,
    supportsVideo,
    supportsPdf,
    inlineSizeLimit: INLINE_SIZE_LIMIT,
  };
}
