/**
 * Transcription prompt templates for Gemini API.
 */

import { TranscribeParams } from './types.js';

/**
 * Prompt templates for different transcription modes.
 */
export const PROMPTS = {
  /**
   * Basic transcription prompt - produces plain text output.
   */
  basicTranscription: `Transcribe the following audio file accurately.
Output only the transcribed text without any additional commentary, timestamps, or formatting.
Preserve the natural flow of speech, including punctuation for clarity.`,

  /**
   * Timestamped transcription prompt - produces JSON with timestamps.
   */
  timestampedTranscription: `Transcribe the following audio file with timestamps.
Output the result as a JSON object with the following structure:
{
  "text": "full transcription text",
  "segments": [
    {
      "startTime": 0.0,
      "endTime": 2.5,
      "text": "segment text"
    }
  ],
  "duration": 120.5
}

Rules:
- startTime and endTime are in seconds (can be decimal)
- Each segment should be a natural phrase or sentence
- Segments should not overlap
- Include all spoken content
- Output ONLY the JSON, no markdown code blocks or other text`,

  /**
   * Diarized transcription prompt - produces JSON with speaker labels.
   */
  diarizedTranscription: `Transcribe the following audio file with speaker identification and timestamps.
Output the result as a JSON object with the following structure:
{
  "text": "full transcription text",
  "segments": [
    {
      "startTime": 0.0,
      "endTime": 2.5,
      "text": "segment text",
      "speaker": "Speaker 1"
    }
  ],
  "duration": 120.5
}

Rules:
- Identify different speakers and label them consistently (Speaker 1, Speaker 2, etc.)
- startTime and endTime are in seconds (can be decimal)
- Each segment should be a single speaker's utterance
- Segments should not overlap
- Include all spoken content
- Output ONLY the JSON, no markdown code blocks or other text`,

  /**
   * Language-specific transcription prompt.
   * @param language - The target language
   */
  languageSpecific: (language: string) =>
    `Transcribe the following audio file in ${language}.
The audio is expected to be in ${language}. Transcribe accurately in that language.
Output only the transcribed text without any additional commentary, timestamps, or formatting.
Preserve the natural flow of speech, including punctuation for clarity.`,
};

/**
 * Builds a transcription prompt based on the provided parameters.
 *
 * @param params - Transcription parameters
 * @returns The constructed prompt string
 */
export function buildTranscriptionPrompt(params: TranscribeParams): string {
  const { language, timestamps, diarization } = params;

  // Diarization takes precedence (includes timestamps)
  if (diarization) {
    if (language) {
      return `${PROMPTS.diarizedTranscription}\n\nThe audio is in ${language}. Transcribe in that language.`;
    }
    return PROMPTS.diarizedTranscription;
  }

  // Timestamps without diarization
  if (timestamps) {
    if (language) {
      return `${PROMPTS.timestampedTranscription}\n\nThe audio is in ${language}. Transcribe in that language.`;
    }
    return PROMPTS.timestampedTranscription;
  }

  // Basic transcription
  if (language) {
    return PROMPTS.languageSpecific(language);
  }

  return PROMPTS.basicTranscription;
}
