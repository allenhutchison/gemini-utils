/**
 * CLI for @allenhutchison/gemini-utils
 *
 * Provides command-line access to file search stores, uploads, documents,
 * deep research, and store querying functionality.
 */

import { Command } from 'commander';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
import { createClient } from './utils/client.js';
import { OutputContext } from './utils/output.js';
import { registerStoresCommands } from './commands/stores.js';
import { registerUploadCommands } from './commands/upload.js';
import { registerDocumentsCommands } from './commands/documents.js';
import { registerResearchCommands } from './commands/research.js';
import { registerQueryCommand } from './commands/query.js';
import { registerTranscribeCommands } from './commands/transcribe.js';

// Read version from package.json (single source of truth)
const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };
const VERSION = packageJson.version;

/**
 * Context passed to all commands via the command object.
 */
export interface CommandContext {
  client: GoogleGenAI;
  outputContext: OutputContext;
}

// Extend Commander's Command type to include our context
declare module 'commander' {
  interface Command {
    ctx?: CommandContext;
  }
}

/**
 * Creates and configures the CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('gemini-utils')
    .description('CLI for Google Gemini file search, uploads, and deep research')
    .version(VERSION, '-v, --version', 'Show version number')
    .option('-j, --json', 'Output in JSON format')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--api-key <key>', 'API key (overrides GEMINI_API_KEY env var)');

  // Set up context before each command action
  program.hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.optsWithGlobals();

    const client = createClient(opts.apiKey);
    const outputContext: OutputContext = {
      json: opts.json ?? false,
      quiet: opts.quiet ?? false,
    };

    // Attach context to the action command
    actionCommand.ctx = {
      client,
      outputContext,
    };
  });

  // Register all command groups
  registerStoresCommands(program);
  registerUploadCommands(program);
  registerDocumentsCommands(program);
  registerResearchCommands(program);
  registerQueryCommand(program);
  registerTranscribeCommands(program);

  return program;
}
