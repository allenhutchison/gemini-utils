#!/usr/bin/env npx tsx
/**
 * Benchmark script for audio transcription.
 * Tests different models and prompts to compare performance and output quality.
 *
 * Usage:
 *   npx tsx scripts/benchmark-transcription.ts <audio-file> [--reference <transcript-file>]
 *
 * Options:
 *   --reference <file>  Reference transcript for Word Error Rate (WER) calculation
 *   --models <list>     Comma-separated list of models to test (default: gemini-3-flash-preview,gemini-3-pro-preview)
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import { TranscriptionManager } from '../src/audio-transcription/index.js';

interface BenchmarkResult {
  model: string;
  promptType: string;
  processingTimeMs: number;
  outputLength: number;
  segmentCount?: number;
  wer?: number;
  error?: string;
}

/**
 * Calculate Word Error Rate (WER) between reference and hypothesis.
 * WER = (S + D + I) / N where:
 * - S = substitutions, D = deletions, I = insertions
 * - N = number of words in reference
 */
function calculateWER(reference: string, hypothesis: string): number {
  const refWords = reference.toLowerCase().split(/\s+/).filter(Boolean);
  const hypWords = hypothesis.toLowerCase().split(/\s+/).filter(Boolean);

  const n = refWords.length;
  const m = hypWords.length;

  // DP table for Levenshtein distance
  const dp: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return n > 0 ? dp[n][m] / n : 0;
}

async function runBenchmark(
  audioFile: string,
  referenceTranscript?: string,
  modelList?: string[]
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!fs.existsSync(audioFile)) {
    console.error(`Error: Audio file not found: ${audioFile}`);
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  const transcriber = new TranscriptionManager(client);

  const models = modelList || ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
  const promptTypes = ['basic', 'timestamped', 'diarized'];

  const results: BenchmarkResult[] = [];

  console.log('='.repeat(60));
  console.log('Audio Transcription Benchmark');
  console.log('='.repeat(60));
  console.log(`Audio file: ${audioFile}`);
  console.log(`Models: ${models.join(', ')}`);
  console.log(`Prompt types: ${promptTypes.join(', ')}`);
  if (referenceTranscript) {
    console.log(`Reference transcript: ${referenceTranscript}`);
  }
  console.log('='.repeat(60));
  console.log();

  for (const model of models) {
    for (const promptType of promptTypes) {
      console.log(`Testing: ${model} with ${promptType} prompt...`);

      const startTime = Date.now();
      let result: BenchmarkResult = {
        model,
        promptType,
        processingTimeMs: 0,
        outputLength: 0,
      };

      try {
        const transcription = await transcriber.transcribe({
          audioSource: audioFile,
          model,
          timestamps: promptType !== 'basic',
          diarization: promptType === 'diarized',
        });

        result.processingTimeMs = Date.now() - startTime;
        result.outputLength = transcription.text.length;
        result.segmentCount = transcription.segments?.length;

        // Calculate WER if reference provided
        if (referenceTranscript) {
          const refText = fs.readFileSync(referenceTranscript, 'utf-8').trim();
          result.wer = calculateWER(refText, transcription.text);
        }

        console.log(`  ✓ Completed in ${(result.processingTimeMs / 1000).toFixed(1)}s`);
        console.log(`    Output: ${result.outputLength} chars, ${result.segmentCount ?? 0} segments`);
        if (result.wer !== undefined) {
          console.log(`    WER: ${(result.wer * 100).toFixed(1)}%`);
        }
      } catch (error) {
        result.processingTimeMs = Date.now() - startTime;
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`  ✗ Failed: ${result.error}`);
      }

      results.push(result);
      console.log();
    }
  }

  // Print summary table
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log();
  console.log('| Model | Prompt | Time (s) | Chars | Segments | WER |');
  console.log('|-------|--------|----------|-------|----------|-----|');

  for (const r of results) {
    const time = r.error ? 'ERROR' : (r.processingTimeMs / 1000).toFixed(1);
    const chars = r.error ? '-' : r.outputLength.toString();
    const segments = r.segmentCount?.toString() ?? '-';
    const wer = r.wer !== undefined ? `${(r.wer * 100).toFixed(1)}%` : '-';
    console.log(`| ${r.model} | ${r.promptType} | ${time} | ${chars} | ${segments} | ${wer} |`);
  }

  console.log();

  // Output JSON results
  const jsonOutput = {
    audioFile,
    timestamp: new Date().toISOString(),
    referenceTranscript,
    results,
  };

  const outputFile = `benchmark-results-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`Results saved to: ${outputFile}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let audioFile: string | undefined;
let referenceTranscript: string | undefined;
let modelList: string[] | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--reference' && args[i + 1]) {
    referenceTranscript = args[++i];
  } else if (args[i] === '--models' && args[i + 1]) {
    modelList = args[++i].split(',').map((s) => s.trim());
  } else if (!args[i].startsWith('--')) {
    audioFile = args[i];
  }
}

if (!audioFile) {
  console.log('Usage: npx tsx scripts/benchmark-transcription.ts <audio-file> [--reference <transcript-file>] [--models <list>]');
  console.log();
  console.log('Options:');
  console.log('  --reference <file>  Reference transcript for WER calculation');
  console.log('  --models <list>     Comma-separated list of models (default: gemini-3-flash-preview,gemini-3-pro-preview)');
  process.exit(1);
}

runBenchmark(audioFile, referenceTranscript, modelList).catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
