import { test, expect } from './fixtures';
import {
  chooseTheme,
  expectAxeClean,
  expectInteractionPrompt,
  interact,
  launchToShip,
  moveToPoint,
  openMissionPicker,
  readSnapshot,
} from './support/game';

test('@cross-browser @smoke launch gate honors preferences and returns focus to the game', async ({ page }) => {
  await page.goto('/?seed=launch-accessibility');
  const gate = page.getByRole('dialog', { name: /library at the end of the world/i });
  await expect(gate).toBeVisible();
  await expect(gate.getByRole('status')).toContainText('Archive synchronized');
  await expectAxeClean(page, 'launch gate');

  const reduceMotion = gate.getByRole('radio', { name: 'Reduce motion' });
  await reduceMotion.focus();
  await page.keyboard.press('Space');
  await expect(reduceMotion).toBeChecked();

  const narration = gate.getByRole('checkbox', { name: /Narration/ });
  await narration.focus();
  await page.keyboard.press('Space');
  await expect(narration).not.toBeChecked();

  const begin = gate.getByRole('button', { name: /Begin the recovery mission/ });
  await expect(begin).toBeEnabled();
  await begin.focus();
  await page.keyboard.press('Enter');

  const welcome = page.getByRole('dialog', { name: 'Dialogue' });
  await expect(welcome).toBeVisible();
  await expectAxeClean(page, 'welcome dialogue');
  await welcome.getByRole('button', { name: 'Close dialogue' }).click();
  await expect(page.locator('#game-controls')).toBeFocused();
  await expect(page.getByRole('region', { name: 'Library Collection' })).toBeVisible();
  await expectAxeClean(page, 'ship library');

  await page.reload();
  const resumeGate = page.getByRole('dialog', { name: /Welcome back, Archivist/ });
  await expect(resumeGate).toBeVisible();
  await resumeGate.locator('summary').click();
  await expect(resumeGate.getByRole('radio', { name: 'Reduce motion' })).toBeChecked();
  await expect(resumeGate.getByRole('checkbox', { name: /Narration/ })).not.toBeChecked();
  await expectAxeClean(page, 'returning-player launch gate');
});

test('@cross-browser @smoke reaches a themed surface without relying on the E2E bridge', async ({ page }) => {
  await launchToShip(page, { seed: 'remote-smoke' });
  const picker = await openMissionPicker(page);
  const cathedral = picker.getByRole('article').filter({ hasText: 'Cathedral of the Last Canticle' });
  const depart = cathedral.getByRole('button', { name: /Lock coordinates/ });
  await depart.focus();
  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();
  await expect(page.getByRole('log', { name: 'Game event log' })).toContainText(
    'Arrived at Cathedral of the Last Canticle',
  );
});

test('mission picker traps focus, is data-driven, and restores focus on Escape', async ({ page }) => {
  await launchToShip(page, { seed: 'picker-focus' });
  const picker = await openMissionPicker(page);

  await expect(picker.locator('article')).toHaveCount(4);
  await expect(picker.getByRole('heading', { name: 'The Ruined Scriptorium' })).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'Cathedral of the Last Canticle' })).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'The Shattered Collegium' })).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'The Overgrown Athenaeum' })).toBeVisible();
  await expectAxeClean(page, 'mission picker');

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press(index % 2 === 0 ? 'Tab' : 'Shift+Tab');
    const focusInside = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active?.closest('[role="dialog"]'));
    });
    expect(focusInside).toBe(true);
  }

  const repeatProtection = await picker.evaluate((dialog) => {
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, summary'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) throw new Error('Mission picker has no focusable controls');

    last.focus();
    const forward = new KeyboardEvent('keydown', {
      key: 'Tab',
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(forward);
    const forwardStayedInside = dialog.contains(document.activeElement);

    first.focus();
    const backward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(backward);

    return {
      forwardPrevented: forward.defaultPrevented,
      forwardStayedInside,
      backwardPrevented: backward.defaultPrevented,
      backwardStayedInside: dialog.contains(document.activeElement),
    };
  });
  expect(repeatProtection).toEqual({
    forwardPrevented: true,
    forwardStayedInside: true,
    backwardPrevented: true,
    backwardStayedInside: true,
  });

  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.locator('#game-controls')).toBeFocused();
});

test('content load failure presents a keyboard-operable retry and recovers', async ({ page, browserErrors }) => {
  let failedOnce = false;
  await page.route('**/content/books.yaml', async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Temporary archive outage' });
      return;
    }
    await route.continue();
  });

  await page.goto('/?seed=content-retry');
  const gate = page.getByRole('dialog', { name: /library at the end of the world/i });
  await expect(gate.getByRole('alert')).toContainText('Archive loading failed');
  const retry = gate.getByRole('button', { name: 'Retry synchronization' });
  await retry.focus();
  await page.keyboard.press('Enter');

  const recoveredGate = page.getByRole('dialog', { name: /library at the end of the world/i });
  await expect(recoveredGate.getByRole('status')).toContainText('Archive synchronized');
  await expect(recoveredGate.getByRole('button', { name: /Begin the recovery mission/ })).toBeEnabled();

  const expectedFailure = /Failed to load content|Failed to load resource.*503/i;
  for (let index = browserErrors.length - 1; index >= 0; index -= 1) {
    if (expectedFailure.test(browserErrors[index])) browserErrors.splice(index, 1);
  }
});

test('legacy saves are migrated and recalled safely to the ship', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('starship-alexandria-save', JSON.stringify({
      version: 4,
      state: {
        player: {
          id: 'legacy-archivist',
          name: 'Legacy Archivist',
          currentMapId: 'dangerous-old-expedition',
          position: { x: 41, y: 41 },
        },
        library: [{ id: 'unknown-fragment', text: 'stale excerpt body' }],
        exploration: {
          visitedMaps: ['old-map'],
          discoveredNPCs: [],
          readJournals: ['vault-clue-global'],
          totalFragmentsFound: 1,
          collectedArtifacts: [],
        },
        hasSeenWelcome: true,
        settings: { ttsEnabled: false },
      },
    }));
  });

  await launchToShip(page, { seed: 'legacy-save', returning: true });
  const library = page.getByRole('region', { name: 'Library Collection' });
  await expect(library).toBeVisible();
  await expect(library.getByRole('tab', { name: 'Library 0/21' })).toBeVisible();
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Starship Alexandria - Library Deck');
});

test('Surprise Me never immediately repeats the previous destination', async ({ page }) => {
  await launchToShip(page, { seed: 'surprise-no-repeat' });
  let picker = await openMissionPicker(page);
  const first = await chooseTheme(page, picker, 'scriptorium');

  await moveToPoint(page, first.extraction);
  await expectInteractionPrompt(page, /Transporter pad/i);
  const transporter = await interact(page);
  const leave = transporter.getByRole('button', { name: /Leave anyway|Yes/ });
  await expect(leave).toBeVisible();
  await leave.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Library Collection' })).toBeVisible();

  const newExpedition = page.getByRole('button', { name: 'Begin new expedition to Earth' });
  await newExpedition.focus();
  await page.keyboard.press('Enter');
  picker = page.getByRole('dialog', { name: 'Choose the next recovery site' });
  await expect(picker).toBeVisible();
  const surprise = picker.getByRole('button', { name: /Surprise me/ });
  await surprise.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __STARSHIP_E2E__?: unknown }).__STARSHIP_E2E__);
  });
  expect((await readSnapshot(page)).themeId).not.toBe('scriptorium');
});
