/**
 * Error handling utilities for CLI commands.
 */

import { OutputContext, outputError } from './output.js';

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  MISSING_ARGUMENT = 2,
  NO_API_KEY = 3,
  NOT_FOUND = 4,
  API_ERROR = 5,
}

/**
 * Handle an error from a CLI command.
 * Determines appropriate exit code and formats error message.
 */
export function handleError(ctx: OutputContext, err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);

  let code = ExitCode.GENERAL_ERROR;

  // Detect specific error types
  if (message.includes('not found') || message.includes('NOT_FOUND')) {
    code = ExitCode.NOT_FOUND;
  } else if (message.includes('INVALID_ARGUMENT')) {
    code = ExitCode.MISSING_ARGUMENT;
  } else if (message.includes('PERMISSION_DENIED') || message.includes('UNAUTHENTICATED')) {
    code = ExitCode.API_ERROR;
  }

  outputError(ctx, message, code);
}
