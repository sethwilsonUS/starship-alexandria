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
  const gate = page.getByRole('dialog', { name: 'How to Play' });
  await expect(gate.getByRole('status')).toContainText('Archive synchronized');
  await expect(page).toHaveScreenshot('launch-gate.png', { fullPage: true });

  const desktopViewport = page.viewportSize();
  if (!desktopViewport) throw new Error('Visual project must define a viewport');
  await page.setViewportSize({
    width: Math.floor(desktopViewport.width / 2),
    height: Math.floor(desktopViewport.height / 2),
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const playNarration = gate.getByRole('button', { name: 'Play narrated guide' });
  await playNarration.scrollIntoViewIfNeeded();
  await expect(playNarration).toBeInViewport();
  await playNarration.focus();
  await expect(playNarration).toBeFocused();
  const beginMission = gate.getByRole('button', { name: 'Begin recovery mission' });
  await beginMission.scrollIntoViewIfNeeded();
  await expect(beginMission).toBeInViewport();
  await page.setViewportSize(desktopViewport);

  await beginMission.click();
  await expect(page).toHaveScreenshot('ship.png', { fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(page).toHaveScreenshot('settings.png', { fullPage: true });
  await page.setViewportSize({
    width: Math.floor(desktopViewport.width / 2),
    height: Math.floor(desktopViewport.height / 2),
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const closeSettings = settings.getByRole('button', { name: 'Close Settings' });
  await closeSettings.scrollIntoViewIfNeeded();
  await expect(closeSettings).toBeInViewport();
  const doneSettings = settings.getByRole('button', { name: 'Done' });
  await doneSettings.scrollIntoViewIfNeeded();
  await expect(doneSettings).toBeInViewport();
  await page.setViewportSize(desktopViewport);
  await doneSettings.click();

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
