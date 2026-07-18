import { afterEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';

const initialVolume = useGameStore.getState().settings.masterVolume;

afterEach(() => {
  useGameStore.getState().actions.setMasterVolume(initialVolume);
});

describe('settings actions', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'normalizes non-finite master volume %s to silence',
    (volume) => {
      useGameStore.getState().actions.setMasterVolume(0.4);

      useGameStore.getState().actions.setMasterVolume(volume);

      expect(useGameStore.getState().settings.masterVolume).toBe(0);
    },
  );
});
