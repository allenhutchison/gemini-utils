/**
 * TranscriptFormatter - Converts transcription results to various output formats.
 */

import { TranscriptionResult, TranscriptFormat, TranscriptSegment } from './types.js';

/**
 * Formats transcription results into various output formats.
 */
export class TranscriptFormatter {
  /**
   * Formats the transcription result based on the specified format.
   *
   * @param result - The transcription result
   * @param format - The desired output format
   * @returns Formatted transcript string
   */
  format(result: TranscriptionResult, format: TranscriptFormat): string {
    switch (format) {
      case 'text':
        return this.toPlainText(result);
      case 'timestamped':
        return this.toTimestampedText(result);
      case 'srt':
        return this.toSRT(result);
      case 'vtt':
        return this.toVTT(result);
      case 'json':
        return this.toJSON(result);
      default:
        return this.toPlainText(result);
    }
  }

  /**
   * Converts to plain text format.
   */
  toPlainText(result: TranscriptionResult): string {
    return result.text;
  }

  /**
   * Converts to timestamped text format.
   * Format: [00:00:05] Hello world...
   */
  toTimestampedText(result: TranscriptionResult): string {
    if (!result.segments?.length) {
      return result.text;
    }

    return result.segments
      .map((segment) => {
        const timestamp = this.formatTimestamp(segment.startTime);
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        return `[${timestamp}] ${speaker}${segment.text}`;
      })
      .join('\n');
  }

  /**
   * Converts to SRT subtitle format.
   */
  toSRT(result: TranscriptionResult): string {
    if (!result.segments?.length) {
      // Generate a single segment for the entire text
      return `1\n00:00:00,000 --> 00:00:10,000\n${result.text}\n`;
    }

    return result.segments
      .map((segment, index) => {
        const startTime = this.formatSRTTimestamp(segment.startTime);
        const endTime = this.formatSRTTimestamp(segment.endTime);
        const speaker = segment.speaker ? `[${segment.speaker}] ` : '';
        return `${index + 1}\n${startTime} --> ${endTime}\n${speaker}${segment.text}`;
      })
      .join('\n\n') + '\n';
  }

  /**
   * Converts to WebVTT subtitle format.
   */
  toVTT(result: TranscriptionResult): string {
    const header = 'WEBVTT\n\n';

    if (!result.segments?.length) {
      // Generate a single cue for the entire text
      return `${header}00:00:00.000 --> 00:00:10.000\n${result.text}\n`;
    }

    const cues = result.segments
      .map((segment, index) => {
        const startTime = this.formatVTTTimestamp(segment.startTime);
        const endTime = this.formatVTTTimestamp(segment.endTime);
        const speaker = segment.speaker ? `<v ${segment.speaker}>` : '';
        return `${index + 1}\n${startTime} --> ${endTime}\n${speaker}${segment.text}`;
      })
      .join('\n\n');

    return header + cues + '\n';
  }

  /**
   * Converts to structured JSON format.
   */
  toJSON(result: TranscriptionResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Formats seconds to display timestamp [HH:MM:SS].
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}`;
    }
    return `${this.pad(minutes)}:${this.pad(secs)}`;
  }

  /**
   * Formats seconds to SRT timestamp (HH:MM:SS,mmm).
   */
  private formatSRTTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)},${this.pad(millis, 3)}`;
  }

  /**
   * Formats seconds to VTT timestamp (HH:MM:SS.mmm).
   */
  private formatVTTTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}.${this.pad(millis, 3)}`;
  }

  /**
   * Pads a number with leading zeros.
   */
  private pad(num: number, length: number = 2): string {
    return num.toString().padStart(length, '0');
  }
}

/**
 * Utility function to detect if segments are available in the result.
 */
export function hasSegments(result: TranscriptionResult): result is TranscriptionResult & { segments: TranscriptSegment[] } {
  return Array.isArray(result.segments) && result.segments.length > 0;
}
