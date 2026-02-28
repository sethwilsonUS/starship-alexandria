/**
 * Helpers for formatting Project Gutenberg text.
 * Use when displaying or transforming book fragment text.
 */
export function stripGutenbergHeader(text: string): string {
  const start = text.indexOf('*** START OF');
  if (start === -1) return text;
  const after = text.indexOf('\n\n', start);
  return after === -1 ? text : text.slice(after + 2).trim();
}

export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
