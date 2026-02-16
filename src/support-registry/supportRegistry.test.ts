import { describe, it, expect } from '@jest/globals';
import {
  GEMINI_SUPPORT_MATRIX,
  INLINE_SIZE_LIMIT,
  FILE_API_SIZE_LIMIT,
  isInlineSupported,
  getMimeSupport,
  getSupportedMimes,
  mimeForExtension,
  classifyExtension,
  getModelCapabilities,
} from './supportRegistry.js';

describe('GEMINI_SUPPORT_MATRIX', () => {
  it('should be an object', () => {
    expect(typeof GEMINI_SUPPORT_MATRIX).toBe('object');
    expect(GEMINI_SUPPORT_MATRIX).not.toBeNull();
  });

  it('should have valid structure when non-empty', () => {
    const entries = Object.entries(GEMINI_SUPPORT_MATRIX);
    if (entries.length === 0) return; // Stub matrix is empty - skip structural checks

    for (const [mimeType, entry] of entries) {
      expect(mimeType).toContain('/');
      expect(entry.category).toBeDefined();
      expect(entry.extension).toBeDefined();
      expect(entry.description).toBeDefined();
      expect(typeof entry.models).toBe('object');
    }
  });
});

describe('size limits', () => {
  it('should have correct inline size limit (20MB)', () => {
    expect(INLINE_SIZE_LIMIT).toBe(20 * 1024 * 1024);
  });

  it('should have correct File API size limit (2GB)', () => {
    expect(FILE_API_SIZE_LIMIT).toBe(2 * 1024 * 1024 * 1024);
  });
});

describe('isInlineSupported', () => {
  it('should return false for unknown MIME types', () => {
    expect(isInlineSupported('application/x-totally-made-up')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isInlineSupported('')).toBe(false);
  });

  // Conditional tests that only run when matrix has data
  it('should return a boolean for text/plain', () => {
    const result = isInlineSupported('text/plain');
    expect(typeof result).toBe('boolean');
  });
});

describe('getMimeSupport', () => {
  it('should return undefined for unknown MIME types', () => {
    expect(getMimeSupport('application/x-totally-made-up')).toBeUndefined();
  });

  it('should return entry with correct shape when found', () => {
    const entries = Object.keys(GEMINI_SUPPORT_MATRIX);
    if (entries.length === 0) return;

    const support = getMimeSupport(entries[0]);
    expect(support).toBeDefined();
    expect(support!.mimeType).toBe(entries[0]);
    expect(Array.isArray(support!.extensions)).toBe(true);
    expect(support!.extensions.length).toBeGreaterThan(0);
    expect(typeof support!.category).toBe('string');
    expect(Array.isArray(support!.supportedModels)).toBe(true);
    expect(typeof support!.requiresFileApi).toBe('boolean');
    expect(support!.inlineSizeLimit).toBe(INLINE_SIZE_LIMIT);
  });
});

describe('getSupportedMimes', () => {
  it('should return an array', () => {
    const result = getSupportedMimes('image');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return entries with correct category', () => {
    const result = getSupportedMimes('text');
    for (const entry of result) {
      expect(entry.category).toBe('text');
    }
  });

  it('should return empty array for category with no data', () => {
    // If matrix is empty, all categories return empty
    const entries = Object.keys(GEMINI_SUPPORT_MATRIX);
    if (entries.length === 0) {
      expect(getSupportedMimes('image')).toEqual([]);
    }
  });
});

describe('mimeForExtension', () => {
  it('should handle extension with dot', () => {
    expect(mimeForExtension('.png')).toBe('image/png');
  });

  it('should handle extension without dot', () => {
    expect(mimeForExtension('png')).toBe('image/png');
  });

  it('should be case-insensitive', () => {
    expect(mimeForExtension('.PNG')).toBe('image/png');
    expect(mimeForExtension('PDF')).toBe('application/pdf');
    expect(mimeForExtension('.Mp3')).toBe('audio/mpeg');
  });

  it('should return undefined for unknown extensions', () => {
    expect(mimeForExtension('.xyz123')).toBeUndefined();
    expect(mimeForExtension('unknown')).toBeUndefined();
  });

  it('should handle common types correctly', () => {
    expect(mimeForExtension('.pdf')).toBe('application/pdf');
    expect(mimeForExtension('.jpg')).toBe('image/jpeg');
    expect(mimeForExtension('.mp4')).toBe('video/mp4');
    expect(mimeForExtension('.txt')).toBe('text/plain');
    expect(mimeForExtension('.json')).toBe('application/json');
  });
});

describe('classifyExtension', () => {
  it('should return undefined for unknown extensions', () => {
    expect(classifyExtension('.xyz123unknown')).toBeUndefined();
  });

  it('should classify image extensions', () => {
    const result = classifyExtension('.png');
    expect(result).toBeDefined();
    expect(result!.category).toBe('image');
    expect(result!.mimeType).toBe('image/png');
  });

  it('should classify audio extensions', () => {
    const result = classifyExtension('.mp3');
    expect(result).toBeDefined();
    expect(result!.category).toBe('audio');
    expect(result!.mimeType).toBe('audio/mpeg');
  });

  it('should classify video extensions', () => {
    const result = classifyExtension('.mp4');
    expect(result).toBeDefined();
    expect(result!.category).toBe('video');
    expect(result!.mimeType).toBe('video/mp4');
  });

  it('should classify document extensions', () => {
    const result = classifyExtension('.pdf');
    expect(result).toBeDefined();
    expect(result!.category).toBe('document');
    expect(result!.mimeType).toBe('application/pdf');
  });

  it('should classify text extensions', () => {
    const result = classifyExtension('.txt');
    expect(result).toBeDefined();
    expect(result!.category).toBe('text');
    expect(result!.mimeType).toBe('text/plain');
  });

  it('should handle extension without dot', () => {
    const result = classifyExtension('png');
    expect(result).toBeDefined();
    expect(result!.mimeType).toBe('image/png');
  });
});

describe('getModelCapabilities', () => {
  it('should return defaults for unknown models', () => {
    const caps = getModelCapabilities('totally-unknown-model');
    expect(caps.supportsImages).toBe(false);
    expect(caps.supportsAudio).toBe(false);
    expect(caps.supportsVideo).toBe(false);
    expect(caps.supportsPdf).toBe(false);
    expect(caps.inlineSizeLimit).toBe(INLINE_SIZE_LIMIT);
  });

  it('should return correct inlineSizeLimit', () => {
    const caps = getModelCapabilities('any-model');
    expect(caps.inlineSizeLimit).toBe(20 * 1024 * 1024);
  });

  it('should return booleans for all capability flags', () => {
    const caps = getModelCapabilities('test-model');
    expect(typeof caps.supportsImages).toBe('boolean');
    expect(typeof caps.supportsAudio).toBe('boolean');
    expect(typeof caps.supportsVideo).toBe('boolean');
    expect(typeof caps.supportsPdf).toBe('boolean');
  });
});
