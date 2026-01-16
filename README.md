# @allenhutchison/gemini-utils

Shared utilities for Google Gemini AI projects. Provides file upload, MIME validation, operation tracking for the Gemini File Search API, deep research capabilities, and audio transcription.

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
- **Audio Transcription**: Transcribe audio files with timestamps, speaker diarization, and multiple output formats (text, SRT, VTT, JSON)
- **CLI**: Full-featured command-line interface for all operations

## CLI

Run commands directly with npx:

```bash
npx @allenhutchison/gemini-utils [command] [options]
```

### Global Options

```
-j, --json         Output in JSON format
-q, --quiet        Suppress non-essential output
--api-key <key>    API key (overrides GEMINI_API_KEY env var)
-v, --version      Show version number
-h, --help         Show help
```

### Configuration

The CLI looks for an API key in this order:
1. `--api-key` command line option
2. `GEMINI_API_KEY` environment variable
3. Config file at `~/.config/gemini-utils/config.json`:
   ```json
   { "apiKey": "your-api-key" }
   ```
4. Env file at `~/.config/gemini-utils/.env`:
   ```
   GEMINI_API_KEY=your-api-key
   ```

### Commands

#### Stores

```bash
# List all stores
npx @allenhutchison/gemini-utils stores list

# Create a new store
npx @allenhutchison/gemini-utils stores create "My Documents"

# Get store details
npx @allenhutchison/gemini-utils stores get stores/abc123

# Delete a store
npx @allenhutchison/gemini-utils stores delete stores/abc123
npx @allenhutchison/gemini-utils stores delete stores/abc123 --force
```

#### Upload

```bash
# Upload a single file
npx @allenhutchison/gemini-utils upload file ./document.pdf stores/abc123

# Upload a directory
npx @allenhutchison/gemini-utils upload directory ./docs stores/abc123

# Upload with smart sync (skip unchanged files)
npx @allenhutchison/gemini-utils upload directory ./docs stores/abc123 --smart-sync

# Control concurrency
npx @allenhutchison/gemini-utils upload directory ./docs stores/abc123 -c 10
```

#### Documents

```bash
# List documents in a store
npx @allenhutchison/gemini-utils documents list stores/abc123

# Get document details
npx @allenhutchison/gemini-utils documents get stores/abc123/documents/xyz789

# Delete a document
npx @allenhutchison/gemini-utils documents delete stores/abc123/documents/xyz789
```

#### Research

```bash
# Start research and get ID
npx @allenhutchison/gemini-utils research start "What is quantum computing?"

# Start and wait for completion
npx @allenhutchison/gemini-utils research start "What is quantum computing?" --wait

# Start, wait, and save report to file
npx @allenhutchison/gemini-utils research start "What is quantum computing?" --wait --output report.md

# Use file search stores for grounding
npx @allenhutchison/gemini-utils research start "Summarize the documents" --stores stores/abc123,stores/def456 --wait

# Check status
npx @allenhutchison/gemini-utils research status interactions/abc123

# Poll until complete
npx @allenhutchison/gemini-utils research poll interactions/abc123 --output report.md

# Cancel or delete
npx @allenhutchison/gemini-utils research cancel interactions/abc123
npx @allenhutchison/gemini-utils research delete interactions/abc123
```

#### Query

```bash
# Query a store
npx @allenhutchison/gemini-utils query stores/abc123 "What does the documentation say about authentication?"

# Use a specific model
npx @allenhutchison/gemini-utils query stores/abc123 "Summarize the main points" --model gemini-2.0-flash
```

#### Transcribe

```bash
# Basic transcription
npx @allenhutchison/gemini-utils transcribe file recording.mp3

# Save transcript to file
npx @allenhutchison/gemini-utils transcribe file recording.mp3 -o transcript.txt

# Transcribe with timestamps
npx @allenhutchison/gemini-utils transcribe file recording.mp3 -t -o transcript.txt

# Generate SRT subtitles
npx @allenhutchison/gemini-utils transcribe file video.mp3 -t -f srt -o subtitles.srt

# Generate WebVTT subtitles
npx @allenhutchison/gemini-utils transcribe file video.mp3 -t -f vtt -o subtitles.vtt

# Enable speaker diarization (identifies different speakers)
npx @allenhutchison/gemini-utils transcribe file meeting.wav -d -t -o meeting.txt

# Specify language hint
npx @allenhutchison/gemini-utils transcribe file spanish-audio.mp3 -l es -o transcript.txt

# Use a different model
npx @allenhutchison/gemini-utils transcribe file recording.mp3 -m gemini-3-pro

# Upload transcript to a file search store
npx @allenhutchison/gemini-utils transcribe file recording.mp3 -s stores/abc123

# Output formats: text (default), timestamped, srt, vtt, json
npx @allenhutchison/gemini-utils transcribe file recording.mp3 -t -f json -o transcript.json

# Manage large audio files (> 20MB)
npx @allenhutchison/gemini-utils transcribe upload large-audio.mp3
npx @allenhutchison/gemini-utils transcribe list
npx @allenhutchison/gemini-utils transcribe delete files/abc123
```

### JSON Output

Use `--json` for machine-readable output:

```bash
npx @allenhutchison/gemini-utils stores list --json | jq '.[] | .name'
```

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

### Audio Transcription

```typescript
import { GoogleGenAI } from '@google/genai';
import { TranscriptionManager, TranscriptFormatter } from '@allenhutchison/gemini-utils';

const client = new GoogleGenAI({ apiKey: 'your-api-key' });
const transcriber = new TranscriptionManager(client);

// Basic transcription
const result = await transcriber.transcribe({
  audioSource: './recording.mp3',
});
console.log(result.text);

// Transcription with timestamps and speaker diarization
const detailed = await transcriber.transcribe({
  audioSource: './meeting.wav',
  timestamps: true,
  diarization: true,
  language: 'en',
  model: 'gemini-3-flash',
});

// Access timestamped segments
for (const segment of detailed.segments ?? []) {
  console.log(`[${segment.startTime}s] ${segment.speaker}: ${segment.text}`);
}

// Format output in different formats
const formatter = new TranscriptFormatter();
const srt = formatter.toSRT(detailed);      // SRT subtitles
const vtt = formatter.toVTT(detailed);      // WebVTT subtitles
const json = formatter.toJSON(detailed);    // Structured JSON
```

### Large Audio File Upload

```typescript
import { TranscriptionManager } from '@allenhutchison/gemini-utils';

const transcriber = new TranscriptionManager(client);

// Upload large files (> 20MB) to Gemini File API first
const metadata = await transcriber.uploadAudioFile('./large-audio.mp3');
console.log(`Uploaded: ${metadata.uri}`);

// Then transcribe using the URI
const result = await transcriber.transcribe({
  audioSource: metadata.uri,
  timestamps: true,
});

// List and manage uploaded audio files
const files = await transcriber.listAudioFiles();
await transcriber.deleteAudioFile(files[0].name);
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

### TranscriptionManager

Manages audio transcription interactions with the Gemini API.

- `transcribe(params, onProgress?)` - Transcribe an audio file
- `uploadAudioFile(filePath)` - Upload large audio files to Gemini File API
- `listAudioFiles()` - List uploaded audio files
- `deleteAudioFile(name)` - Delete an uploaded audio file
- `getStatus(id)` - Get transcription interaction status
- `poll(id, intervalMs?)` - Poll until transcription completes (default: 2s interval)

### TranscriptFormatter

Converts transcription results to various output formats.

- `format(result, format)` - Format result to specified format
- `toPlainText(result)` - Plain text output
- `toTimestampedText(result)` - Text with timestamps `[00:00:05] Hello...`
- `toSRT(result)` - SRT subtitle format
- `toVTT(result)` - WebVTT subtitle format
- `toJSON(result)` - Structured JSON output

### Transcription Types

- `TranscribeParams` - Configuration for transcription (audioSource, language, model, timestamps, diarization)
- `TranscriptionResult` - Result with text, segments, duration, and metadata
- `TranscriptSegment` - Timestamped segment with startTime, endTime, text, speaker
- `TranscriptFormat` - Output formats: `text`, `timestamped`, `srt`, `vtt`, `json`
- `AudioFormat` - Supported formats: `mp3`, `wav`, `flac`, `aac`, `ogg`, `m4a`, `webm`

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
- `UnsupportedAudioTypeError` - Thrown for unsupported audio file types
- `AudioFileSizeExceededError` - Thrown when audio file exceeds 2GB limit

## Supported File Types

The library supports 36 validated MIME types plus 100+ text file extensions via fallback:

**Validated types**: PDF, XML, HTML, Markdown, C, Java, Python, Go, Kotlin, Perl, Lua, Erlang, TCL, BibTeX, diff

**Fallback (as text/plain)**: JavaScript, TypeScript, JSON, CSS, SCSS, YAML, TOML, Shell scripts, Ruby, PHP, Rust, Swift, Scala, and many more.

## Supported Audio Formats

For audio transcription, the following formats are supported:

- **MP3** (`audio/mpeg`)
- **WAV** (`audio/wav`)
- **FLAC** (`audio/flac`)
- **AAC** (`audio/aac`)
- **OGG** (`audio/ogg`)
- **M4A** (`audio/mp4`)
- **WebM** (`audio/webm`)

**File size limits:**
- Files ≤ 20MB: Uploaded inline (base64)
- Files > 20MB: Uploaded via Gemini File API (max 2GB)

## License

MIT
