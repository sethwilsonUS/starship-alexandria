import { describe, expect, it } from 'vitest';
import guideDocument from '../../../public/content/how-to-play.json';
import { buildHowToPlayNarration, HOW_TO_PLAY } from '../../content/howToPlay';
import { getHowToPlayVoiceLines } from '../../../scripts/lib/how-to-play-voice-lines.mjs';

describe('How to Play recorded narration', () => {
  it('builds the generator and browser text from the same authored content', () => {
    const [line] = getHowToPlayVoiceLines(guideDocument);

    expect(line.lineId).toBe('how-to-play.guide.01');
    expect(line.text).toBe(buildHowToPlayNarration(HOW_TO_PLAY));
    expect(line.text).toContain('There is no combat, death, or timer');
    expect(line.text).toContain('Press the question mark key');
    expect(line.text).toContain('Press O to open Options');
    expect(line.textHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('rejects unsafe line IDs and incomplete sections', () => {
    expect(() => getHowToPlayVoiceLines({ ...guideDocument, voiceLineId: '../guide' }))
      .toThrow('voiceLineId "../guide" is invalid');
    expect(() => getHowToPlayVoiceLines({ ...guideDocument, sections: [] }))
      .toThrow('sections must be a non-empty array');
  });
});
