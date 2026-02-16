#!/usr/bin/env npx tsx
/**
 * MIME Type Probe Script
 *
 * Probes the Gemini API to discover which MIME types are actually supported
 * for two upload methods:
 *   1. Inline base64 (via generateContent with inlineData)
 *   2. File API upload (via client.files.upload)
 *
 * The Gemini documentation is often stale, so this script manually verifies
 * what actually works by attempting real API calls with minimal sample files.
 *
 * Usage:
 *   npm run test:probe-mime-types
 *   npx tsx scripts/probe-mime-types.ts
 *   npx tsx scripts/probe-mime-types.ts --method inline
 *   npx tsx scripts/probe-mime-types.ts --method file-api
 *   npx tsx scripts/probe-mime-types.ts --category image
 *   npx tsx scripts/probe-mime-types.ts --model gemini-3-flash-preview
 *   npx tsx scripts/probe-mime-types.ts --model gemini-3-flash-preview,gemini-2.0-flash
 *
 * Environment:
 *   GEMINI_API_KEY - Required Gemini API key
 *
 * Output:
 *   - Console report with summary
 *   - JSON report saved to scripts/probe-mime-types-report.json
 *   - Support matrix saved to src/generated/gemini-support-matrix.json
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { realpathSync } from 'fs';
import type { ErrorClass } from '../src/support-registry/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface MimeTypeEntry {
  mimeType: string;
  extension: string;
  category: string;
  /** Description of the content type */
  description: string;
  /** Whether this requires binary content (vs text) */
  binary: boolean;
}

interface ProbeResult {
  mimeType: string;
  extension: string;
  category: string;
  description: string;
  inline: TestOutcome;
  fileApi: TestOutcome;
}

interface TestOutcome {
  status: 'pass' | 'fail' | 'skip';
  message: string;
  durationMs?: number;
  errorClass?: ErrorClass;
}

interface ProbeReport {
  timestamp: string;
  model: string;
  totalMimeTypes: number;
  methods: {
    inline: { passed: number; failed: number; skipped: number };
    fileApi: { passed: number; failed: number; skipped: number };
  };
  results: ProbeResult[];
  durationMs: number;
}

interface MultiModelProbeReport {
  timestamp: string;
  models: string[];
  modelReports: Record<string, ProbeReport>;
  durationMs: number;
}

/** Shape of each entry in the generated support matrix. */
interface MatrixEntry {
  category: string;
  extension: string;
  description: string;
  models: Record<string, {
    inline: boolean;
    fileApi: boolean;
    inlineErrorClass?: ErrorClass;
    fileApiErrorClass?: ErrorClass;
  }>;
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(message: string): ErrorClass {
  const lower = message.toLowerCase();

  if (lower.includes('which is not supported') && lower.includes('mimetype')) {
    return 'mime_rejected';
  }
  if (lower.includes('is not supported. update the mimetype')) {
    return 'mime_rejected';
  }
  if (lower.includes('not valid') || lower.includes('provided image is not valid')) {
    return 'content_invalid';
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 'rate_limited';
  }

  return 'unknown';
}

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;
  private readonly maxRetries: number;

  constructor(maxPerMinute = 30, maxRetries = 3) {
    this.maxPerMinute = maxPerMinute;
    this.maxRetries = maxRetries;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 1 minute
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = 60_000 - (now - oldestInWindow) + 100;
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
    }

    this.timestamps.push(Date.now());
    // Small delay between requests
    await this.sleep(200);
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.acquire();
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        const msg = (error as Error)?.message ?? String(error);
        if (classifyError(msg) === 'rate_limited' && attempt < this.maxRetries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.log(`\n  Rate limited, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${this.maxRetries})...`);
          await this.sleep(backoff);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Comprehensive MIME type catalog
// ============================================================================

const MIME_TYPE_CATALOG: MimeTypeEntry[] = [
  // --- Images ---
  { mimeType: 'image/png', extension: '.png', category: 'image', description: 'PNG image', binary: true },
  { mimeType: 'image/jpeg', extension: '.jpg', category: 'image', description: 'JPEG image', binary: true },
  { mimeType: 'image/gif', extension: '.gif', category: 'image', description: 'GIF image', binary: true },
  { mimeType: 'image/webp', extension: '.webp', category: 'image', description: 'WebP image', binary: true },
  { mimeType: 'image/bmp', extension: '.bmp', category: 'image', description: 'BMP image', binary: true },
  { mimeType: 'image/tiff', extension: '.tiff', category: 'image', description: 'TIFF image', binary: true },
  { mimeType: 'image/svg+xml', extension: '.svg', category: 'image', description: 'SVG image', binary: false },
  { mimeType: 'image/x-icon', extension: '.ico', category: 'image', description: 'ICO icon', binary: true },
  { mimeType: 'image/heic', extension: '.heic', category: 'image', description: 'HEIC image', binary: true },
  { mimeType: 'image/heif', extension: '.heif', category: 'image', description: 'HEIF image', binary: true },
  { mimeType: 'image/avif', extension: '.avif', category: 'image', description: 'AVIF image', binary: true },

  // --- Audio ---
  { mimeType: 'audio/mpeg', extension: '.mp3', category: 'audio', description: 'MP3 audio', binary: true },
  { mimeType: 'audio/wav', extension: '.wav', category: 'audio', description: 'WAV audio', binary: true },
  { mimeType: 'audio/flac', extension: '.flac', category: 'audio', description: 'FLAC audio', binary: true },
  { mimeType: 'audio/aac', extension: '.aac', category: 'audio', description: 'AAC audio', binary: true },
  { mimeType: 'audio/ogg', extension: '.ogg', category: 'audio', description: 'OGG audio', binary: true },
  { mimeType: 'audio/mp4', extension: '.m4a', category: 'audio', description: 'M4A audio', binary: true },
  { mimeType: 'audio/webm', extension: '.weba', category: 'audio', description: 'WebM audio', binary: true },
  { mimeType: 'audio/x-aiff', extension: '.aiff', category: 'audio', description: 'AIFF audio', binary: true },
  { mimeType: 'audio/opus', extension: '.opus', category: 'audio', description: 'Opus audio', binary: true },
  { mimeType: 'audio/amr', extension: '.amr', category: 'audio', description: 'AMR audio', binary: true },
  { mimeType: 'audio/midi', extension: '.mid', category: 'audio', description: 'MIDI audio', binary: true },

  // --- Video ---
  { mimeType: 'video/mp4', extension: '.mp4', category: 'video', description: 'MP4 video', binary: true },
  { mimeType: 'video/webm', extension: '.webm', category: 'video', description: 'WebM video', binary: true },
  { mimeType: 'video/quicktime', extension: '.mov', category: 'video', description: 'QuickTime video', binary: true },
  { mimeType: 'video/x-msvideo', extension: '.avi', category: 'video', description: 'AVI video', binary: true },
  { mimeType: 'video/mpeg', extension: '.mpeg', category: 'video', description: 'MPEG video', binary: true },
  { mimeType: 'video/x-matroska', extension: '.mkv', category: 'video', description: 'MKV video', binary: true },
  { mimeType: 'video/x-flv', extension: '.flv', category: 'video', description: 'FLV video', binary: true },
  { mimeType: 'video/3gpp', extension: '.3gp', category: 'video', description: '3GP video', binary: true },
  { mimeType: 'video/3gpp2', extension: '.3g2', category: 'video', description: '3GP2 video', binary: true },
  { mimeType: 'video/x-ms-wmv', extension: '.wmv', category: 'video', description: 'WMV video', binary: true },

  // --- Documents ---
  { mimeType: 'application/pdf', extension: '.pdf', category: 'document', description: 'PDF document', binary: true },
  { mimeType: 'application/msword', extension: '.doc', category: 'document', description: 'Word document (legacy)', binary: true },
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx', category: 'document', description: 'Word document (OOXML)', binary: true },
  { mimeType: 'application/vnd.ms-excel', extension: '.xls', category: 'document', description: 'Excel spreadsheet (legacy)', binary: true },
  { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx', category: 'document', description: 'Excel spreadsheet (OOXML)', binary: true },
  { mimeType: 'application/vnd.ms-powerpoint', extension: '.ppt', category: 'document', description: 'PowerPoint (legacy)', binary: true },
  { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: '.pptx', category: 'document', description: 'PowerPoint (OOXML)', binary: true },
  { mimeType: 'application/rtf', extension: '.rtf', category: 'document', description: 'Rich Text Format', binary: false },
  { mimeType: 'application/epub+zip', extension: '.epub', category: 'document', description: 'EPUB ebook', binary: true },

  // --- Text / Code ---
  { mimeType: 'text/plain', extension: '.txt', category: 'text', description: 'Plain text', binary: false },
  { mimeType: 'text/html', extension: '.html', category: 'text', description: 'HTML', binary: false },
  { mimeType: 'text/css', extension: '.css', category: 'text', description: 'CSS stylesheet', binary: false },
  { mimeType: 'text/csv', extension: '.csv', category: 'text', description: 'CSV data', binary: false },
  { mimeType: 'text/markdown', extension: '.md', category: 'text', description: 'Markdown', binary: false },
  { mimeType: 'text/xml', extension: '.xml', category: 'text', description: 'XML', binary: false },
  { mimeType: 'text/x-python', extension: '.py', category: 'text', description: 'Python source', binary: false },
  { mimeType: 'text/javascript', extension: '.js', category: 'text', description: 'JavaScript source', binary: false },
  { mimeType: 'text/x-typescript', extension: '.ts', category: 'text', description: 'TypeScript source', binary: false },
  { mimeType: 'text/x-c', extension: '.c', category: 'text', description: 'C source', binary: false },
  { mimeType: 'text/x-c++src', extension: '.cpp', category: 'text', description: 'C++ source', binary: false },
  { mimeType: 'text/x-java', extension: '.java', category: 'text', description: 'Java source', binary: false },
  { mimeType: 'text/x-go', extension: '.go', category: 'text', description: 'Go source', binary: false },
  { mimeType: 'text/x-rust', extension: '.rs', category: 'text', description: 'Rust source', binary: false },
  { mimeType: 'text/x-ruby', extension: '.rb', category: 'text', description: 'Ruby source', binary: false },
  { mimeType: 'text/x-php', extension: '.php', category: 'text', description: 'PHP source', binary: false },
  { mimeType: 'text/x-swift', extension: '.swift', category: 'text', description: 'Swift source', binary: false },
  { mimeType: 'text/x-kotlin', extension: '.kt', category: 'text', description: 'Kotlin source', binary: false },
  { mimeType: 'text/x-scala', extension: '.scala', category: 'text', description: 'Scala source', binary: false },
  { mimeType: 'text/x-perl', extension: '.pl', category: 'text', description: 'Perl source', binary: false },
  { mimeType: 'text/x-lua', extension: '.lua', category: 'text', description: 'Lua source', binary: false },
  { mimeType: 'text/x-erlang', extension: '.erl', category: 'text', description: 'Erlang source', binary: false },
  { mimeType: 'text/x-haskell', extension: '.hs', category: 'text', description: 'Haskell source', binary: false },
  { mimeType: 'text/x-clojure', extension: '.clj', category: 'text', description: 'Clojure source', binary: false },
  { mimeType: 'text/x-elixir', extension: '.ex', category: 'text', description: 'Elixir source', binary: false },
  { mimeType: 'text/x-shellscript', extension: '.sh', category: 'text', description: 'Shell script', binary: false },
  { mimeType: 'text/x-sql', extension: '.sql', category: 'text', description: 'SQL', binary: false },
  { mimeType: 'text/x-diff', extension: '.diff', category: 'text', description: 'Diff/patch', binary: false },
  { mimeType: 'text/x-yaml', extension: '.yaml', category: 'text', description: 'YAML', binary: false },
  { mimeType: 'text/x-toml', extension: '.toml', category: 'text', description: 'TOML', binary: false },

  // --- Structured data ---
  { mimeType: 'application/json', extension: '.json', category: 'data', description: 'JSON', binary: false },
  { mimeType: 'application/xml', extension: '.xmldata', category: 'data', description: 'XML data', binary: false },
  { mimeType: 'application/x-yaml', extension: '.yamldata', category: 'data', description: 'YAML data', binary: false },
  { mimeType: 'application/graphql', extension: '.graphql', category: 'data', description: 'GraphQL', binary: false },
  { mimeType: 'application/ld+json', extension: '.jsonld', category: 'data', description: 'JSON-LD', binary: false },

  // --- Archives (likely unsupported, but worth probing) ---
  { mimeType: 'application/zip', extension: '.zip', category: 'archive', description: 'ZIP archive', binary: true },
  { mimeType: 'application/gzip', extension: '.gz', category: 'archive', description: 'GZIP archive', binary: true },
  { mimeType: 'application/x-tar', extension: '.tar', category: 'archive', description: 'TAR archive', binary: true },

  // --- Fonts ---
  { mimeType: 'font/woff', extension: '.woff', category: 'font', description: 'WOFF font', binary: true },
  { mimeType: 'font/woff2', extension: '.woff2', category: 'font', description: 'WOFF2 font', binary: true },
  { mimeType: 'font/ttf', extension: '.ttf', category: 'font', description: 'TrueType font', binary: true },
  { mimeType: 'font/otf', extension: '.otf', category: 'font', description: 'OpenType font', binary: true },

  // --- Other application types ---
  { mimeType: 'application/javascript', extension: '.mjs', category: 'application', description: 'JavaScript (application)', binary: false },
  { mimeType: 'application/typescript', extension: '.mts', category: 'application', description: 'TypeScript (application)', binary: false },
  { mimeType: 'application/wasm', extension: '.wasm', category: 'application', description: 'WebAssembly', binary: true },
  { mimeType: 'application/octet-stream', extension: '.bin', category: 'application', description: 'Binary data', binary: true },
];

// ============================================================================
// Sample content generators
// ============================================================================

/**
 * Creates minimal valid sample content for a given MIME type.
 * For binary formats, creates the smallest valid file possible.
 * For text formats, creates simple sample text content.
 */
function createSampleContent(entry: MimeTypeEntry): Buffer {
  if (!entry.binary) {
    return createTextContent(entry);
  }
  return createBinaryContent(entry);
}

function createTextContent(entry: MimeTypeEntry): Buffer {
  const samples: Record<string, string> = {
    'text/plain': 'Hello, world. This is a test file.\n',
    'text/html': '<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello</p></body></html>',
    'text/css': 'body { color: black; background: white; }',
    'text/csv': 'name,age,city\nAlice,30,NYC\nBob,25,LA\n',
    'text/markdown': '# Test\n\nThis is a **test** markdown file.\n',
    'text/xml': '<?xml version="1.0"?><root><item>test</item></root>',
    'text/x-python': 'def hello():\n    print("Hello, world!")\n\nhello()\n',
    'text/javascript': 'function hello() { console.log("Hello, world!"); }\nhello();\n',
    'text/x-typescript': 'function hello(): void { console.log("Hello, world!"); }\nhello();\n',
    'text/x-c': '#include <stdio.h>\nint main() { printf("Hello\\n"); return 0; }\n',
    'text/x-c++src': '#include <iostream>\nint main() { std::cout << "Hello" << std::endl; return 0; }\n',
    'text/x-java': 'public class Test { public static void main(String[] args) { System.out.println("Hello"); } }\n',
    'text/x-go': 'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello") }\n',
    'text/x-rust': 'fn main() { println!("Hello, world!"); }\n',
    'text/x-ruby': 'puts "Hello, world!"\n',
    'text/x-php': '<?php echo "Hello, world!"; ?>\n',
    'text/x-swift': 'print("Hello, world!")\n',
    'text/x-kotlin': 'fun main() { println("Hello, world!") }\n',
    'text/x-scala': 'object Main extends App { println("Hello, world!") }\n',
    'text/x-perl': 'print "Hello, world!\\n";\n',
    'text/x-lua': 'print("Hello, world!")\n',
    'text/x-erlang': '-module(hello).\n-export([hello/0]).\nhello() -> io:format("Hello~n").\n',
    'text/x-haskell': 'main :: IO ()\nmain = putStrLn "Hello, world!"\n',
    'text/x-clojure': '(println "Hello, world!")\n',
    'text/x-elixir': 'IO.puts "Hello, world!"\n',
    'text/x-shellscript': '#!/bin/bash\necho "Hello, world!"\n',
    'text/x-sql': 'SELECT 1 AS test;\n',
    'text/x-diff': '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n',
    'text/x-yaml': 'name: test\nversion: 1.0\n',
    'text/x-toml': '[package]\nname = "test"\nversion = "1.0"\n',
    'application/json': '{"name": "test", "version": 1}',
    'application/xml': '<?xml version="1.0"?><root><item>test</item></root>',
    'application/x-yaml': 'name: test\nversion: 1.0\n',
    'application/graphql': 'query { user { name email } }',
    'application/ld+json': '{"@context": "https://schema.org", "@type": "Thing", "name": "Test"}',
    'application/javascript': 'export function hello() { console.log("Hello"); }\n',
    'application/typescript': 'export function hello(): void { console.log("Hello"); }\n',
    'application/rtf': '{\\rtf1\\ansi Hello, world!}',
    'image/svg+xml': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
  };

  const content = samples[entry.mimeType] || `Sample content for ${entry.mimeType} testing.\n`;
  return Buffer.from(content, 'utf-8');
}

function createBinaryContent(entry: MimeTypeEntry): Buffer {
  switch (entry.mimeType) {
    case 'image/png':
      return createMinimalPng();
    case 'image/jpeg':
      return createMinimalJpeg();
    case 'image/gif':
      return createMinimalGif();
    case 'image/webp':
      return createMinimalWebp();
    case 'image/bmp':
      return createMinimalBmp();
    case 'image/tiff':
      return createMinimalTiff();
    case 'application/pdf':
      return Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj xref 0 4 trailer<</Size 4/Root 1 0 R>>startxref 0 %%EOF'
      );
    case 'audio/wav':
      return createMinimalWav();
    case 'audio/mpeg':
      return createMinimalMp3();
    default:
      // For binary types we can't easily generate valid content for,
      // create a small buffer with the appropriate magic bytes if known
      return createGenericBinaryContent(entry.mimeType);
  }
}

// Minimal 1x1 PNG (red pixel)
function createMinimalPng(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080200' +
    '00009001be00000000c49444154789c626460f80f0000010100' +
    '005a18d9a4000000004945ae4260820000',
    'hex'
  );
}

// Minimal JPEG (1x1 red pixel)
function createMinimalJpeg(): Buffer {
  // Smallest valid JPEG - verified even-length hex
  const hex =
    'ffd8ffe000104a46494600010100000100010000' +
    'ffdb004300080606070605080707070909080a0c' +
    '140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c' +
    '20242e2720222c231c1c2837292c30313434341f' +
    '27393d38323c2e333432' +
    'ffc0000b080001000101011100' +
    'ffc4001f0000010501010101010100000000000000000102030405060708090a0b' +
    'ffc40000ffc40000' +
    'ffda00080101003f007b400001' +
    'ffd9';
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid JPEG hex constant: odd length ${hex.length}`);
  }
  return Buffer.from(hex, 'hex');
}

// Minimal GIF (1x1)
function createMinimalGif(): Buffer {
  return Buffer.from(
    '47494638396101000100800000ffffff0000002c00000000010001000002024401003b',
    'hex'
  );
}

// Minimal WebP (1x1)
function createMinimalWebp(): Buffer {
  return Buffer.from(
    '524946462400000057454250565038200018000000300100009d012a0100010001' +
    '00034025a400030000fef39fa00000',
    'hex'
  );
}

// Minimal BMP (1x1 red pixel)
function createMinimalBmp(): Buffer {
  const buf = Buffer.alloc(58);
  // BM header
  buf.write('BM', 0);
  buf.writeUInt32LE(58, 2); // file size
  buf.writeUInt32LE(54, 10); // pixel data offset
  // DIB header (BITMAPINFOHEADER)
  buf.writeUInt32LE(40, 14); // header size
  buf.writeInt32LE(1, 18); // width
  buf.writeInt32LE(1, 22); // height
  buf.writeUInt16LE(1, 26); // color planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  // pixel data: blue=0, green=0, red=255, padding=0
  buf[54] = 0; buf[55] = 0; buf[56] = 255; buf[57] = 0;
  return buf;
}

// Minimal TIFF (1x1)
function createMinimalTiff(): Buffer {
  // Little-endian TIFF with 1x1 pixel
  const buf = Buffer.alloc(122);
  // Header
  buf.write('II', 0); // little-endian
  buf.writeUInt16LE(42, 2); // magic
  buf.writeUInt32LE(8, 4); // offset to first IFD

  // IFD with 8 entries at offset 8
  let offset = 8;
  buf.writeUInt16LE(8, offset); offset += 2; // number of entries

  // ImageWidth (256) = 1
  buf.writeUInt16LE(256, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;
  // ImageLength (257) = 1
  buf.writeUInt16LE(257, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;
  // BitsPerSample (258) = 8
  buf.writeUInt16LE(258, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(8, offset+8); offset += 12;
  // Compression (259) = 1 (none)
  buf.writeUInt16LE(259, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;
  // PhotometricInterpretation (262) = 1 (black is zero)
  buf.writeUInt16LE(262, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;
  // StripOffsets (273) - point to pixel data
  buf.writeUInt16LE(273, offset); buf.writeUInt16LE(4, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(120, offset+8); offset += 12;
  // RowsPerStrip (278) = 1
  buf.writeUInt16LE(278, offset); buf.writeUInt16LE(3, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;
  // StripByteCounts (279) = 1
  buf.writeUInt16LE(279, offset); buf.writeUInt16LE(4, offset+2); buf.writeUInt32LE(1, offset+4); buf.writeUInt32LE(1, offset+8); offset += 12;

  // Next IFD = 0
  buf.writeUInt32LE(0, offset);

  // Pixel data at offset 120
  buf[120] = 128; // gray pixel
  return buf;
}

// Minimal WAV (silence, 1 sample)
function createMinimalWav(): Buffer {
  const buf = Buffer.alloc(46);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(38, 4); // chunk size
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // subchunk1 size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(8000, 24); // sample rate
  buf.writeUInt32LE(16000, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(2, 40); // data size
  buf.writeInt16LE(0, 44); // one silent sample
  return buf;
}

// Minimal MP3 frame (silence)
function createMinimalMp3(): Buffer {
  // MP3 sync word + minimal frame header for MPEG1 Layer3 128kbps 44100Hz stereo
  // Frame header: 0xFFFB9004
  const frameHeader = Buffer.from('fffb9004', 'hex');
  // Pad with zeros for the frame body (417 bytes for 128kbps/44100Hz)
  const frameBody = Buffer.alloc(413);
  return Buffer.concat([frameHeader, frameBody]);
}

// Generic binary content with appropriate magic bytes
function createGenericBinaryContent(mimeType: string): Buffer {
  const magicBytes: Record<string, Buffer> = {
    'audio/flac': Buffer.from('664c614300000022', 'hex'), // fLaC + streaminfo header
    'audio/aac': Buffer.from('fff1508004', 'hex'), // AAC ADTS header
    'audio/ogg': Buffer.from('4f676753', 'hex'), // OggS
    'audio/mp4': Buffer.from('0000001c667479704d344120', 'hex'), // ftyp M4A
    'audio/webm': Buffer.from('1a45dfa3', 'hex'), // EBML header
    'audio/x-aiff': Buffer.from('464f524d00000000414946462020', 'hex'), // FORM...AIFF
    'audio/opus': Buffer.from('4f676753', 'hex'), // OggS
    'audio/amr': Buffer.from('2321414d520a', 'hex'), // #!AMR\n
    'audio/midi': Buffer.from('4d546864', 'hex'), // MThd
    'video/mp4': Buffer.from('000000186674797069736f6d', 'hex'), // ftyp isom
    'video/webm': Buffer.from('1a45dfa3', 'hex'), // EBML header
    'video/quicktime': Buffer.from('0000001466747970717420', 'hex'), // ftyp qt
    'video/x-msvideo': Buffer.from('524946460000000041564920', 'hex'), // RIFF...AVI
    'video/mpeg': Buffer.from('000001ba', 'hex'), // MPEG PS
    'video/x-matroska': Buffer.from('1a45dfa3', 'hex'), // EBML header
    'video/x-flv': Buffer.from('464c5601', 'hex'), // FLV\x01
    'video/3gpp': Buffer.from('0000001866747970336770', 'hex'), // ftyp 3gp
    'video/3gpp2': Buffer.from('0000001866747970336732', 'hex'), // ftyp 3g2
    'video/x-ms-wmv': Buffer.from('3026b2758e66cf11', 'hex'), // ASF header
    'application/msword': Buffer.from('d0cf11e0a1b11ae1', 'hex'), // OLE2
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': Buffer.from('504b0304', 'hex'), // PK zip
    'application/vnd.ms-excel': Buffer.from('d0cf11e0a1b11ae1', 'hex'), // OLE2
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': Buffer.from('504b0304', 'hex'), // PK zip
    'application/vnd.ms-powerpoint': Buffer.from('d0cf11e0a1b11ae1', 'hex'), // OLE2
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': Buffer.from('504b0304', 'hex'), // PK zip
    'application/epub+zip': Buffer.from('504b0304', 'hex'), // PK zip
    'application/zip': Buffer.from('504b0304', 'hex'), // PK zip
    'application/gzip': Buffer.from('1f8b0800', 'hex'), // gzip
    'application/x-tar': Buffer.alloc(512), // tar needs 512-byte blocks
    'application/wasm': Buffer.from('0061736d01000000', 'hex'), // \0asm
    'image/x-icon': Buffer.from('00000100010001000100', 'hex'), // ICO header
    'image/heic': Buffer.from('0000001c667479706865696300', 'hex'), // ftyp heic
    'image/heif': Buffer.from('0000001c667479706d696631', 'hex'), // ftyp mif1
    'image/avif': Buffer.from('0000001c6674797061766966', 'hex'), // ftyp avif
    'font/woff': Buffer.from('774f4646', 'hex'), // wOFF
    'font/woff2': Buffer.from('774f4632', 'hex'), // wOF2
    'font/ttf': Buffer.from('0001000000', 'hex'), // TTF header
    'font/otf': Buffer.from('4f54544f00', 'hex'), // OTTO
  };

  const magic = magicBytes[mimeType];
  if (magic) {
    // Pad to at least 64 bytes to be more realistic
    const padding = Buffer.alloc(Math.max(0, 64 - magic.length));
    return Buffer.concat([magic, padding]);
  }

  // Fallback: 64 bytes of zeros
  return Buffer.alloc(64);
}

// ============================================================================
// Probe Engine
// ============================================================================

class MimeTypeProber {
  private client: GoogleGenAI;
  private model: string;
  private sampleDir: string;
  private results: ProbeResult[] = [];
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, model: string = 'gemini-3-flash-preview') {
    this.client = new GoogleGenAI({ apiKey, vertexai: false });
    this.model = model;
    this.sampleDir = path.join(__dirname, '.probe-samples');
    this.rateLimiter = new RateLimiter(30, 3);
  }

  async probe(options: {
    methods?: ('inline' | 'file-api')[];
    categories?: string[];
  } = {}): Promise<ProbeReport> {
    const startTime = Date.now();
    const methods = options.methods ?? ['inline', 'file-api'];
    const categories = options.categories;

    let entries = MIME_TYPE_CATALOG;
    if (categories) {
      entries = entries.filter(e => categories.includes(e.category));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('MIME Type Probe');
    console.log(`${'='.repeat(60)}`);
    console.log(`Model: ${this.model}`);
    console.log(`MIME types to test: ${entries.length}`);
    console.log(`Methods: ${methods.join(', ')}`);
    console.log(`${'='.repeat(60)}\n`);

    // Ensure sample directory exists
    if (!fs.existsSync(this.sampleDir)) {
      fs.mkdirSync(this.sampleDir, { recursive: true });
    }

    // Reset results for this probe run
    this.results = [];

    try {
      let count = 0;
      for (const entry of entries) {
        count++;
        process.stdout.write(`\r[${count}/${entries.length}] Testing ${entry.mimeType.padEnd(65)}`);

        const result: ProbeResult = {
          mimeType: entry.mimeType,
          extension: entry.extension,
          category: entry.category,
          description: entry.description,
          inline: { status: 'skip', message: 'Not tested' },
          fileApi: { status: 'skip', message: 'Not tested' },
        };

        const sampleContent = createSampleContent(entry);

        if (methods.includes('inline')) {
          result.inline = await this.testInline(entry, sampleContent);
        }

        if (methods.includes('file-api')) {
          result.fileApi = await this.testFileApi(entry, sampleContent);
        }

        this.results.push(result);
      }

      console.log('\r' + ' '.repeat(80) + '\r'); // Clear progress line
    } finally {
      // Cleanup sample directory
      if (fs.existsSync(this.sampleDir)) {
        fs.rmSync(this.sampleDir, { recursive: true, force: true });
      }
    }

    const duration = Date.now() - startTime;
    return this.generateReport(duration);
  }

  /**
   * Test inline base64 upload via generateContent
   */
  private async testInline(entry: MimeTypeEntry, content: Buffer): Promise<TestOutcome> {
    const start = Date.now();
    try {
      const base64Data = content.toString('base64');

      await this.rateLimiter.withRetry(async () => {
        await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: entry.mimeType,
                    data: base64Data,
                  },
                },
                { text: 'Acknowledge this file with one word: OK' },
              ],
            },
          ],
        });
      });

      return {
        status: 'pass',
        message: 'Accepted as inline base64',
        durationMs: Date.now() - start,
      };
    } catch (error: unknown) {
      const message = sanitizeError(error);
      return {
        status: 'fail',
        message,
        durationMs: Date.now() - start,
        errorClass: classifyError(message),
      };
    }
  }

  /**
   * Test File API upload via client.files.upload
   */
  private async testFileApi(entry: MimeTypeEntry, content: Buffer): Promise<TestOutcome> {
    const start = Date.now();
    const filePath = path.join(this.sampleDir, `test${entry.extension}`);
    let uploadedFileName: string | undefined;

    try {
      // Write sample file to disk
      fs.writeFileSync(filePath, content);

      const file = await this.rateLimiter.withRetry(async () => {
        return await this.client.files.upload({
          file: filePath,
          config: {
            mimeType: entry.mimeType,
            displayName: `probe-test${entry.extension}`,
          },
        });
      });

      uploadedFileName = file.name;

      return {
        status: 'pass',
        message: 'Accepted by File API',
        durationMs: Date.now() - start,
      };
    } catch (error: unknown) {
      const message = sanitizeError(error);
      return {
        status: 'fail',
        message,
        durationMs: Date.now() - start,
        errorClass: classifyError(message),
      };
    } finally {
      // Cleanup: delete the uploaded file from the API
      if (uploadedFileName) {
        try {
          await this.client.files.delete({ name: uploadedFileName });
        } catch {
          // Ignore cleanup errors
        }
      }
      // Cleanup: delete local temp file
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private generateReport(durationMs: number): ProbeReport {
    const inline = { passed: 0, failed: 0, skipped: 0 };
    const fileApi = { passed: 0, failed: 0, skipped: 0 };

    for (const r of this.results) {
      if (r.inline.status === 'pass') inline.passed++;
      else if (r.inline.status === 'fail') inline.failed++;
      else inline.skipped++;

      if (r.fileApi.status === 'pass') fileApi.passed++;
      else if (r.fileApi.status === 'fail') fileApi.failed++;
      else fileApi.skipped++;
    }

    return {
      timestamp: new Date().toISOString(),
      model: this.model,
      totalMimeTypes: this.results.length,
      methods: { inline, fileApi },
      results: this.results,
      durationMs,
    };
  }
}

// ============================================================================
// Matrix Generation
// ============================================================================

/**
 * Transform probe reports into the support matrix JSON.
 * - content_invalid errors are treated as "likely supported" (content was bad, not the type).
 * - Sorted by MIME type key for deterministic diffs.
 */
function generateSupportMatrix(
  modelReports: Record<string, ProbeReport>
): Record<string, MatrixEntry> {
  const matrix: Record<string, MatrixEntry> = {};

  for (const [modelName, report] of Object.entries(modelReports)) {
    for (const result of report.results) {
      if (!matrix[result.mimeType]) {
        matrix[result.mimeType] = {
          category: result.category,
          extension: result.extension,
          description: result.description,
          models: {},
        };
      }

      const inlineSupported =
        result.inline.status === 'pass' ||
        result.inline.errorClass === 'content_invalid';
      const fileApiSupported =
        result.fileApi.status === 'pass' ||
        result.fileApi.errorClass === 'content_invalid';

      matrix[result.mimeType].models[modelName] = {
        inline: inlineSupported,
        fileApi: fileApiSupported,
        ...(result.inline.status === 'fail' && result.inline.errorClass
          ? { inlineErrorClass: result.inline.errorClass }
          : {}),
        ...(result.fileApi.status === 'fail' && result.fileApi.errorClass
          ? { fileApiErrorClass: result.fileApi.errorClass }
          : {}),
      };
    }
  }

  // Sort by MIME type key for deterministic diffs
  const sorted: Record<string, MatrixEntry> = {};
  for (const key of Object.keys(matrix).sort()) {
    sorted[key] = matrix[key];
  }

  return sorted;
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeError(error: unknown): string {
  const msg = (error as Error)?.message ?? String(error);
  // Truncate very long error messages
  return msg.length > 300 ? msg.substring(0, 300) + '...' : msg;
}

function printReport(report: ProbeReport): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log('MIME Type Probe Report');
  console.log(`${'='.repeat(70)}\n`);

  console.log(`Timestamp:       ${report.timestamp}`);
  console.log(`Model:           ${report.model}`);
  console.log(`Total tested:    ${report.totalMimeTypes}`);
  console.log(`Duration:        ${(report.durationMs / 1000).toFixed(1)}s\n`);

  // Summary table
  console.log('Method Summary:');
  console.log(`  Inline (base64): ${report.methods.inline.passed} pass, ${report.methods.inline.failed} fail, ${report.methods.inline.skipped} skip`);
  console.log(`  File API:        ${report.methods.fileApi.passed} pass, ${report.methods.fileApi.failed} fail, ${report.methods.fileApi.skipped} skip`);
  console.log();

  // Results by category
  const categories = [...new Set(report.results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = report.results.filter(r => r.category === cat);
    console.log(`\n--- ${cat.toUpperCase()} ---`);
    console.log(`${'MIME Type'.padEnd(55)} ${'Inline'.padEnd(10)} ${'File API'.padEnd(10)}`);
    console.log(`${'-'.repeat(55)} ${'-'.repeat(10)} ${'-'.repeat(10)}`);

    for (const r of catResults) {
      const inlineIcon = r.inline.status === 'pass' ? 'PASS' : r.inline.status === 'fail' ? 'FAIL' : 'SKIP';
      const fileIcon = r.fileApi.status === 'pass' ? 'PASS' : r.fileApi.status === 'fail' ? 'FAIL' : 'SKIP';
      console.log(`${r.mimeType.padEnd(55)} ${inlineIcon.padEnd(10)} ${fileIcon.padEnd(10)}`);
    }
  }

  // Failed details
  const inlineFails = report.results.filter(r => r.inline.status === 'fail');
  const fileApiFails = report.results.filter(r => r.fileApi.status === 'fail');

  if (inlineFails.length > 0) {
    console.log(`\n\n--- INLINE FAILURES (${inlineFails.length}) ---`);
    for (const r of inlineFails) {
      const cls = r.inline.errorClass ? ` [${r.inline.errorClass}]` : '';
      console.log(`  ${r.mimeType}${cls}: ${r.inline.message}`);
    }
  }

  if (fileApiFails.length > 0) {
    console.log(`\n\n--- FILE API FAILURES (${fileApiFails.length}) ---`);
    for (const r of fileApiFails) {
      const cls = r.fileApi.errorClass ? ` [${r.fileApi.errorClass}]` : '';
      console.log(`  ${r.mimeType}${cls}: ${r.fileApi.message}`);
    }
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function parseArgs(): {
  methods?: ('inline' | 'file-api')[];
  categories?: string[];
  models: string[];
} {
  const args = process.argv.slice(2);
  const options: {
    methods?: ('inline' | 'file-api')[];
    categories?: string[];
    models: string[];
  } = {
    models: ['gemini-3-flash-preview'],
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--method' && args[i + 1]) {
      const method = args[i + 1] as 'inline' | 'file-api';
      if (['inline', 'file-api'].includes(method)) {
        options.methods = [method];
      }
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      options.categories = args[i + 1].split(',').map(c => c.trim());
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      options.models = args[i + 1].split(',').map(m => m.trim());
      i++;
    }
  }

  return options;
}

function getApiKey(): string {
  // 1. Environment variables
  const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEEP_RESEARCH_API_KEY;
  if (envKey) return envKey;

  // 2. Config file (~/.config/gemini-utils/config.json)
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configPath = path.join(configDir, 'gemini-utils', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed.apiKey) return parsed.apiKey;
    } catch { /* ignore */ }
  }

  // 3. .env file (~/.config/gemini-utils/.env)
  const envPath = path.join(configDir, 'gemini-utils', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\n]+)/);
      if (match) return match[1].trim();
    } catch { /* ignore */ }
  }

  console.error('Error: API key not found.');
  console.error('Please set GEMINI_API_KEY env var or add it to ~/.config/gemini-utils/config.json');
  process.exit(1);
}

async function main() {
  const apiKey = getApiKey();
  const options = parseArgs();

  console.log('Starting MIME Type Probe...');
  console.log('This tests which MIME types the Gemini API actually accepts.\n');

  const overallStart = Date.now();
  const modelReports: Record<string, ProbeReport> = {};

  try {
    for (const model of options.models) {
      console.log(`\nProbing model: ${model}`);
      const prober = new MimeTypeProber(apiKey, model);
      const report = await prober.probe({
        methods: options.methods,
        categories: options.categories,
      });

      modelReports[model] = report;
      printReport(report);
    }

    const overallDuration = Date.now() - overallStart;

    // Build multi-model report
    const multiReport: MultiModelProbeReport = {
      timestamp: new Date().toISOString(),
      models: options.models,
      modelReports,
      durationMs: overallDuration,
    };

    // Save human-readable report (backward compatible)
    const reportPath = path.join(__dirname, 'probe-mime-types-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(multiReport, null, 2));
    console.log(`Report saved to: ${reportPath}`);

    // Generate and save support matrix
    const matrix = generateSupportMatrix(modelReports);
    const matrixPath = path.join(__dirname, '..', 'src', 'generated', 'gemini-support-matrix.json');
    fs.mkdirSync(path.dirname(matrixPath), { recursive: true });
    fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2) + '\n');
    console.log(`Support matrix saved to: ${matrixPath}`);

    // Summary
    const matrixEntries = Object.keys(matrix).length;
    const supportedInline = Object.values(matrix).filter(e =>
      Object.values(e.models).some(m => m.inline)
    ).length;
    const supportedFileApi = Object.values(matrix).filter(e =>
      Object.values(e.models).some(m => m.fileApi)
    ).length;
    console.log(`\nMatrix: ${matrixEntries} MIME types, ${supportedInline} inline-capable, ${supportedFileApi} file-api-capable`);

    // Exit with error code if everything failed
    const totalPassed = Object.values(modelReports).reduce(
      (sum, r) => sum + r.methods.inline.passed + r.methods.fileApi.passed,
      0
    );
    if (totalPassed === 0) {
      console.error('\nNo MIME types passed any test - check API key and connectivity.');
      process.exit(1);
    }
  } catch (error: unknown) {
    console.error('\nFatal error during probe:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule = (() => {
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url));
    const argPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
    return scriptPath === argPath;
  } catch {
    return false;
  }
})();
if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { MimeTypeProber, MIME_TYPE_CATALOG, RateLimiter, classifyError, generateSupportMatrix };
export type { ProbeReport, ProbeResult, MimeTypeEntry, TestOutcome, MultiModelProbeReport, ErrorClass };
