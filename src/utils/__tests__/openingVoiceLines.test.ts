import { describe, expect, it } from 'vitest';
import { getOpeningVoiceLines } from '../../../scripts/lib/opening-voice-lines.mjs';

function gameloopWith(lines: unknown[]) {
  return { welcome: { lines } };
}

describe('getOpeningVoiceLines', () => {
  it('returns recorded lines while allowing narration without a recorded clip', () => {
    expect(
      getOpeningVoiceLines(
        gameloopWith([
          { text: 'This line uses browser narration.' },
          { text: 'Welcome aboard.', voiceLineId: 'opening.welcome.01' },
        ])
      )
    ).toEqual([
      {
        lineId: 'opening.welcome.01',
        text: 'Welcome aboard.',
        textHash: '0d7f44886abaf159',
      },
    ]);
  });

  it.each([
    [null, 'welcome.lines[0] must be an object'],
    ['not an object', 'welcome.lines[0] must be an object'],
    [[], 'welcome.lines[0] must be an object'],
  ])('rejects a malformed line %# with an indexed error', (line, message) => {
    expect(() => getOpeningVoiceLines(gameloopWith([line]))).toThrow(message);
  });

  it.each([
    [{ voiceLineId: 'opening.welcome.01' }, 'welcome.lines[0].text must be a non-blank string'],
    [
      { text: 42, voiceLineId: 'opening.welcome.01' },
      'welcome.lines[0].text must be a non-blank string',
    ],
    [
      { text: '   ', voiceLineId: 'opening.welcome.01' },
      'welcome.lines[0].text must be a non-blank string',
    ],
  ])('rejects invalid text with an indexed error %#', (line, message) => {
    expect(() => getOpeningVoiceLines(gameloopWith([line]))).toThrow(message);
  });

  it.each([
    [null, 'welcome.lines[0].voiceLineId must be a non-blank string when provided'],
    [17, 'welcome.lines[0].voiceLineId must be a non-blank string when provided'],
    ['  ', 'welcome.lines[0].voiceLineId must be a non-blank string when provided'],
  ])('rejects a malformed voiceLineId with an indexed error %#', (voiceLineId, message) => {
    expect(() =>
      getOpeningVoiceLines(gameloopWith([{ text: 'Welcome aboard.', voiceLineId }]))
    ).toThrow(message);
  });

  it('retains safe-ID validation with an indexed error', () => {
    expect(() =>
      getOpeningVoiceLines(
        gameloopWith([{ text: 'Welcome aboard.', voiceLineId: '../Opening Welcome' }])
      )
    ).toThrow(
      'welcome.lines[0].voiceLineId "../Opening Welcome" is invalid; use lowercase letters, digits, dots, dashes, or underscores'
    );
  });

  it('retains duplicate voiceLineId validation with both indexes', () => {
    expect(() =>
      getOpeningVoiceLines(
        gameloopWith([
          { text: 'First.', voiceLineId: 'opening.welcome.01' },
          { text: 'Second.', voiceLineId: 'opening.welcome.01' },
        ])
      )
    ).toThrow(
      'welcome.lines[1].voiceLineId duplicates "opening.welcome.01" from welcome.lines[0]'
    );
  });
});
