import { expect, test } from './fixtures';
import type { E2ESnapshot, Point } from './support/game';
import { chooseTheme, launchToShip, openMissionPicker, readSnapshot } from './support/game';

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

    await page.waitForFunction(
      () => (window as E2EWindow).__STARSHIP_E2E__?.inputReady === true,
    );

    // One real movement step with movement tweens enabled.
    const step = firstWalkableStep(snapshot);
    await page.locator('#game-controls').focus();
    await page.keyboard.press(step.key);
    await page.waitForFunction(({ x, y }) => {
      const player = (window as E2EWindow).__STARSHIP_E2E__?.player;
      return player?.x === x && player?.y === y;
    }, step.to);

    const after = await readSnapshot(page);
    expect(after.player).toEqual(step.to);
  });
});

interface WalkableStep {
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
  to: Point;
}

function firstWalkableStep(snapshot: E2ESnapshot): WalkableStep {
  const { player, cells, entities, vault } = snapshot;
  const blocked = new Set(
    entities.filter((entity) => entity.blocksMovement).map((entity) => `${entity.position.x},${entity.position.y}`),
  );
  blocked.add(`${vault.position.x},${vault.position.y}`);

  const candidates: WalkableStep[] = [
    { key: 'ArrowRight', to: { x: player.x + 1, y: player.y } },
    { key: 'ArrowLeft', to: { x: player.x - 1, y: player.y } },
    { key: 'ArrowDown', to: { x: player.x, y: player.y + 1 } },
    { key: 'ArrowUp', to: { x: player.x, y: player.y - 1 } },
  ];
  for (const candidate of candidates) {
    const { x, y } = candidate.to;
    if (cells[y]?.[x]?.walkable && !blocked.has(`${x},${y}`)) return candidate;
  }
  throw new Error(`Player at ${player.x},${player.y} has no walkable neighbor`);
}
