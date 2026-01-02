/**
 * Output formatting utilities for CLI commands.
 * Supports both JSON and human-readable output formats.
 */

export interface OutputContext {
  json: boolean;
  quiet: boolean;
}

/**
 * Output data in the appropriate format based on context.
 * @param ctx - Output context with format preferences
 * @param data - Data to output (will be JSON stringified if json mode)
 * @param humanFormatter - Optional function to format data for human-readable output
 */
export function output(
  ctx: OutputContext,
  data: unknown,
  humanFormatter?: () => string
): void {
  if (ctx.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (!ctx.quiet) {
    console.log(humanFormatter?.() ?? String(data));
  }
}

/**
 * Output an error message and exit.
 * @param ctx - Output context with format preferences
 * @param message - Error message
 * @param exitCode - Process exit code (default: 1)
 */
export function outputError(
  ctx: OutputContext,
  message: string,
  exitCode: number = 1
): never {
  if (ctx.json) {
    console.error(JSON.stringify({ error: message, exitCode }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(exitCode);
}

/**
 * Output a success message (only in non-quiet mode).
 */
export function outputSuccess(ctx: OutputContext, message: string): void {
  if (!ctx.quiet && !ctx.json) {
    console.log(message);
  }
}

/**
 * Format a table for human-readable output.
 * Simple implementation without external dependencies.
 */
export function formatTable(
  headers: string[],
  rows: string[][]
): string {
  if (rows.length === 0) {
    return '(no data)';
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(row => (row[i] ?? '').length));
    return Math.max(h.length, maxRowWidth);
  });

  // Format header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');

  // Format rows
  const formattedRows = rows.map(row =>
    row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  ')
  );

  return [headerLine, separator, ...formattedRows].join('\n');
}
