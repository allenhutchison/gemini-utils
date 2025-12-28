import { describe, it, expect } from '@jest/globals';
import {
  EXTENSION_TO_MIME,
  TEXT_FALLBACK_EXTENSIONS,
  FILE_SIZE_LIMITS,
  UnsupportedFileTypeError,
  FileSizeExceededError,
  FileUploadError,
  isExtensionSupported,
  getMimeType,
  getMimeTypeWithFallback,
  isExtensionSupportedWithFallback,
  getFallbackExtensions,
  getSupportedExtensions,
} from './mimeTypes.js';

describe('EXTENSION_TO_MIME', () => {
  it('should have pdf extension mapped', () => {
    expect(EXTENSION_TO_MIME['.pdf']).toBe('application/pdf');
  });

  it('should have common text extensions mapped', () => {
    expect(EXTENSION_TO_MIME['.txt']).toBe('text/plain');
    expect(EXTENSION_TO_MIME['.md']).toBe('text/markdown');
    expect(EXTENSION_TO_MIME['.html']).toBe('text/html');
  });

  it('should have programming language extensions mapped', () => {
    expect(EXTENSION_TO_MIME['.py']).toBe('text/x-python');
    expect(EXTENSION_TO_MIME['.java']).toBe('text/x-java');
    expect(EXTENSION_TO_MIME['.c']).toBe('text/x-c');
    expect(EXTENSION_TO_MIME['.go']).toBe('text/x-go');
  });
});

describe('TEXT_FALLBACK_EXTENSIONS', () => {
  it('should include JavaScript/TypeScript extensions', () => {
    expect(TEXT_FALLBACK_EXTENSIONS.has('.js')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.ts')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.tsx')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.jsx')).toBe(true);
  });

  it('should include configuration file extensions', () => {
    expect(TEXT_FALLBACK_EXTENSIONS.has('.json')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.yaml')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.yml')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.toml')).toBe(true);
  });

  it('should include shell script extensions', () => {
    expect(TEXT_FALLBACK_EXTENSIONS.has('.sh')).toBe(true);
    expect(TEXT_FALLBACK_EXTENSIONS.has('.bash')).toBe(true);
  });
});

describe('FILE_SIZE_LIMITS', () => {
  it('should have correct max file size in bytes', () => {
    expect(FILE_SIZE_LIMITS.MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });

  it('should have correct max file size in MB', () => {
    expect(FILE_SIZE_LIMITS.MAX_FILE_SIZE_MB).toBe(100);
  });
});

describe('UnsupportedFileTypeError', () => {
  it('should create error with correct message', () => {
    const error = new UnsupportedFileTypeError('/path/to/file.xyz', '.xyz');
    expect(error.name).toBe('UnsupportedFileTypeError');
    expect(error.message).toContain('Unsupported file type');
    expect(error.message).toContain('/path/to/file.xyz');
    expect(error.message).toContain('.xyz');
  });
});

describe('FileSizeExceededError', () => {
  it('should create error with correct message', () => {
    const sizeBytes = 150 * 1024 * 1024; // 150 MB
    const limitBytes = 100 * 1024 * 1024; // 100 MB
    const error = new FileSizeExceededError('/path/to/file.pdf', sizeBytes, limitBytes);
    expect(error.name).toBe('FileSizeExceededError');
    expect(error.message).toContain('File size exceeded');
    expect(error.message).toContain('/path/to/file.pdf');
    expect(error.message).toContain('150.00 MB');
    expect(error.message).toContain('100.00 MB');
  });
});

describe('FileUploadError', () => {
  it('should wrap original error', () => {
    const originalError = new Error('Network failure');
    const error = new FileUploadError('/path/to/file.txt', originalError);
    expect(error.name).toBe('FileUploadError');
    expect(error.message).toContain('Failed to upload');
    expect(error.message).toContain('/path/to/file.txt');
    expect(error.message).toContain('Network failure');
    expect(error.cause).toBe(originalError);
  });
});

describe('isExtensionSupported', () => {
  it('should return true for supported extensions with dot', () => {
    expect(isExtensionSupported('.pdf')).toBe(true);
    expect(isExtensionSupported('.txt')).toBe(true);
    expect(isExtensionSupported('.py')).toBe(true);
  });

  it('should return true for supported extensions without dot', () => {
    expect(isExtensionSupported('pdf')).toBe(true);
    expect(isExtensionSupported('txt')).toBe(true);
    expect(isExtensionSupported('py')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isExtensionSupported('.PDF')).toBe(true);
    expect(isExtensionSupported('.TXT')).toBe(true);
    expect(isExtensionSupported('PY')).toBe(true);
  });

  it('should return false for unsupported extensions', () => {
    expect(isExtensionSupported('.xyz')).toBe(false);
    expect(isExtensionSupported('.exe')).toBe(false);
    expect(isExtensionSupported('.mp3')).toBe(false);
  });

  it('should return false for fallback extensions (not in EXTENSION_TO_MIME)', () => {
    expect(isExtensionSupported('.js')).toBe(false);
    expect(isExtensionSupported('.ts')).toBe(false);
  });
});

describe('getMimeType', () => {
  it('should return correct MIME type for supported extensions', () => {
    expect(getMimeType('/path/to/file.pdf')).toBe('application/pdf');
    expect(getMimeType('/path/to/file.txt')).toBe('text/plain');
    expect(getMimeType('/path/to/file.md')).toBe('text/markdown');
  });

  it('should return null for unsupported extensions', () => {
    expect(getMimeType('/path/to/file.xyz')).toBeNull();
    expect(getMimeType('/path/to/file.exe')).toBeNull();
  });

  it('should return null for fallback extensions', () => {
    expect(getMimeType('/path/to/file.js')).toBeNull();
    expect(getMimeType('/path/to/file.ts')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(getMimeType('/path/to/file.PDF')).toBe('application/pdf');
    expect(getMimeType('/path/to/FILE.TXT')).toBe('text/plain');
  });
});

describe('getMimeTypeWithFallback', () => {
  it('should return validated MIME type without fallback flag', () => {
    const result = getMimeTypeWithFallback('/path/to/file.pdf');
    expect(result).toEqual({ mimeType: 'application/pdf', isFallback: false });
  });

  it('should return text/plain with fallback flag for fallback extensions', () => {
    const result = getMimeTypeWithFallback('/path/to/file.js');
    expect(result).toEqual({ mimeType: 'text/plain', isFallback: true });
  });

  it('should return text/plain with fallback flag for TypeScript', () => {
    const result = getMimeTypeWithFallback('/path/to/file.ts');
    expect(result).toEqual({ mimeType: 'text/plain', isFallback: true });
  });

  it('should return null for completely unsupported extensions', () => {
    expect(getMimeTypeWithFallback('/path/to/file.xyz')).toBeNull();
    expect(getMimeTypeWithFallback('/path/to/file.exe')).toBeNull();
    expect(getMimeTypeWithFallback('/path/to/file.mp3')).toBeNull();
  });
});

describe('isExtensionSupportedWithFallback', () => {
  it('should return true for validated extensions', () => {
    expect(isExtensionSupportedWithFallback('.pdf')).toBe(true);
    expect(isExtensionSupportedWithFallback('.txt')).toBe(true);
    expect(isExtensionSupportedWithFallback('md')).toBe(true);
  });

  it('should return true for fallback extensions', () => {
    expect(isExtensionSupportedWithFallback('.js')).toBe(true);
    expect(isExtensionSupportedWithFallback('.ts')).toBe(true);
    expect(isExtensionSupportedWithFallback('json')).toBe(true);
  });

  it('should return false for unsupported extensions', () => {
    expect(isExtensionSupportedWithFallback('.xyz')).toBe(false);
    expect(isExtensionSupportedWithFallback('.exe')).toBe(false);
    expect(isExtensionSupportedWithFallback('mp3')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isExtensionSupportedWithFallback('.JS')).toBe(true);
    expect(isExtensionSupportedWithFallback('.TS')).toBe(true);
    expect(isExtensionSupportedWithFallback('PDF')).toBe(true);
  });
});

describe('getFallbackExtensions', () => {
  it('should return an array', () => {
    const extensions = getFallbackExtensions();
    expect(Array.isArray(extensions)).toBe(true);
  });

  it('should contain expected fallback extensions', () => {
    const extensions = getFallbackExtensions();
    expect(extensions).toContain('.js');
    expect(extensions).toContain('.ts');
    expect(extensions).toContain('.json');
    expect(extensions).toContain('.yaml');
  });

  it('should have same length as TEXT_FALLBACK_EXTENSIONS set', () => {
    const extensions = getFallbackExtensions();
    expect(extensions.length).toBe(TEXT_FALLBACK_EXTENSIONS.size);
  });
});

describe('getSupportedExtensions', () => {
  it('should return an array', () => {
    const extensions = getSupportedExtensions();
    expect(Array.isArray(extensions)).toBe(true);
  });

  it('should contain expected validated extensions', () => {
    const extensions = getSupportedExtensions();
    expect(extensions).toContain('.pdf');
    expect(extensions).toContain('.txt');
    expect(extensions).toContain('.md');
    expect(extensions).toContain('.py');
  });

  it('should have same length as EXTENSION_TO_MIME object keys', () => {
    const extensions = getSupportedExtensions();
    expect(extensions.length).toBe(Object.keys(EXTENSION_TO_MIME).length);
  });

  it('should not contain fallback-only extensions', () => {
    const extensions = getSupportedExtensions();
    expect(extensions).not.toContain('.js');
    expect(extensions).not.toContain('.ts');
    expect(extensions).not.toContain('.json');
  });
});
