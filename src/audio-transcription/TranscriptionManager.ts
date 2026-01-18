/**
 * TranscriptionManager - Manages audio transcription interactions with Google's Gemini API.
 * Provides methods to transcribe audio files using the Interactions API.
 */
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  TranscribeParams,
  TranscriptionResult,
  TranscriptionProgressCallback,
  AudioFileMetadata,
  TRANSCRIPTION_TERMINAL_STATUSES,
  TranscriptionStatus,
} from './types.js';
import type { TranscriptSegment } from './types.js';
import {
  requireAudioMimeType,
  shouldUseFileApi,
  validateAudioFileSize,
  getAudioMimeType,
} from './audioMimeTypes.js';
import { buildTranscriptionPrompt } from './prompts.js';

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_TIMEOUT_MS = 600000; // 10 minutes

/**
 * Response from generateContent API.
 */
interface GenerateContentResponse {
  text?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

/**
 * Interaction response from the Gemini API (for polling uploaded files).
 */
interface InteractionResponse {
  id?: string;
  status?: string;
  outputs?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

/**
 * File metadata from the Gemini Files API.
 */
interface FileResponse {
  name?: string;
  displayName?: string;
  mimeType?: string;
  sizeBytes?: string;
  createTime?: string;
  expirationTime?: string;
  uri?: string;
}

/**
 * Manages audio transcription interactions with the Gemini API.
 */
export class TranscriptionManager {
  constructor(private client: GoogleGenAI) {}

  /**
   * Transcribes an audio file using the Gemini API.
   *
   * @param params - Transcription parameters
   * @param onProgress - Optional progress callback
   * @returns The transcription result
   */
  async transcribe(
    params: TranscribeParams,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    const { audioSource, model = DEFAULT_MODEL } = params;
    const startTime = Date.now();

    // Check if audioSource is a remote URI (http:// or https://)
    // Note: file:// URIs are converted to local paths for proper validation
    const isRemoteUri = /^https?:\/\//i.test(audioSource);
    const isFileUri = /^file:\/\//i.test(audioSource);

    let fileUri: string;
    let mimeType: string;
    let fileSize: number | undefined;
    let uploadedViaFileApi = false;
    let localFilePath: string | undefined;

    if (isRemoteUri) {
      // Remote URI (http/https) - use directly without local validation
      fileUri = audioSource;

      // Try to determine MIME type from URI path
      // Extract path from URI, removing query string and fragment
      const urlPath = audioSource.replace(/[?#].*$/, '');
      const detectedMimeType = getAudioMimeType(urlPath);
      // Use detected MIME type or fall back to audio/mpeg as a safe default
      mimeType = detectedMimeType || 'audio/mpeg';
    } else {
      // Local file path or file:// URI - validate and prepare for upload
      // Convert file:// URI to local path if needed
      localFilePath = isFileUri ? fileURLToPath(audioSource) : audioSource;

      // Validate the audio file
      mimeType = requireAudioMimeType(localFilePath);
      const stats = fs.statSync(localFilePath);
      fileSize = stats.size;
      validateAudioFileSize(localFilePath, fileSize);

      if (shouldUseFileApi(fileSize)) {
        // Upload via File API for large files
        onProgress?.({
          type: 'upload_start',
          message: 'Uploading large audio file...',
        });

        const uploadResult = await this.uploadAudioFile(localFilePath);
        fileUri = uploadResult.uri;
        uploadedViaFileApi = true;

        onProgress?.({
          type: 'upload_complete',
          message: 'Audio file uploaded successfully',
        });
      } else {
        // For small files, we'll use inline data
        fileUri = localFilePath;
      }
    }

    // Build the transcription prompt
    const prompt = buildTranscriptionPrompt(params);

    onProgress?.({
      type: 'transcription_start',
      message: 'Starting transcription...',
    });

    // Create the interaction with audio input
    let response: TranscriptionResult;

    if (isRemoteUri || uploadedViaFileApi) {
      // Use file URI reference for remote URIs or files uploaded via File API
      response = await this.transcribeWithUri(fileUri, mimeType, prompt, model, onProgress);
    } else {
      // Use inline base64 data for small local files
      response = await this.transcribeWithInlineData(localFilePath!, mimeType, prompt, model, onProgress);
    }

    // Add metadata to response
    const processingTimeMs = Date.now() - startTime;
    response.metadata = {
      ...response.metadata,
      fileName: localFilePath ? path.basename(localFilePath) : undefined,
      fileSize,
      mimeType,
      processingTimeMs,
      uploadedViaFileApi,
    };

    onProgress?.({
      type: 'transcription_complete',
      message: 'Transcription complete',
      percentage: 100,
    });

    return response;
  }

  /**
   * Transcribes audio using a file URI.
   */
  private async transcribeWithUri(
    fileUri: string,
    mimeType: string,
    prompt: string,
    model: string,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    onProgress?.({
      type: 'transcription_progress',
      message: 'Processing audio...',
    });

    // Use generateContent API for multimodal input
    const response = await this.client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: fileUri,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
    }) as GenerateContentResponse;

    return this.parseGenerateContentResponse(response, model);
  }

  /**
   * Transcribes audio using inline base64 data.
   */
  private async transcribeWithInlineData(
    filePath: string,
    mimeType: string,
    prompt: string,
    model: string,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    onProgress?.({
      type: 'transcription_progress',
      message: 'Processing audio...',
    });

    // Use generateContent API for multimodal input
    const response = await this.client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
      ],
    }) as GenerateContentResponse;

    return this.parseGenerateContentResponse(response, model);
  }

  /**
   * Parses the generateContent response.
   */
  private parseGenerateContentResponse(
    response: GenerateContentResponse,
    model: string
  ): TranscriptionResult {
    // Extract text from response - try direct text property first, then candidates
    let rawText = response.text || '';
    if (!rawText && response.candidates?.[0]?.content?.parts) {
      rawText = response.candidates[0].content.parts
        .filter(p => p.text)
        .map(p => p.text!)
        .join('\n');
    }
    rawText = rawText.trim();

    if (!rawText) {
      throw new Error('Transcription failed: no text in response');
    }

    return this.parseRawTranscription(rawText, model);
  }

  /**
   * Parses raw transcription text, handling JSON for timestamped output.
   */
  private parseRawTranscription(rawText: string, model: string): TranscriptionResult {
    // Try to parse as JSON for timestamped/diarized output
    let segments: TranscriptSegment[] | undefined;
    let duration: number | undefined;
    let text = rawText;

    try {
      // Clean up potential markdown code blocks
      let jsonText = rawText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText);
      if (parsed.text !== undefined) {
        text = parsed.text;
        segments = parsed.segments;
        duration = parsed.duration;
      }
    } catch {
      // Not JSON, use raw text as is
    }

    return {
      text,
      segments,
      duration,
      model,
    };
  }

  /**
   * Uploads an audio file to the Gemini File API.
   *
   * Uses the SDK's native file path support to avoid buffering large files in memory.
   *
   * @param filePath - Path to the audio file
   * @returns File metadata including URI
   */
  async uploadAudioFile(filePath: string): Promise<AudioFileMetadata> {
    const mimeType = requireAudioMimeType(filePath);
    const stats = fs.statSync(filePath);
    const displayName = path.basename(filePath);

    validateAudioFileSize(filePath, stats.size);

    // Pass file path directly to the SDK - it handles streaming internally
    // This avoids buffering large files (up to 2GB) in memory
    const response = (await this.client.files.upload({
      file: filePath,
      config: {
        displayName,
        mimeType,
      },
    })) as FileResponse;

    if (!response.uri) {
      throw new Error('File upload failed: no URI returned');
    }

    return {
      uri: response.uri,
      displayName: response.displayName,
      mimeType: response.mimeType || mimeType,
      sizeBytes: parseInt(response.sizeBytes || String(stats.size), 10),
      createTime: response.createTime,
      expirationTime: response.expirationTime,
    };
  }

  /**
   * Lists audio files uploaded to the Gemini File API.
   *
   * @returns Array of file metadata
   */
  async listAudioFiles(): Promise<Array<{ name: string; uri: string; mimeType: string; displayName?: string }>> {
    const files: Array<{ name: string; uri: string; mimeType: string; displayName?: string }> = [];

    const pager = await this.client.files.list();
    for await (const file of pager) {
      const f = file as FileResponse;
      // Filter to only audio files
      if (f.mimeType?.startsWith('audio/') && f.name && f.uri) {
        files.push({
          name: f.name,
          uri: f.uri,
          mimeType: f.mimeType,
          displayName: f.displayName,
        });
      }
    }

    return files;
  }

  /**
   * Deletes an audio file from the Gemini File API.
   *
   * @param name - The file name (resource name)
   */
  async deleteAudioFile(name: string): Promise<void> {
    await this.client.files.delete({ name });
  }

  /**
   * Gets the status of a transcription interaction.
   *
   * @param id - The interaction ID
   * @returns The interaction with current status
   */
  async getStatus(id: string): Promise<InteractionResponse> {
    return (await this.client.interactions.get(id)) as InteractionResponse;
  }

  /**
   * Polls a transcription interaction until it reaches a terminal state.
   *
   * @param id - The interaction ID
   * @param intervalMs - Poll interval in milliseconds (default: 2000)
   * @param timeoutMs - Maximum time to poll in milliseconds (default: 600000 = 10 minutes)
   * @returns The completed, failed, or cancelled interaction
   * @throws Error if polling times out
   */
  async poll(
    id: string,
    intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs: number = DEFAULT_POLL_TIMEOUT_MS
  ): Promise<InteractionResponse> {
    const startTime = Date.now();

    while (true) {
      const interaction = await this.getStatus(id);
      const status = interaction.status as TranscriptionStatus;

      if (TRANSCRIPTION_TERMINAL_STATUSES.includes(status)) {
        return interaction;
      }

      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= timeoutMs) {
        throw new Error(`Transcription poll timeout for id ${id} after ${Math.round(elapsedMs / 1000)}s`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
