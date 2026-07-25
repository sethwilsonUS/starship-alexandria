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

test('@cross-browser @smoke onboarding and persistent utilities remain accessible across reload and New Game', async ({ page }) => {
  const guideVoiceRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/audio/voices/how-to-play/')) {
      guideVoiceRequests.push(request.url());
    }
  });
  await page.goto('/?seed=launch-accessibility');
  const guide = page.getByRole('dialog', { name: 'How to Play' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('heading', { name: 'How to Play', level: 1 })).toBeFocused();
  await expect(guide.getByRole('heading', { name: 'Your recovery loop' })).toBeVisible();
  await expect(guide).toContainText('There is no combat, death, or timer');
  await expect(guide.locator('.launch-gate__status')).toContainText('Archive synchronized');
  await expect(guide.getByRole('button', { name: 'Play narrated guide' })).toBeVisible();
  expect(guideVoiceRequests).toEqual([]);
  await expectAxeClean(page, 'first-run How to Play guide');

  await page.keyboard.press('Escape');
  await expect(guide).toBeVisible();

  const playGuide = guide.getByRole('button', { name: 'Play narrated guide' });
  await playGuide.focus();
  await page.keyboard.press('Enter');
  await expect(guide.getByRole('button', { name: 'Stop narrated guide' })).toBeVisible();
  await expect.poll(() => guideVoiceRequests.length).toBeGreaterThan(0);
  await guide.getByRole('button', { name: 'Stop narrated guide' }).click();
  await expect(guide.getByRole('button', { name: 'Play narrated guide' })).toBeVisible();

  const begin = guide.getByRole('button', { name: 'Begin recovery mission' });
  await expect(begin).toBeEnabled();
  await begin.focus();
  await page.keyboard.press('Enter');

  await expect(guide).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Dialogue' })).toHaveCount(0);
  await expect(page.locator('#game-controls')).toBeFocused();
  await expect(page.getByRole('region', { name: 'Library Collection' })).toBeVisible();
  await expectAxeClean(page, 'ship library with utility controls');

  const settingsButton = page.getByRole('button', { name: 'Settings' });
  await settingsButton.focus();
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('heading', { name: 'Settings' })).toBeFocused();
  await expectAxeClean(page, 'Settings dialog');

  const reduceMotion = settings.getByRole('radio', { name: 'Reduce motion' });
  await reduceMotion.focus();
  await page.keyboard.press('Space');
  await expect(reduceMotion).toBeChecked();

  const narration = settings.getByRole('checkbox', { name: /Narration/ });
  await narration.focus();
  await page.keyboard.press('Space');
  await expect(narration).not.toBeChecked();

  const volume = settings.getByRole('slider', { name: 'Master volume' });
  await volume.fill('0.35');
  await expect(settings.getByText('35%')).toBeVisible();

  const done = settings.getByRole('button', { name: 'Done' });
  await done.focus();
  await page.keyboard.press('Enter');
  await expect(settings).toBeHidden();
  await expect(settingsButton).toBeFocused();

  await page.locator('#game-controls').focus();
  await page.keyboard.press('Shift+/');
  const refresher = page.getByRole('dialog', { name: 'How to Play' });
  await expect(refresher).toBeVisible();
  await expect(refresher.getByRole('heading', { name: 'How to Play', level: 2 })).toBeFocused();
  await expect(refresher).toContainText('Prerecorded guide narration is off in Settings');
  await expect(refresher.getByRole('button', { name: /narrated guide/ })).toHaveCount(0);
  await expectAxeClean(page, 'How to Play refresher');
  await page.keyboard.press('Escape');
  await expect(refresher).toBeHidden();
  await expect(page.locator('#game-controls')).toBeFocused();

  const picker = await openMissionPicker(page);
  await page.keyboard.press('Shift+/');
  await expect(picker).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'How to Play' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.reload();
  const resumeGate = page.getByRole('dialog', { name: /Welcome back, Archivist/ });
  await expect(resumeGate).toBeVisible();
  await expect(resumeGate.getByRole('checkbox')).toHaveCount(0);
  await expect(resumeGate.getByRole('radio')).toHaveCount(0);
  await expectAxeClean(page, 'returning-player launch gate');

  const resume = resumeGate.getByRole('button', { name: 'Resume aboard Alexandria' });
  await resume.focus();
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: 'Settings' }).click();
  const persistedSettings = page.getByRole('dialog', { name: 'Settings' });
  await expect(persistedSettings.getByRole('radio', { name: 'Reduce motion' })).toBeChecked();
  await expect(persistedSettings.getByRole('checkbox', { name: /Narration/ })).not.toBeChecked();
  await expect(persistedSettings.getByRole('slider', { name: 'Master volume' })).toHaveValue('0.35');
  await persistedSettings.getByRole('button', { name: 'Done' }).click();

  page.once('dialog', (confirmation) => confirmation.accept());
  await page.getByRole('button', { name: 'Start a new game from the beginning' }).click();
  const resetGuide = page.getByRole('dialog', { name: 'How to Play' });
  await expect(resetGuide).toBeVisible();
  await resetGuide.getByRole('button', { name: 'Begin recovery mission' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const resetSettings = page.getByRole('dialog', { name: 'Settings' });
  await expect(resetSettings.getByRole('radio', { name: 'Reduce motion' })).toBeChecked();
  await expect(resetSettings.getByRole('checkbox', { name: /Narration/ })).not.toBeChecked();
  await expect(resetSettings.getByRole('slider', { name: 'Master volume' })).toHaveValue('0.35');
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
  const gate = page.getByRole('dialog', { name: 'How to Play' });
  await expect(gate.getByRole('alert')).toContainText('Archive loading failed');
  const retry = gate.getByRole('button', { name: 'Retry synchronization' });
  await retry.focus();
  await page.keyboard.press('Enter');

  const recoveredGate = page.getByRole('dialog', { name: 'How to Play' });
  await expect(recoveredGate.getByRole('status')).toContainText('Archive synchronized');
  await expect(recoveredGate.getByRole('button', { name: /Begin recovery mission/ })).toBeEnabled();

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
