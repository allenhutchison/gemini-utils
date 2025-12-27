# @allenhutchison/gemini-utils

Shared utilities for Google Gemini AI projects. Provides file upload, MIME validation, and operation tracking for the Gemini File Search API.

## Installation

```bash
npm install @allenhutchison/gemini-utils @google/genai
```

## Features

- **File Upload**: Upload files and directories to Gemini File Search stores
- **Smart Sync**: Skip unchanged files using SHA-256 hash comparison
- **MIME Validation**: Comprehensive MIME type detection with fallback support
- **Progress Tracking**: Real-time progress callbacks for upload operations
- **Operation Management**: Track long-running upload operations with customizable storage

## Usage

### Basic File Upload

```typescript
import { GoogleGenAI } from '@google/genai';
import { FileUploader, FileSearchManager } from '@allenhutchison/gemini-utils';

const client = new GoogleGenAI({ apiKey: 'your-api-key' });

// Create a file search store
const manager = new FileSearchManager(client);
const store = await manager.createStore('My Documents');

// Upload a directory
const uploader = new FileUploader(client);
await uploader.uploadDirectory('./docs', store.name, {
  smartSync: true,
  onProgress: (event) => {
    console.log(`${event.type}: ${event.currentFile} (${event.percentage}%)`);
  },
});
```

### MIME Type Validation

```typescript
import {
  getMimeTypeWithFallback,
  isExtensionSupportedWithFallback
} from '@allenhutchison/gemini-utils';

// Check if a file type is supported
if (isExtensionSupportedWithFallback('.ts')) {
  const result = getMimeTypeWithFallback('app.ts');
  console.log(result); // { mimeType: 'text/plain', isFallback: true }
}
```

### Operation Tracking

```typescript
import { UploadOperationManager } from '@allenhutchison/gemini-utils';

const manager = new UploadOperationManager();

// Create an operation
const op = manager.createOperation('/path/to/files', 'storeName', true);

// Update progress
manager.updateProgress(op.id, 5, 2, 0);

// Mark complete
manager.markCompleted(op.id);
```

### Custom Storage for Operations

```typescript
import { UploadOperationManager, OperationStorage, UploadOperation } from '@allenhutchison/gemini-utils';

// Implement your own storage
class MyStorage implements OperationStorage {
  private db: Map<string, UploadOperation> = new Map();

  get(id: string) { return this.db.get(id); }
  set(id: string, op: UploadOperation) { this.db.set(id, op); }
  getAll() { return Object.fromEntries(this.db); }
}

const manager = new UploadOperationManager(new MyStorage());
```

## API Reference

### FileSearchManager

Manages file search stores in Google's Gemini API.

- `createStore(displayName)` - Create a new store
- `listStores()` - List all stores
- `getStore(name)` - Get a store by name
- `deleteStore(name, force?)` - Delete a store
- `queryStore(storeName, query, model?)` - Query a store
- `listDocuments(storeName)` - List documents in a store
- `deleteDocument(documentName)` - Delete a document

### FileUploader

Handles file uploads to Gemini File Search stores.

- `uploadFile(filePath, storeName, config?)` - Upload a single file
- `uploadDirectory(dirPath, storeName, config?)` - Upload a directory
- `getExistingFileHashes(storeName)` - Get hashes for smart sync
- `getFileHash(filePath)` - Compute SHA-256 hash of a file

### MIME Utilities

- `getMimeType(filePath)` - Get validated MIME type
- `getMimeTypeWithFallback(filePath)` - Get MIME type with text/plain fallback
- `isExtensionSupported(ext)` - Check if extension is supported
- `isExtensionSupportedWithFallback(ext)` - Check including fallback extensions
- `getSupportedExtensions()` - List all supported extensions
- `getFallbackExtensions()` - List fallback extensions

### Error Classes

- `UnsupportedFileTypeError` - Thrown for unsupported file types
- `FileSizeExceededError` - Thrown when file exceeds 100MB limit
- `FileUploadError` - Wrapper for upload failures

## Supported File Types

The library supports 36 validated MIME types plus 100+ text file extensions via fallback:

**Validated types**: PDF, XML, HTML, Markdown, C, Java, Python, Go, Kotlin, Perl, Lua, Erlang, TCL, BibTeX, diff

**Fallback (as text/plain)**: JavaScript, TypeScript, JSON, CSS, SCSS, YAML, TOML, Shell scripts, Ruby, PHP, Rust, Swift, Scala, and many more.

## License

MIT
