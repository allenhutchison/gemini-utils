/**
 * GoogleGenAI client factory for CLI commands.
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKeyFromConfig, getConfigDir } from './config.js';
import { ExitCode } from './errors.js';

export const EXIT_CODE_NO_API_KEY = ExitCode.NO_API_KEY;

/**
 * Creates a GoogleGenAI client from the provided API key, environment variable, or config file.
 *
 * Lookup order:
 * 1. --api-key command line option
 * 2. GEMINI_API_KEY environment variable
 * 3. Config file (~/.config/gemini-utils/config.json or .env)
 *
 * Exits with error if no API key is available.
 */
export function createClient(apiKeyOption?: string): GoogleGenAI {
  // Try command line option first
  let apiKey = apiKeyOption;

  // Then try environment variable
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  }

  // Finally try config file
  if (!apiKey) {
    apiKey = getApiKeyFromConfig();
  }

  if (!apiKey) {
    console.error('Error: API key required.');
    console.error('');
    console.error('Provide an API key using one of these methods:');
    console.error('  1. --api-key <key> command line option');
    console.error('  2. GEMINI_API_KEY environment variable');
    console.error(`  3. Config file: ${getConfigDir()}/config.json`);
    console.error(`     Example: { "apiKey": "your-api-key" }`);
    console.error(`  4. Env file: ${getConfigDir()}/.env`);
    console.error('     Example: GEMINI_API_KEY=your-api-key');
    process.exit(EXIT_CODE_NO_API_KEY);
  }

  // Explicitly disable Vertex AI routing. Enterprise environments may set
  // env vars (e.g. GOOGLE_GENAI_USE_VERTEXAI) that cause the SDK to use
  // Vertex endpoints, which do not support the interactions API.
  return new GoogleGenAI({ apiKey, vertexai: false });
}
