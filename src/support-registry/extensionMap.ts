/**
 * Comprehensive extension-to-MIME-type mapping for the Gemini Content API.
 *
 * This is an independent copy that consolidates extensions from:
 * - file-search/mimeTypes.ts (EXTENSION_TO_MIME + TEXT_FALLBACK_EXTENSIONS)
 * - audio-transcription/audioMimeTypes.ts (AUDIO_EXTENSION_TO_MIME)
 * - The probe catalog (image, video, document, data, archive, font types)
 *
 * It does NOT delegate to or modify the existing maps in other modules.
 */

/**
 * Comprehensive mapping of file extensions (with leading dot, lowercase) to MIME types.
 * Covers images, audio, video, documents, text/code, structured data, archives, and fonts.
 */
export const COMPREHENSIVE_EXTENSION_MAP: Record<string, string> = {
  // ===== Images =====
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.avif': 'image/avif',

  // ===== Audio =====
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.weba': 'audio/webm',
  '.webm': 'video/webm', // Note: .webm mapped to video; audio/webm uses .weba
  '.aiff': 'audio/x-aiff',
  '.aif': 'audio/x-aiff',
  '.opus': 'audio/opus',
  '.amr': 'audio/amr',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',

  // ===== Video =====
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  // .webm already mapped above to video/webm
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mkv': 'video/x-matroska',
  '.flv': 'video/x-flv',
  '.3gp': 'video/3gpp',
  '.3g2': 'video/3gpp2',
  '.wmv': 'video/x-ms-wmv',

  // ===== Documents =====
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.epub': 'application/epub+zip',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',

  // ===== Text / Code =====
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.log': 'text/plain',
  '.out': 'text/plain',
  '.env': 'text/plain',
  '.gitignore': 'text/plain',
  '.gitattributes': 'text/plain',
  '.dockerignore': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.mdown': 'text/markdown',
  '.mkd': 'text/markdown',
  '.xml': 'text/xml',
  '.py': 'text/x-python',
  '.pyw': 'text/x-python',
  '.pyx': 'text/x-python',
  '.pyi': 'text/x-python',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.jsx': 'text/javascript',
  '.ts': 'text/x-typescript',
  '.mts': 'text/x-typescript',
  '.cts': 'text/x-typescript',
  '.tsx': 'text/x-typescript',
  '.c': 'text/x-c',
  '.h': 'text/x-c',
  '.cpp': 'text/x-c++src',
  '.cxx': 'text/x-c++src',
  '.cc': 'text/x-c++src',
  '.hpp': 'text/x-c++src',
  '.java': 'text/x-java',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.rb': 'text/x-ruby',
  '.rake': 'text/x-ruby',
  '.gemspec': 'text/x-ruby',
  '.php': 'text/x-php',
  '.phtml': 'text/x-php',
  '.swift': 'text/x-swift',
  '.kt': 'text/x-kotlin',
  '.kts': 'text/x-kotlin',
  '.scala': 'text/x-scala',
  '.pl': 'text/x-perl',
  '.pm': 'text/x-perl',
  '.t': 'text/x-perl',
  '.pod': 'text/x-perl',
  '.lua': 'text/x-lua',
  '.erl': 'text/x-erlang',
  '.hrl': 'text/x-erlang',
  '.hs': 'text/x-haskell',
  '.lhs': 'text/x-haskell',
  '.clj': 'text/x-clojure',
  '.cljs': 'text/x-clojure',
  '.cljc': 'text/x-clojure',
  '.ex': 'text/x-elixir',
  '.exs': 'text/x-elixir',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
  '.fish': 'text/x-shellscript',
  '.sql': 'text/x-sql',
  '.diff': 'text/x-diff',
  '.patch': 'text/x-diff',
  '.yaml': 'text/x-yaml',
  '.yml': 'text/x-yaml',
  '.toml': 'text/x-toml',
  '.ini': 'text/plain',
  '.cfg': 'text/plain',
  '.conf': 'text/plain',
  '.properties': 'text/plain',
  '.tcl': 'text/x-tcl',
  '.bib': 'text/x-bibtex',
  '.r': 'text/plain',
  '.rmd': 'text/plain',
  '.jl': 'text/plain',
  '.dart': 'text/plain',
  '.nim': 'text/plain',
  '.zig': 'text/plain',
  '.v': 'text/plain',
  '.vhd': 'text/plain',
  '.vhdl': 'text/plain',
  '.asm': 'text/plain',
  '.s': 'text/plain',
  '.f': 'text/plain',
  '.f90': 'text/plain',
  '.f95': 'text/plain',
  '.pas': 'text/plain',
  '.d': 'text/plain',
  '.ada': 'text/plain',
  '.adb': 'text/plain',
  '.ads': 'text/plain',
  '.lisp': 'text/plain',
  '.lsp': 'text/plain',
  '.cl': 'text/plain',
  '.scm': 'text/plain',
  '.rkt': 'text/plain',
  '.groovy': 'text/plain',
  '.gvy': 'text/plain',
  '.coffee': 'text/plain',
  '.elm': 'text/plain',
  '.sol': 'text/plain',
  '.rst': 'text/plain',
  '.asciidoc': 'text/plain',
  '.adoc': 'text/plain',
  '.tex': 'text/plain',
  '.latex': 'text/plain',
  '.nix': 'text/plain',
  '.dockerfile': 'text/plain',
  '.bat': 'text/plain',
  '.cmd': 'text/plain',
  '.ps1': 'text/plain',
  '.psm1': 'text/plain',
  '.vue': 'text/plain',
  '.svelte': 'text/plain',
  '.astro': 'text/plain',
  '.scss': 'text/plain',
  '.sass': 'text/plain',
  '.less': 'text/plain',
  '.styl': 'text/plain',

  // ===== Structured Data =====
  '.json': 'application/json',
  '.jsonc': 'application/json',
  '.json5': 'application/json',
  '.jsonld': 'application/ld+json',
  '.graphql': 'application/graphql',
  '.gql': 'application/graphql',

  // ===== Archives =====
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',

  // ===== Fonts =====
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',

  // ===== Other =====
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
};

/** Lazily-built reverse map from MIME type → extensions (immutable). */
let _mimeToExtensions: ReadonlyMap<string, readonly string[]> | undefined;

/**
 * Returns a ReadonlyMap from MIME type to a frozen array of extensions.
 * The result is cached — repeated calls return the same instance.
 * Both the map and its arrays are immutable to prevent cache corruption.
 */
export function getMimeToExtensionsMap(): ReadonlyMap<string, readonly string[]> {
  if (_mimeToExtensions) return _mimeToExtensions;

  const building = new Map<string, string[]>();
  for (const [ext, mime] of Object.entries(COMPREHENSIVE_EXTENSION_MAP)) {
    const existing = building.get(mime);
    if (existing) {
      existing.push(ext);
    } else {
      building.set(mime, [ext]);
    }
  }

  // Freeze each array to prevent mutation
  const frozen = new Map<string, readonly string[]>();
  for (const [mime, exts] of building) {
    frozen.set(mime, Object.freeze(exts));
  }

  _mimeToExtensions = frozen;
  return _mimeToExtensions;
}
