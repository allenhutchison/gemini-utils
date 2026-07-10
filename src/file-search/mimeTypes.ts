import { extname } from '../common/pathHelpers.js';

/**
 * Validated mapping of file extensions to MIME types supported by Gemini File Search API.
 * Based on: https://ai.google.dev/gemini-api/docs/file-search#supported-files
 *
 * This mapping has been validated against the real API (as of 2025-12-21).
 * Only includes MIME types that have been confirmed to work.
 *
 * Total: 36 validated extensions across 12 MIME types
 */
export const EXTENSION_TO_MIME: Record<string, string> = {
  // ===== Application Types (2) =====

  // Document formats
  '.pdf': 'application/pdf',

  // Data formats
  '.xml': 'application/xml',

  // ===== Text Types (34) =====

  // Plain text
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.log': 'text/plain',
  '.out': 'text/plain',
  '.env': 'text/plain',
  '.gitignore': 'text/plain',
  '.gitattributes': 'text/plain',
  '.dockerignore': 'text/plain',

  // Markup languages
  '.html': 'text/html',
  '.htm': 'text/html',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.mdown': 'text/markdown',
  '.mkd': 'text/markdown',

  // Programming languages
  '.c': 'text/x-c',
  '.h': 'text/x-c',
  '.java': 'text/x-java',
  '.kt': 'text/x-kotlin',
  '.kts': 'text/x-kotlin',
  '.go': 'text/x-go',
  '.py': 'text/x-python',
  '.pyw': 'text/x-python',
  '.pyx': 'text/x-python',
  '.pyi': 'text/x-python',
  '.pl': 'text/x-perl',
  '.pm': 'text/x-perl',
  '.t': 'text/x-perl',
  '.pod': 'text/x-perl',
  '.lua': 'text/x-lua',
  '.erl': 'text/x-erlang',
  '.hrl': 'text/x-erlang',
  '.tcl': 'text/x-tcl',

  // Documentation
  '.bib': 'text/x-bibtex',

  // Specialized formats
  '.diff': 'text/x-diff',
};

/**
 * Extensions that should fall back to text/plain when not in EXTENSION_TO_MIME.
 * These are common text-based file types that the API doesn't have specific MIME types for,
 * but can be uploaded as plain text.
 */
export const TEXT_FALLBACK_EXTENSIONS: Set<string> = new Set([
  // JavaScript/TypeScript ecosystem
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx', '.d.ts',
  '.json', '.jsonc', '.json5',

  // Web technologies
  '.css', '.scss', '.sass', '.less', '.styl',
  '.vue', '.svelte', '.astro',

  // Shell and scripting
  '.sh', '.bash', '.zsh', '.fish', '.ksh', '.csh', '.tcsh',
  '.bat', '.cmd', '.ps1', '.psm1',

  // Configuration formats
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.properties', '.editorconfig', '.prettierrc', '.eslintrc',
  '.babelrc', '.npmrc', '.nvmrc', '.browserslistrc',

  // Build and package files
  '.makefile', '.cmake', '.gradle', '.sbt',
  '.gemfile', '.podfile', '.cartfile',

  // Other programming languages
  '.rb', '.rake', '.gemspec',
  '.php', '.phtml',
  '.rs', '.rlib',
  '.swift',
  '.scala',
  '.clj', '.cljs', '.cljc', '.edn',
  '.ex', '.exs',
  '.hs', '.lhs',
  '.ml', '.mli',
  '.fs', '.fsx', '.fsi',
  '.r', '.rmd',
  '.jl',
  '.nim', '.nimble',
  '.zig',
  '.v', '.sv', '.svh',
  '.vhd', '.vhdl',
  '.asm', '.s',
  '.f', '.f90', '.f95', '.for',
  '.pas', '.pp',
  '.d',
  '.ada', '.adb', '.ads',
  '.cob', '.cbl',
  '.pro', '.P',
  '.lisp', '.lsp', '.cl',
  '.scm', '.ss', '.rkt',
  '.groovy', '.gvy',
  '.dart',
  '.cr',
  '.coffee',
  '.elm',
  '.purs',
  '.hx',
  '.sol',

  // Documentation and data
  '.rst', '.asciidoc', '.adoc', '.asc',
  '.tex', '.latex', '.sty', '.cls',
  '.csv', '.tsv',
  '.sql',
  '.graphql', '.gql',

  // Lock files and manifests
  '.lock', '.sum',

  // Docker and containers
  '.dockerfile',

  // Miscellaneous text files
  '.patch',
  '.awk',
  '.sed',
  '.vim', '.vimrc',
  '.tmux.conf',
  '.htaccess', '.htpasswd',
  '.nix',
]);

/**
 * File size limits for Gemini File Search API
 */
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB
  MAX_FILE_SIZE_MB: 100,
} as const;

/**
 * Custom error thrown when an unsupported file type is encountered
 */
export class UnsupportedFileTypeError extends Error {
  constructor(filePath: string, extension: string) {
    const supportedExts = getSupportedExtensions().slice(0, 10).join(', ');
    const totalCount = getSupportedExtensions().length;
    super(
      `Unsupported file type: ${filePath} (extension: ${extension})\n` +
      `Supported extensions include: ${supportedExts}... (${totalCount} total)\n` +
      `See https://ai.google.dev/gemini-api/docs/file-search#supported-files for full list.`
    );
    this.name = 'UnsupportedFileTypeError';
  }
}

/**
 * Custom error thrown when a file exceeds the size limit
 */
export class FileSizeExceededError extends Error {
  constructor(filePath: string, sizeBytes: number, limitBytes: number) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const limitMB = (limitBytes / 1024 / 1024).toFixed(2);
    super(
      `File size exceeded: ${filePath} (${sizeMB} MB) exceeds limit of ${limitMB} MB`
    );
    this.name = 'FileSizeExceededError';
  }
}

/**
 * Custom error wrapper for file upload failures
 */
export class FileUploadError extends Error {
  constructor(filePath: string, originalError: Error) {
    super(`Failed to upload ${filePath}: ${originalError.message}`);
    this.name = 'FileUploadError';
    this.cause = originalError;
  }
}

/**
 * Progress event emitted during file upload operations
 */
export interface UploadProgressEvent {
  /** Type of progress event */
  type: 'start' | 'file_start' | 'file_complete' | 'file_skipped' | 'file_error' | 'complete';
  /** Current file being processed */
  currentFile?: string;
  /** Index of current file (1-based) */
  currentFileIndex?: number;
  /** Total number of files to process */
  totalFiles?: number;
  /** Number of files completed successfully */
  completedFiles?: number;
  /** Number of files that were skipped (unchanged) */
  skippedFiles?: number;
  /** Number of files that failed */
  failedFiles?: number;
  /** Error that occurred (for file_error type) */
  error?: Error;
  /** Percentage complete (0-100) */
  percentage?: number;
}

/**
 * Callback function for progress tracking
 */
export type ProgressCallback = (event: UploadProgressEvent) => void;

/**
 * Checks if a file extension is supported by the Gemini File Search API
 *
 * @param extension - File extension (with or without leading dot, case-insensitive)
 * @returns true if the extension is supported
 */
export function isExtensionSupported(extension: string): boolean {
  const normalizedExt = extension.toLowerCase();
  const withDot = normalizedExt.startsWith('.') ? normalizedExt : `.${normalizedExt}`;
  return withDot in EXTENSION_TO_MIME;
}

/**
 * Gets the MIME type for a file based on its extension
 *
 * @param filePath - Path to the file
 * @returns MIME type string, or null if extension is not supported
 */
export function getMimeType(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_MIME[ext] || null;
}

/**
 * Gets the MIME type for a file, with fallback to text/plain for known text file types.
 * This allows uploading common programming files (like .js, .ts, .json) that don't have
 * validated MIME types by treating them as plain text.
 *
 * @param filePath - Path to the file
 * @returns Object with mimeType and whether fallback was used, or null if unsupported
 */
export function getMimeTypeWithFallback(filePath: string): { mimeType: string; isFallback: boolean } | null {
  const ext = extname(filePath).toLowerCase();

  // First try validated MIME types
  const validatedMime = EXTENSION_TO_MIME[ext];
  if (validatedMime) {
    return { mimeType: validatedMime, isFallback: false };
  }

  // Check if it's a text file that should fall back to text/plain
  if (TEXT_FALLBACK_EXTENSIONS.has(ext)) {
    return { mimeType: 'text/plain', isFallback: true };
  }

  // Unsupported file type
  return null;
}

/**
 * Checks if a file extension is supported (either directly or via fallback)
 *
 * @param extension - File extension (with or without leading dot, case-insensitive)
 * @returns true if the extension is supported (including via fallback)
 */
export function isExtensionSupportedWithFallback(extension: string): boolean {
  const normalizedExt = extension.toLowerCase();
  const withDot = normalizedExt.startsWith('.') ? normalizedExt : `.${normalizedExt}`;
  return withDot in EXTENSION_TO_MIME || TEXT_FALLBACK_EXTENSIONS.has(withDot);
}

/**
 * Returns an array of all fallback extensions (text files uploaded as text/plain)
 *
 * @returns Array of fallback extensions
 */
export function getFallbackExtensions(): string[] {
  return Array.from(TEXT_FALLBACK_EXTENSIONS);
}

/**
 * Returns an array of all supported file extensions (with leading dots)
 *
 * @returns Array of supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_TO_MIME);
}
