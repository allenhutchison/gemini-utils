import { describe, it, expect } from '@jest/globals';
import {
  AUDIO_EXTENSION_TO_MIME,
  AUDIO_FILE_SIZE_LIMITS,
  UnsupportedAudioTypeError,
  AudioFileSizeExceededError,
  isAudioExtensionSupported,
  getAudioMimeType,
  requireAudioMimeType,
  getSupportedAudioExtensions,
  shouldUseFileApi,
  validateAudioFileSize,
} from './audioMimeTypes.js';

describe('AUDIO_EXTENSION_TO_MIME', () => {
  it('should have mp3 extension mapped', () => {
    expect(AUDIO_EXTENSION_TO_MIME['.mp3']).toBe('audio/mpeg');
  });

  it('should have wav extension mapped', () => {
    expect(AUDIO_EXTENSION_TO_MIME['.wav']).toBe('audio/wav');
  });

  it('should have all expected audio formats', () => {
    expect(AUDIO_EXTENSION_TO_MIME['.flac']).toBe('audio/flac');
    expect(AUDIO_EXTENSION_TO_MIME['.aac']).toBe('audio/aac');
    expect(AUDIO_EXTENSION_TO_MIME['.ogg']).toBe('audio/ogg');
    expect(AUDIO_EXTENSION_TO_MIME['.m4a']).toBe('audio/mp4');
    expect(AUDIO_EXTENSION_TO_MIME['.webm']).toBe('audio/webm');
  });
});

describe('AUDIO_FILE_SIZE_LIMITS', () => {
  it('should have correct inline size limit', () => {
    expect(AUDIO_FILE_SIZE_LIMITS.MAX_INLINE_SIZE_BYTES).toBe(20 * 1024 * 1024);
    expect(AUDIO_FILE_SIZE_LIMITS.MAX_INLINE_SIZE_MB).toBe(20);
  });

  it('should have correct file API size limit', () => {
    expect(AUDIO_FILE_SIZE_LIMITS.MAX_FILE_API_SIZE_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(AUDIO_FILE_SIZE_LIMITS.MAX_FILE_API_SIZE_GB).toBe(2);
  });
});

describe('UnsupportedAudioTypeError', () => {
  it('should create error with correct message', () => {
    const error = new UnsupportedAudioTypeError('/path/to/file.xyz', '.xyz');
    expect(error.name).toBe('UnsupportedAudioTypeError');
    expect(error.message).toContain('Unsupported audio type');
    expect(error.message).toContain('/path/to/file.xyz');
    expect(error.message).toContain('.xyz');
    expect(error.message).toContain('.mp3');
  });
});

describe('AudioFileSizeExceededError', () => {
  it('should create error with correct message', () => {
    const sizeBytes = 3 * 1024 * 1024 * 1024; // 3 GB
    const limitBytes = 2 * 1024 * 1024 * 1024; // 2 GB
    const error = new AudioFileSizeExceededError('/path/to/file.mp3', sizeBytes, limitBytes);
    expect(error.name).toBe('AudioFileSizeExceededError');
    expect(error.message).toContain('Audio file size exceeded');
    expect(error.message).toContain('/path/to/file.mp3');
  });
});

describe('isAudioExtensionSupported', () => {
  it('should return true for supported extensions with dot', () => {
    expect(isAudioExtensionSupported('.mp3')).toBe(true);
    expect(isAudioExtensionSupported('.wav')).toBe(true);
    expect(isAudioExtensionSupported('.flac')).toBe(true);
  });

  it('should return true for supported extensions without dot', () => {
    expect(isAudioExtensionSupported('mp3')).toBe(true);
    expect(isAudioExtensionSupported('wav')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAudioExtensionSupported('.MP3')).toBe(true);
    expect(isAudioExtensionSupported('.WAV')).toBe(true);
    expect(isAudioExtensionSupported('FLAC')).toBe(true);
  });

  it('should return false for unsupported extensions', () => {
    expect(isAudioExtensionSupported('.txt')).toBe(false);
    expect(isAudioExtensionSupported('.pdf')).toBe(false);
    expect(isAudioExtensionSupported('.mp4')).toBe(false);
  });
});

describe('getAudioMimeType', () => {
  it('should return correct MIME type for supported files', () => {
    expect(getAudioMimeType('/path/to/file.mp3')).toBe('audio/mpeg');
    expect(getAudioMimeType('/path/to/file.wav')).toBe('audio/wav');
    expect(getAudioMimeType('/path/to/file.flac')).toBe('audio/flac');
  });

  it('should return null for unsupported files', () => {
    expect(getAudioMimeType('/path/to/file.txt')).toBeNull();
    expect(getAudioMimeType('/path/to/file.pdf')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(getAudioMimeType('/path/to/FILE.MP3')).toBe('audio/mpeg');
    expect(getAudioMimeType('/path/to/audio.WAV')).toBe('audio/wav');
  });
});

describe('requireAudioMimeType', () => {
  it('should return MIME type for supported files', () => {
    expect(requireAudioMimeType('/path/to/file.mp3')).toBe('audio/mpeg');
    expect(requireAudioMimeType('/path/to/file.wav')).toBe('audio/wav');
  });

  it('should throw for unsupported files', () => {
    expect(() => requireAudioMimeType('/path/to/file.txt')).toThrow(UnsupportedAudioTypeError);
    expect(() => requireAudioMimeType('/path/to/file.pdf')).toThrow(UnsupportedAudioTypeError);
  });
});

describe('getSupportedAudioExtensions', () => {
  it('should return an array', () => {
    const extensions = getSupportedAudioExtensions();
    expect(Array.isArray(extensions)).toBe(true);
  });

  it('should contain expected extensions', () => {
    const extensions = getSupportedAudioExtensions();
    expect(extensions).toContain('.mp3');
    expect(extensions).toContain('.wav');
    expect(extensions).toContain('.flac');
    expect(extensions).toContain('.aac');
    expect(extensions).toContain('.ogg');
    expect(extensions).toContain('.m4a');
    expect(extensions).toContain('.webm');
  });

  it('should have same length as AUDIO_EXTENSION_TO_MIME', () => {
    const extensions = getSupportedAudioExtensions();
    expect(extensions.length).toBe(Object.keys(AUDIO_EXTENSION_TO_MIME).length);
  });
});

describe('shouldUseFileApi', () => {
  it('should return false for small files', () => {
    expect(shouldUseFileApi(1000)).toBe(false);
    expect(shouldUseFileApi(10 * 1024 * 1024)).toBe(false);
    expect(shouldUseFileApi(20 * 1024 * 1024)).toBe(false);
  });

  it('should return true for large files', () => {
    expect(shouldUseFileApi(20 * 1024 * 1024 + 1)).toBe(true);
    expect(shouldUseFileApi(100 * 1024 * 1024)).toBe(true);
    expect(shouldUseFileApi(1 * 1024 * 1024 * 1024)).toBe(true);
  });
});

describe('validateAudioFileSize', () => {
  it('should not throw for files within limit', () => {
    expect(() => validateAudioFileSize('/test.mp3', 100)).not.toThrow();
    expect(() => validateAudioFileSize('/test.mp3', 1 * 1024 * 1024 * 1024)).not.toThrow();
    expect(() => validateAudioFileSize('/test.mp3', 2 * 1024 * 1024 * 1024)).not.toThrow();
  });

  it('should throw for files exceeding limit', () => {
    const oversizeBytes = 2 * 1024 * 1024 * 1024 + 1;
    expect(() => validateAudioFileSize('/test.mp3', oversizeBytes)).toThrow(AudioFileSizeExceededError);
  });
});
