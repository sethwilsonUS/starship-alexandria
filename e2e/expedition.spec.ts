import { test, expect } from './fixtures';
import {
  chooseTheme,
  expectAxeClean,
  expectInteractionPrompt,
  interact,
  launchToShip,
  moveToEntity,
  moveToPoint,
  openMissionPicker,
  readSnapshot,
} from './support/game';

test('@cross-browser completes a keyboard-only expedition using independently computed BFS paths', async ({ page }) => {
  // This journey waits for every real 150 ms movement tween. GitHub's slower
  // Chromium runners have historically needed about 106 seconds, so keep its
  // headroom local to this intentionally long test instead of relaxing the suite.
  test.setTimeout(180_000);

  await launchToShip(page, { seed: 'keyboard-full-loop' });
  const picker = await openMissionPicker(page);
  await chooseTheme(page, picker, 'scriptorium');

  const beforeGuide = await readSnapshot(page);
  await page.getByRole('button', { name: /How to Play/ }).click();
  const surfaceGuide = page.getByRole('dialog', { name: 'How to Play' });
  await expect(surfaceGuide).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expectAxeClean(page, 'surface How to Play guide');
  await page.keyboard.press('Escape');
  const afterGuide = await readSnapshot(page);
  expect(afterGuide.player).toEqual(beforeGuide.player);

  const gameControls = page.locator('#game-controls');
  await gameControls.focus();
  await page.keyboard.press('KeyO');
  const surfaceSettings = page.getByRole('dialog', { name: 'Options' });
  await expect(surfaceSettings).toBeVisible();
  await expect(surfaceSettings.getByRole('heading', { name: 'Options' })).toBeFocused();
  const beforeOptionsInput = await readSnapshot(page);
  await page.keyboard.press('ArrowRight');
  expect((await readSnapshot(page)).player).toEqual(beforeOptionsInput.player);
  await expectAxeClean(page, 'surface Options dialog');
  await page.keyboard.press('Escape');
  await expect(surfaceSettings).toBeHidden();
  await expect(gameControls).toBeFocused();

  await moveToEntity(page, 'map');
  await expectInteractionPrompt(page, /Area map/i);
  const mapPickup = await interact(page);
  await expect(mapPickup).toContainText('You picked up the map');
  await expectAxeClean(page, 'map pickup dialogue');
  await mapPickup.getByRole('button', { name: 'Close dialogue' }).click();

  await gameControls.focus();
  await page.keyboard.press('KeyM');
  const map = page.getByRole('dialog', { name: 'Area Map' });
  await expect(map).toBeVisible();
  await expect(map.getByRole('button', { name: 'Close area map' })).toBeFocused();
  await expect(map.getByRole('region', { name: 'Text map' })).toContainText('walking distance');
  await expect(map.getByRole('listitem').first()).toContainText(/steps away/);
  await expectAxeClean(page, 'textual area map');
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  await expect(page.locator('#game-controls')).toBeFocused();

  await moveToEntity(page, 'npc', 'adjacent');
  await expectInteractionPrompt(page, /talk/i);
  const npcDialogue = await interact(page);
  await expectAxeClean(page, 'NPC dialogue');
  await npcDialogue.getByRole('button', { name: 'Close dialogue' }).click();

  await moveToEntity(page, 'fragment');
  await expectInteractionPrompt(page, /Book fragment/i);
  await page.keyboard.press('KeyE');
  const reader = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(reader).toBeVisible();
  await expect(reader.getByText('Public domain in the USA', { exact: false })).toBeVisible();
  await expectAxeClean(page, 'reading view');
  const sourceLink = reader.getByRole('link', { name: /Project Gutenberg/ });
  await sourceLink.evaluate((element) => {
    const testWindow = window as Window & { __SOURCE_LINK_ACTIVATED__?: boolean };
    testWindow.__SOURCE_LINK_ACTIVATED__ = false;
    element.addEventListener('click', (event) => {
      event.preventDefault();
      testWindow.__SOURCE_LINK_ACTIVATED__ = true;
    }, { once: true });
  });
  await sourceLink.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __SOURCE_LINK_ACTIVATED__?: boolean }).__SOURCE_LINK_ACTIVATED__,
  )).toBe(true);
  await expect(reader).toBeVisible();
  const closeReader = reader.getByRole('button', { name: 'Close reading view' });
  await closeReader.focus();
  await page.keyboard.press('Enter');

  await moveToEntity(page, 'clue');
  await expectInteractionPrompt(page, /catalog card/i);
  const clueDialogue = await interact(page);
  await expect(clueDialogue).toContainText(/figures|catalog/i);
  await clueDialogue.getByRole('button', { name: 'Close dialogue' }).click();

  const snapshot = await readSnapshot(page);
  await moveToPoint(page, snapshot.vault.position, 'adjacent');
  await expectInteractionPrompt(page, /Archive Safe/i);
  const vaultDialogue = await interact(page);
  await expect(vaultDialogue).toContainText(/archive|mechanism|dials/i);
  await expectAxeClean(page, 'vault dialogue');
  await vaultDialogue.getByRole('button', { name: 'Close dialogue' }).click();

  await moveToPoint(page, snapshot.extraction);
  await expectInteractionPrompt(page, /Transporter pad/i);
  const transporter = await interact(page);
  const leave = transporter.getByRole('button', { name: /Yes|Leave anyway/ });
  await expect(leave).toBeVisible();
  await leave.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('region', { name: 'Library Collection' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => '__STARSHIP_E2E__' in window)).toBe(false);
});
