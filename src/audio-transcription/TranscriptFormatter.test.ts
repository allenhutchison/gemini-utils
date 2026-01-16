import { describe, it, expect } from '@jest/globals';
import { TranscriptFormatter, hasSegments } from './TranscriptFormatter.js';
import { TranscriptionResult } from './types.js';

describe('TranscriptFormatter', () => {
  let formatter: TranscriptFormatter;

  beforeEach(() => {
    formatter = new TranscriptFormatter();
  });

  const baseResult: TranscriptionResult = {
    text: 'Hello world. This is a test.',
    model: 'gemini-3-flash',
  };

  const resultWithSegments: TranscriptionResult = {
    text: 'Hello world. This is a test.',
    segments: [
      { startTime: 0, endTime: 1.5, text: 'Hello world.' },
      { startTime: 1.5, endTime: 3.0, text: 'This is a test.' },
    ],
    duration: 3.0,
    model: 'gemini-3-flash',
  };

  const resultWithSpeakers: TranscriptionResult = {
    text: 'Hello. Hi there.',
    segments: [
      { startTime: 0, endTime: 1.0, text: 'Hello.', speaker: 'Speaker 1' },
      { startTime: 1.0, endTime: 2.0, text: 'Hi there.', speaker: 'Speaker 2' },
    ],
    duration: 2.0,
    model: 'gemini-3-flash',
  };

  describe('format', () => {
    it('should format as text by default', () => {
      const result = formatter.format(baseResult, 'text');
      expect(result).toBe('Hello world. This is a test.');
    });

    it('should format as timestamped', () => {
      const result = formatter.format(resultWithSegments, 'timestamped');
      expect(result).toContain('[00:00]');
      expect(result).toContain('[00:01]');
    });

    it('should format as srt', () => {
      const result = formatter.format(resultWithSegments, 'srt');
      expect(result).toContain('1\n');
      expect(result).toContain('00:00:00,000 --> 00:00:01,500');
      expect(result).toContain('2\n');
    });

    it('should format as vtt', () => {
      const result = formatter.format(resultWithSegments, 'vtt');
      expect(result).toContain('WEBVTT');
      expect(result).toContain('00:00:00.000 --> 00:00:01.500');
    });

    it('should format as json', () => {
      const result = formatter.format(baseResult, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.text).toBe('Hello world. This is a test.');
      expect(parsed.model).toBe('gemini-3-flash');
    });
  });

  describe('toPlainText', () => {
    it('should return just the text', () => {
      const result = formatter.toPlainText(baseResult);
      expect(result).toBe('Hello world. This is a test.');
    });
  });

  describe('toTimestampedText', () => {
    it('should return plain text if no segments', () => {
      const result = formatter.toTimestampedText(baseResult);
      expect(result).toBe('Hello world. This is a test.');
    });

    it('should format segments with timestamps', () => {
      const result = formatter.toTimestampedText(resultWithSegments);
      expect(result).toContain('[00:00] Hello world.');
      expect(result).toContain('[00:01] This is a test.');
    });

    it('should include speaker labels', () => {
      const result = formatter.toTimestampedText(resultWithSpeakers);
      expect(result).toContain('Speaker 1:');
      expect(result).toContain('Speaker 2:');
    });

    it('should format hours correctly', () => {
      const longResult: TranscriptionResult = {
        text: 'Test',
        segments: [{ startTime: 3665, endTime: 3670, text: 'Test' }],
        model: 'test',
      };
      const result = formatter.toTimestampedText(longResult);
      expect(result).toContain('[01:01:05]');
    });
  });

  describe('toSRT', () => {
    it('should generate valid SRT format', () => {
      const result = formatter.toSRT(resultWithSegments);
      const lines = result.split('\n');

      // Check first cue
      expect(lines[0]).toBe('1');
      expect(lines[1]).toBe('00:00:00,000 --> 00:00:01,500');
      expect(lines[2]).toBe('Hello world.');

      // Check blank line between cues
      expect(lines[3]).toBe('');

      // Check second cue
      expect(lines[4]).toBe('2');
      expect(lines[5]).toBe('00:00:01,500 --> 00:00:03,000');
      expect(lines[6]).toBe('This is a test.');
    });

    it('should include speaker labels in brackets', () => {
      const result = formatter.toSRT(resultWithSpeakers);
      expect(result).toContain('[Speaker 1] Hello.');
      expect(result).toContain('[Speaker 2] Hi there.');
    });

    it('should generate single cue if no segments', () => {
      const result = formatter.toSRT(baseResult);
      expect(result).toContain('1\n');
      expect(result).toContain('00:00:00,000 --> 00:00:10,000');
      expect(result).toContain('Hello world. This is a test.');
    });
  });

  describe('toVTT', () => {
    it('should generate valid WebVTT format', () => {
      const result = formatter.toVTT(resultWithSegments);

      // Check header
      expect(result.startsWith('WEBVTT')).toBe(true);

      // Check timestamp format uses periods not commas
      expect(result).toContain('00:00:00.000 --> 00:00:01.500');
      expect(result).not.toContain(',000');
    });

    it('should include speaker tags', () => {
      const result = formatter.toVTT(resultWithSpeakers);
      expect(result).toContain('<v Speaker 1>Hello.');
      expect(result).toContain('<v Speaker 2>Hi there.');
    });

    it('should generate single cue if no segments', () => {
      const result = formatter.toVTT(baseResult);
      expect(result).toContain('WEBVTT');
      expect(result).toContain('00:00:00.000 --> 00:00:10.000');
    });
  });

  describe('toJSON', () => {
    it('should return valid JSON', () => {
      const result = formatter.toJSON(resultWithSegments);
      const parsed = JSON.parse(result);

      expect(parsed.text).toBe('Hello world. This is a test.');
      expect(parsed.segments).toHaveLength(2);
      expect(parsed.duration).toBe(3.0);
      expect(parsed.model).toBe('gemini-3-flash');
    });

    it('should be pretty-printed', () => {
      const result = formatter.toJSON(baseResult);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });
});

describe('hasSegments', () => {
  it('should return true for result with segments', () => {
    const result: TranscriptionResult = {
      text: 'Test',
      segments: [{ startTime: 0, endTime: 1, text: 'Test' }],
      model: 'test',
    };
    expect(hasSegments(result)).toBe(true);
  });

  it('should return false for result without segments', () => {
    const result: TranscriptionResult = {
      text: 'Test',
      model: 'test',
    };
    expect(hasSegments(result)).toBe(false);
  });

  it('should return false for empty segments array', () => {
    const result: TranscriptionResult = {
      text: 'Test',
      segments: [],
      model: 'test',
    };
    expect(hasSegments(result)).toBe(false);
  });
});
