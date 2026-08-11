import { expect, test } from './fixtures';
import type { E2ESnapshot, PathStep } from './support/game';
import { chooseTheme, launchToShip, openMissionPicker, planPath, readSnapshot } from './support/game';

type E2EWindow = Window & { __STARSHIP_E2E__?: E2ESnapshot };

/**
 * Every other project runs with reducedMotion: 'reduce', so scene transitions
 * take their instant code paths. These @motion tests are the only coverage the
 * animated paths get: the beam-down tween chain must still hand off to
 * ExploreScene, and grid input must still unlock after the location card.
 */
test.describe('animated transitions @motion', () => {
  test('animated beam-down reaches the surface and unlocks input', async ({ page }) => {
    await launchToShip(page, { seed: 'motion-animated-beam' });
    const picker = await openMissionPicker(page);

    // chooseTheme waits for the surface snapshot; under full motion this only
    // resolves if the animated beam sequence completes its handoff.
    const snapshot = await chooseTheme(page, picker, 'scriptorium');
    expect(snapshot.themeId).toBe('scriptorium');

    // Prove this project actually routed down the animated branch: the scene
    // resolved the motion preference to full motion, so the beam-down and the
    // step animations below ran their tween chains rather than the instant path.
    const motionEnabled = await page.evaluate(
      () => (window as E2EWindow).__STARSHIP_E2E__?.motionEnabled,
    );
    expect(motionEnabled).toBe(true);

    await page.waitForFunction(
      () => (window as E2EWindow).__STARSHIP_E2E__?.inputReady === true,
    );

    // One real movement step, route derived with BFS. The player spawns on the
    // transporter pad, so route toward the vault (never the spawn tile), with
    // the other entities as fallback targets.
    const step = firstRouteStep(snapshot);
    await page.locator('#game-controls').focus();

    // Arm the mid-step observer before pressing so the 150ms tween cannot
    // finish before we start watching for it.
    const midStepSeen = page.waitForFunction(
      () => (window as E2EWindow).__STARSHIP_E2E__?.playerMidStep === true,
    );
    await page.keyboard.press(step.key);
    await midStepSeen;

    await page.waitForFunction(({ x, y }) => {
      const player = (window as E2EWindow).__STARSHIP_E2E__?.player;
      return player?.x === x && player?.y === y;
    }, step.to);

    const after = await readSnapshot(page);
    expect(after.player).toEqual(step.to);
  });
});

/** First step of the first non-empty BFS route to the vault or any other entity. */
function firstRouteStep(snapshot: E2ESnapshot): PathStep {
  const candidates: Array<{ target: { x: number; y: number }; range: 'on' | 'adjacent' }> = [
    { target: snapshot.vault.position, range: 'adjacent' },
    ...snapshot.entities.map((entity) => ({
      target: entity.position,
      range: entity.blocksMovement ? ('adjacent' as const) : ('on' as const),
    })),
  ];
  for (const { target, range } of candidates) {
    try {
      const path = planPath(snapshot, target, range);
      if (path.length) return path[0];
    } catch {
      // Unreachable from spawn — try the next candidate.
    }
  }
  throw new Error('No BFS route with at least one step from the spawn tile');
}
