import { describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';

describe('utility overlay actions', () => {
  it('opens utilities only from normal ship or exploration play', () => {
    const original = useGameStore.getState();

    try {
      useGameStore.setState((state) => ({
        session: {
          ...state.session,
          launchGateOpen: false,
          gamePhase: 'ship',
          activeUtility: null,
        },
      }));

      original.actions.openHowToPlay();
      expect(useGameStore.getState().session.activeUtility).toBe('how-to');

      original.actions.openSettings();
      expect(useGameStore.getState().session.activeUtility).toBe('how-to');

      original.actions.closeUtility();
      useGameStore.setState((state) => ({
        session: { ...state.session, gamePhase: 'dialogue' },
      }));
      original.actions.openSettings();
      expect(useGameStore.getState().session.activeUtility).toBeNull();

      useGameStore.setState((state) => ({
        session: { ...state.session, gamePhase: 'exploring' },
      }));
      original.actions.openSettings();
      expect(useGameStore.getState().session.activeUtility).toBe('settings');
    } finally {
      useGameStore.setState(original);
    }
  });

  it('preserves preferences while New Game resets progress and onboarding', () => {
    const original = useGameStore.getState();
    const preferences = {
      narrationEnabled: false,
      sfxEnabled: false,
      ambienceEnabled: true,
      masterVolume: 0.35,
      motionPreference: 'reduce' as const,
    };

    try {
      useGameStore.setState((state) => ({
        hasSeenHowToPlay: true,
        settings: preferences,
        exploration: {
          ...state.exploration,
          visitedMaps: ['old-expedition'],
        },
      }));

      original.actions.resetGame();

      const reset = useGameStore.getState();
      expect(reset.settings).toEqual(preferences);
      expect(reset.hasSeenHowToPlay).toBe(false);
      expect(reset.exploration.visitedMaps).toEqual([]);
      expect(reset.session.launchGateOpen).toBe(true);
    } finally {
      useGameStore.setState(original);
    }
  });
});
