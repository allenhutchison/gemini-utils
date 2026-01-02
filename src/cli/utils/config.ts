/**
 * Configuration file support for the CLI.
 * Looks for config in ~/.config/gemini-utils/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR_NAME = 'gemini-utils';
const CONFIG_FILE_NAME = 'config.json';
const ENV_FILE_NAME = '.env';

/**
 * Returns true if debug logging is enabled.
 */
function isDebugEnabled(): boolean {
  return process.env.GEMINI_DEBUG === '1' || process.env.GEMINI_DEBUG === 'true';
}

export interface Config {
  apiKey?: string;
}

/**
 * Gets the config directory path.
 * Uses XDG_CONFIG_HOME if set, otherwise ~/.config/gemini-utils
 */
export function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const baseDir = xdgConfig || path.join(os.homedir(), '.config');
  return path.join(baseDir, CONFIG_DIR_NAME);
}

/**
 * Gets the path to the config.json file.
 */
export function getConfigFilePath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Gets the path to the .env file.
 */
export function getEnvFilePath(): string {
  return path.join(getConfigDir(), ENV_FILE_NAME);
}

/**
 * Parses a simple .env file format.
 * Supports KEY=value and KEY="value" formats.
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Loads configuration from the config directory.
 * Tries config.json first, then .env file.
 */
export function loadConfig(): Config {
  const config: Config = {};

  // Try config.json first
  const configPath = getConfigFilePath();
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.apiKey) {
        config.apiKey = parsed.apiKey;
        return config;
      }
      // No apiKey in config.json, continue to try .env
    } catch (err) {
      if (isDebugEnabled()) {
        console.error(`[debug] Failed to parse config.json: ${err}`);
      }
    }
  }

  // Try .env file
  const envPath = getEnvFilePath();
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const parsed = parseEnvFile(content);
      if (parsed.GEMINI_API_KEY) {
        config.apiKey = parsed.GEMINI_API_KEY;
      }
    } catch (err) {
      if (isDebugEnabled()) {
        console.error(`[debug] Failed to read .env file: ${err}`);
      }
    }
  }

  return config;
}

/**
 * Gets the API key from config file.
 * Returns undefined if not found.
 */
export function getApiKeyFromConfig(): string | undefined {
  const config = loadConfig();
  return config.apiKey;
}
