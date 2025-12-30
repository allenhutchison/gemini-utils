# @allenhutchison/gemini-utils

Shared utilities for Google Gemini AI projects. Provides file upload, MIME validation, operation tracking for the Gemini File Search API, and deep research capabilities.

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
- **Deep Research**: Run long-running research tasks with Gemini's deep research models
- **Report Generation**: Convert research outputs to formatted Markdown with citations

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

### Deep Research

```typescript
import { GoogleGenAI } from '@google/genai';
import { ResearchManager, ReportGenerator } from '@allenhutchison/gemini-utils';

const client = new GoogleGenAI({ apiKey: 'your-api-key' });
const researcher = new ResearchManager(client);

// Start a research task
const interaction = await researcher.startResearch({
  input: 'What are the latest developments in quantum computing?',
  // Optional: ground with file search stores
  fileSearchStoreNames: ['stores/my-documents'],
});

// Poll until complete
const completed = await researcher.poll(interaction.id);

// Generate a markdown report with citations
const generator = new ReportGenerator();
const report = generator.generateMarkdown(completed.outputs ?? []);
console.log(report);
```

### Research with Custom Polling

```typescript
import { ResearchManager, isTerminalStatus } from '@allenhutchison/gemini-utils';

const researcher = new ResearchManager(client);

const interaction = await researcher.startResearch({
  input: 'Analyze the impact of AI on healthcare',
});

// Custom polling with status updates
let status = await researcher.getStatus(interaction.id);
while (!isTerminalStatus(status.status ?? '')) {
  console.log(`Status: ${status.status}`);
  await new Promise(r => setTimeout(r, 10000));
  status = await researcher.getStatus(interaction.id);
}

if (status.status === 'completed') {
  console.log('Research complete!');
} else if (status.status === 'failed') {
  console.log('Research failed');
}
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

### ResearchManager

Manages deep research interactions with the Gemini API.

- `startResearch(params)` - Start a new research interaction
- `getStatus(id)` - Get current status and outputs of an interaction
- `poll(id, intervalMs?)` - Poll until research completes (default: 5s interval)
- `cancel(id)` - Cancel a running research interaction
- `delete(id)` - Delete a research interaction

### ReportGenerator

Converts research outputs to formatted documents.

- `generateMarkdown(outputs)` - Generate markdown report with citations

### Research Types

- `StartResearchParams` - Configuration for starting research
- `Interaction` - Research interaction object
- `InteractionStatus` - Status types: `in_progress`, `requires_action`, `completed`, `failed`, `cancelled`
- `isTerminalStatus(status)` - Check if status indicates completion
- `TERMINAL_STATUSES` - Array of terminal status values

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
