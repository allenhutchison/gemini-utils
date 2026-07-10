/**
 * Tiny, dependency-free path helpers.
 *
 * These exist so that the light-weight MIME/extension modules can run in any
 * JavaScript environment (including browser/mobile bundles) without importing
 * the Node.js `path` built-in. Pulling in `path` there would force the whole
 * module graph to evaluate a Node built-in at load time — see
 * https://github.com/allenhutchison/obsidian-gemini/issues/1154.
 */

/**
 * Returns the extension of a path, from the last `.` in the final path segment
 * to the end. Mirrors `path.extname` for the cases that matter to extension
 * lookups: a leading-dot segment (e.g. `.gitignore`) and a segment with no dot
 * both yield `''`. Handles both `/` and `\` separators.
 *
 * @param filePath - Path or file name to inspect
 * @returns The extension including the leading dot (e.g. `.mp3`), or `''`
 */
export function extname(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const base = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
  const dot = base.lastIndexOf('.');
  // No dot, or a leading-dot dotfile (e.g. `.gitignore`) → no extension.
  if (dot <= 0) {
    return '';
  }
  return base.slice(dot);
}
