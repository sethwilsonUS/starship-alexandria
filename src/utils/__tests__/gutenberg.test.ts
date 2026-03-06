import { describe, it, expect } from 'vitest';
import { stripGutenbergHeader, normalizeLineBreaks } from '../gutenberg';

describe('stripGutenbergHeader', () => {
  it('strips everything before *** START OF marker', () => {
    const text = [
      'Project Gutenberg blah blah',
      '*** START OF THE PROJECT GUTENBERG EBOOK ***',
      '',
      'Chapter 1',
      'It was a dark and stormy night.',
    ].join('\n');

    const result = stripGutenbergHeader(text);
    expect(result).toBe('Chapter 1\nIt was a dark and stormy night.');
  });

  it('returns original text when no START OF marker exists', () => {
    const text = 'Just a plain text with no Gutenberg header.';
    expect(stripGutenbergHeader(text)).toBe(text);
  });

  it('returns original text when no double newline follows the marker', () => {
    const text = '*** START OF THE PROJECT GUTENBERG EBOOK ***\nNo blank line after marker.';
    expect(stripGutenbergHeader(text)).toBe(text);
  });

  it('trims leading/trailing whitespace from the result', () => {
    const text = [
      'Header stuff',
      '*** START OF THIS EBOOK ***',
      '',
      '   Hello World   ',
    ].join('\n');

    const result = stripGutenbergHeader(text);
    expect(result).toBe('Hello World');
  });
});

describe('normalizeLineBreaks', () => {
  it('converts Windows line endings (\\r\\n) to Unix (\\n)', () => {
    expect(normalizeLineBreaks('a\r\nb\r\nc')).toBe('a\nb\nc');
  });

  it('converts old Mac line endings (\\r) to Unix (\\n)', () => {
    expect(normalizeLineBreaks('a\rb\rc')).toBe('a\nb\nc');
  });

  it('leaves Unix line endings unchanged', () => {
    expect(normalizeLineBreaks('a\nb\nc')).toBe('a\nb\nc');
  });

  it('handles mixed line endings', () => {
    expect(normalizeLineBreaks('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('handles empty string', () => {
    expect(normalizeLineBreaks('')).toBe('');
  });
});
