import { test, expect } from './fixtures';
import {
  chooseTheme,
  launchToShip,
  openMissionPicker,
  type ThemeId,
} from './support/game';

const themes: ThemeId[] = ['scriptorium', 'cathedral', 'university', 'gardens'];

for (const themeId of themes) {
  test(`@visual ${themeId} launches a deterministic semantic expedition`, async ({ page }) => {
    await launchToShip(page, { seed: `theme-${themeId}` });
    const picker = await openMissionPicker(page);
    const snapshot = await chooseTheme(page, picker, themeId);

    expect(snapshot.themeId).toBe(themeId);
    expect(snapshot.seed).toBe(`theme-${themeId}`);
    expect(snapshot.cells.length).toBeGreaterThan(20);
    expect(snapshot.cells[0].length).toBeGreaterThan(20);
    expect(snapshot.cells.flat().some((cell) => cell.walkable)).toBe(true);
    expect(snapshot.entities.some((entity) => entity.kind === 'map')).toBe(true);
    expect(snapshot.entities.some((entity) => entity.kind === 'npc')).toBe(true);
    expect(snapshot.entities.some((entity) => entity.kind === 'clue')).toBe(true);
    await expect(page.getByRole('banner', { name: 'Game status' })).toBeVisible();

    await expect(page).toHaveScreenshot(`${themeId}-destination.png`, {
      fullPage: true,
    });
  });
}
