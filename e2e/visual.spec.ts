import { test, expect } from './fixtures';
import {
  chooseTheme,
  expectInteractionPrompt,
  launchToShip,
  moveToEntity,
  openMissionPicker,
} from './support/game';

test('@visual launch, ship, and destination registry remain visually stable', async ({ page }) => {
  await page.goto('/?seed=visual-shell');
  const gate = page.getByRole('dialog', { name: /library at the end of the world/i });
  await expect(gate.getByRole('status')).toContainText('Archive synchronized');
  await expect(page).toHaveScreenshot('launch-gate.png', { fullPage: true });

  const reduceMotion = gate.getByRole('radio', { name: 'Reduce motion' });
  await reduceMotion.check();
  await gate.getByRole('checkbox', { name: /Narration/ }).uncheck();
  await gate.getByRole('button', { name: /Begin the recovery mission/ }).click();
  const welcome = page.getByRole('dialog', { name: 'Dialogue' });
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: 'Close dialogue' }).click();
  await expect(page).toHaveScreenshot('ship.png', { fullPage: true });

  const picker = await openMissionPicker(page);
  const missionButtons = picker.locator('.mission-card__button');
  await expect(missionButtons).toHaveCount(4);
  for (const button of await missionButtons.all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }
  await expect(picker.locator('.mission-picker__footer')).toBeInViewport({ ratio: 1 });
  await expect(page).toHaveScreenshot('mission-picker.png', { fullPage: true });
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
});

test('@visual textual map and reader remain stable and operable at 200% zoom', async ({ page }) => {
  await launchToShip(page, { seed: 'visual-content-overlays' });
  const picker = await openMissionPicker(page);
  await chooseTheme(page, picker, 'scriptorium');

  await moveToEntity(page, 'map');
  await expectInteractionPrompt(page, /Area map/i);
  await page.keyboard.press('KeyE');
  const pickup = page.getByRole('dialog', { name: 'Dialogue' });
  await expect(pickup).toContainText('You picked up the map');
  await pickup.getByRole('button', { name: 'Close dialogue' }).click();
  await page.locator('#game-controls').focus();
  await page.keyboard.press('KeyM');

  const map = page.getByRole('dialog', { name: 'Area Map' });
  await expect(map).toBeVisible();
  await expect(page).toHaveScreenshot('textual-map.png', { fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  const textMap = map.getByRole('region', { name: 'Text map' });
  await textMap.focus();
  await expect(textMap).toBeFocused();
  const closeMap = map.getByRole('button', { name: 'Close area map' });
  await closeMap.scrollIntoViewIfNeeded();
  await expect(closeMap).toBeInViewport();
  await page.evaluate(() => { document.documentElement.style.zoom = '1'; });
  await closeMap.click();

  await moveToEntity(page, 'fragment');
  await expectInteractionPrompt(page, /Book fragment/i);
  await page.keyboard.press('KeyE');
  const reader = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(reader).toBeVisible();
  await expect(page).toHaveScreenshot('reader.png', { fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  const closeReader = reader.getByRole('button', { name: 'Close reading view' });
  await closeReader.scrollIntoViewIfNeeded();
  await expect(closeReader).toBeInViewport();
  await closeReader.focus();
  await expect(closeReader).toBeFocused();
});
