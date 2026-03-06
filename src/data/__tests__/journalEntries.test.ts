import { describe, it, expect } from 'vitest';
import { yamlToJournal } from '../journalEntries';
import type { JournalYaml } from '@/utils/contentLoader';

const sampleJournalYaml: JournalYaml = {
  id: 'journal-001',
  title: 'A Scrap of Paper',
  lines: [
    { text: 'You find a crumpled note tucked inside a desk drawer.' },
    { speaker: 'Note', text: 'Day 47. The library at Fifth and Main is still standing.' },
    { speaker: 'Note', text: 'If anyone reads this — the basement has supplies.' },
  ],
};

describe('yamlToJournal', () => {
  it('maps id and title from YAML', () => {
    const journal = yamlToJournal(sampleJournalYaml);
    expect(journal.id).toBe('journal-001');
    expect(journal.title).toBe('A Scrap of Paper');
  });

  it('converts lines preserving speaker and text', () => {
    const journal = yamlToJournal(sampleJournalYaml);
    expect(journal.lines).toHaveLength(3);
    expect(journal.lines[1]).toEqual({
      speaker: 'Note',
      text: 'Day 47. The library at Fifth and Main is still standing.',
    });
  });

  it('handles lines without a speaker', () => {
    const journal = yamlToJournal(sampleJournalYaml);
    expect(journal.lines[0].speaker).toBeUndefined();
    expect(journal.lines[0].text).toBe('You find a crumpled note tucked inside a desk drawer.');
  });

  it('handles empty lines array', () => {
    const empty: JournalYaml = {
      id: 'empty-journal',
      title: 'Blank Page',
      lines: [],
    };
    const journal = yamlToJournal(empty);
    expect(journal.lines).toEqual([]);
  });
});
