/**
 * Validation utilities for CLI options.
 */

export interface ValidationContext {
  quiet: boolean;
  json: boolean;
}

/**
 * Validates and parses a positive integer from a string value.
 * Returns the default value if the input is invalid.
 * Rejects partially-parsed input like "123abc" or "10s".
 */
export function validatePositiveInteger(
  value: string,
  defaultValue: number,
  optionName: string,
  ctx: ValidationContext
): number {
  // Reject strings that aren't purely numeric (with optional whitespace)
  if (!/^\s*\d+\s*$/.test(value)) {
    if (!ctx.quiet && !ctx.json) {
      console.warn(`Invalid ${optionName} "${value}", using default ${defaultValue}`);
    }
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (!ctx.quiet && !ctx.json) {
      console.warn(`Invalid ${optionName} "${value}", using default ${defaultValue}`);
    }
    return defaultValue;
  }
  return parsed;
}
