import { describe, it, expect } from '@jest/globals';
import { COMPREHENSIVE_EXTENSION_MAP, getMimeToExtensionsMap } from './extensionMap.js';

describe('COMPREHENSIVE_EXTENSION_MAP', () => {
  it('should have image extensions', () => {
    expect(COMPREHENSIVE_EXTENSION_MAP['.png']).toBe('image/png');
    expect(COMPREHENSIVE_EXTENSION_MAP['.jpg']).toBe('image/jpeg');
    expect(COMPREHENSIVE_EXTENSION_MAP['.gif']).toBe('image/gif');
    expect(COMPREHENSIVE_EXTENSION_MAP['.webp']).toBe('image/webp');
    expect(COMPREHENSIVE_EXTENSION_MAP['.svg']).toBe('image/svg+xml');
  });

  it('should have audio extensions', () => {
    expect(COMPREHENSIVE_EXTENSION_MAP['.mp3']).toBe('audio/mpeg');
    expect(COMPREHENSIVE_EXTENSION_MAP['.wav']).toBe('audio/wav');
    expect(COMPREHENSIVE_EXTENSION_MAP['.flac']).toBe('audio/flac');
    expect(COMPREHENSIVE_EXTENSION_MAP['.m4a']).toBe('audio/mp4');
    expect(COMPREHENSIVE_EXTENSION_MAP['.ogg']).toBe('audio/ogg');
  });

  it('should have video extensions', () => {
    expect(COMPREHENSIVE_EXTENSION_MAP['.mp4']).toBe('video/mp4');
    expect(COMPREHENSIVE_EXTENSION_MAP['.webm']).toBe('video/webm');
    expect(COMPREHENSIVE_EXTENSION_MAP['.mov']).toBe('video/quicktime');
    expect(COMPREHENSIVE_EXTENSION_MAP['.avi']).toBe('video/x-msvideo');
  });

  it('should have document extensions', () => {
    expect(COMPREHENSIVE_EXTENSION_MAP['.pdf']).toBe('application/pdf');
    expect(COMPREHENSIVE_EXTENSION_MAP['.docx']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(COMPREHENSIVE_EXTENSION_MAP['.xlsx']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(COMPREHENSIVE_EXTENSION_MAP['.pptx']).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
  });

  it('should have text/code extensions', () => {
    expect(COMPREHENSIVE_EXTENSION_MAP['.txt']).toBe('text/plain');
    expect(COMPREHENSIVE_EXTENSION_MAP['.html']).toBe('text/html');
    expect(COMPREHENSIVE_EXTENSION_MAP['.css']).toBe('text/css');
    expect(COMPREHENSIVE_EXTENSION_MAP['.py']).toBe('text/x-python');
    expect(COMPREHENSIVE_EXTENSION_MAP['.js']).toBe('text/javascript');
    expect(COMPREHENSIVE_EXTENSION_MAP['.ts']).toBe('text/x-typescript');
    expect(COMPREHENSIVE_EXTENSION_MAP['.md']).toBe('text/markdown');
    expect(COMPREHENSIVE_EXTENSION_MAP['.json']).toBe('application/json');
  });

  it('should have all keys lowercase with leading dots', () => {
    for (const key of Object.keys(COMPREHENSIVE_EXTENSION_MAP)) {
      expect(key).toMatch(/^\./);
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('should have at least 180 entries', () => {
    expect(Object.keys(COMPREHENSIVE_EXTENSION_MAP).length).toBeGreaterThanOrEqual(180);
  });
});

describe('getMimeToExtensionsMap', () => {
  it('should return correct extensions for image/jpeg', () => {
    const map = getMimeToExtensionsMap();
    const exts = map.get('image/jpeg');
    expect(exts).toBeDefined();
    expect(exts).toContain('.jpg');
    expect(exts).toContain('.jpeg');
  });

  it('should return correct extensions for text/plain', () => {
    const map = getMimeToExtensionsMap();
    const exts = map.get('text/plain');
    expect(exts).toBeDefined();
    expect(exts).toContain('.txt');
    expect(exts).toContain('.log');
  });

  it('should return correct extensions for audio/mpeg', () => {
    const map = getMimeToExtensionsMap();
    const exts = map.get('audio/mpeg');
    expect(exts).toBeDefined();
    expect(exts).toContain('.mp3');
  });

  it('should be cached (same instance on repeated calls)', () => {
    const map1 = getMimeToExtensionsMap();
    const map2 = getMimeToExtensionsMap();
    expect(map1).toBe(map2);
  });

  it('should cover all MIME types from the extension map', () => {
    const map = getMimeToExtensionsMap();
    const uniqueMimes = new Set(Object.values(COMPREHENSIVE_EXTENSION_MAP));
    expect(map.size).toBe(uniqueMimes.size);
  });
});
