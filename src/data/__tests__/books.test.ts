import { describe, it, expect } from 'vitest';
import { toBookFragment, fragmentWithTextToFragmentDef } from '../books';
import type { FragmentWithText } from '@/utils/contentLoader';

const sampleFragmentWithText: FragmentWithText = {
  id: 'iliad-canto-1',
  bookId: 'iliad',
  label: 'Canto I',
  order: 1,
  text: 'Sing, O goddess, the anger of Achilles...',
};

describe('fragmentWithTextToFragmentDef', () => {
  it('maps all fields from FragmentWithText to FragmentDef', () => {
    const result = fragmentWithTextToFragmentDef(sampleFragmentWithText);
    expect(result).toEqual({
      id: 'iliad-canto-1',
      bookId: 'iliad',
      label: 'Canto I',
      order: 1,
      text: 'Sing, O goddess, the anger of Achilles...',
    });
  });

  it('does not include extra properties from the input', () => {
    const extended = { ...sampleFragmentWithText, extraField: 'should be dropped' } as FragmentWithText;
    const result = fragmentWithTextToFragmentDef(extended);
    expect(Object.keys(result)).toEqual(['id', 'bookId', 'label', 'order', 'text']);
  });
});

describe('toBookFragment', () => {
  it('converts FragmentDef to BookFragment with identical shape', () => {
    const def = fragmentWithTextToFragmentDef(sampleFragmentWithText);
    const fragment = toBookFragment(def);
    expect(fragment).toEqual({
      id: 'iliad-canto-1',
      bookId: 'iliad',
      label: 'Canto I',
      order: 1,
      text: 'Sing, O goddess, the anger of Achilles...',
    });
  });

  it('handles empty text gracefully', () => {
    const def = {
      id: 'empty-frag',
      bookId: 'some-book',
      label: 'Chapter 1',
      order: 0,
      text: '',
    };
    const fragment = toBookFragment(def);
    expect(fragment.text).toBe('');
    expect(fragment.id).toBe('empty-frag');
  });
});
