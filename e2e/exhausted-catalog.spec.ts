import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { test, expect } from './fixtures';
import {
  chooseTheme,
  expectInteractionPrompt,
  interact,
  launchToShip,
  moveToEntity,
  moveToPoint,
  readSnapshot,
} from './support/game';

interface BooksYaml {
  books: Array<{ fragments: Array<{ id: string }> }>;
}

const catalog = YAML.parse(
  readFileSync(resolve(process.cwd(), 'public/content/books.yaml'), 'utf8'),
) as BooksYaml;
const allFragmentIds = catalog.books.flatMap((book) => book.fragments.map((fragment) => fragment.id));

test('an exhausted catalog still allows expeditions and grants the vault supply reward', async ({ page }) => {
  expect(allFragmentIds).toHaveLength(21);
  await page.addInitScript((fragmentIds) => {
    localStorage.setItem('starship-alexandria-save', JSON.stringify({
      version: 5,
      state: {
        schemaVersion: 5,
        player: {
          id: 'complete-archivist',
          name: 'Complete Archivist',
          flashlightBattery: 100,
          spareBatteries: 0,
        },
        collectedFragmentIds: fragmentIds,
        exploration: {
          visitedMaps: [],
          discoveredNPCs: [],
          readJournals: [],
          totalFragmentsFound: fragmentIds.length,
          collectedArtifacts: [],
        },
        hasSeenWelcome: true,
        settings: {
          narrationEnabled: false,
          sfxEnabled: false,
          ambienceEnabled: false,
          masterVolume: 0.7,
          motionPreference: 'reduce',
        },
        previousThemeId: null,
      },
    }));
  }, allFragmentIds);

  await launchToShip(page, { seed: 'exhausted-catalog', returning: true });
  const library = page.getByRole('region', { name: 'Library Collection' });
  await expect(library).toContainText('Mission Complete');
  const newExpedition = library.getByRole('button', { name: 'Begin another expedition to Earth' });
  await expect(newExpedition).toBeVisible();
  await newExpedition.focus();
  await page.keyboard.press('Enter');

  const picker = page.getByRole('dialog', { name: 'Choose the next recovery site' });
  await expect(picker).toBeVisible();
  await chooseTheme(page, picker, 'scriptorium');

  await moveToEntity(page, 'clue');
  await expectInteractionPrompt(page, /catalog card/i);
  const clue = await interact(page);
  await expect(clue).toContainText(/figures|catalog/i);
  await clue.getByRole('button', { name: 'Close dialogue' }).click();

  const snapshot = await readSnapshot(page);
  await moveToPoint(page, snapshot.vault.position, 'adjacent');
  await expectInteractionPrompt(page, /Archive Safe/i);
  const vault = await interact(page);
  await expect(vault).toContainText(/archive dials|misfiled card/i);
  await advanceDialogueUntil(vault, /complete catalogue|leave room for what comes next/i);
  await expect(vault).toContainText(/complete catalogue|leave room for what comes next/i);
  await expect(page.getByLabel('Spare batteries. Press B to use.')).toContainText('2');
});

async function advanceDialogueUntil(dialog: import('@playwright/test').Locator, target: RegExp): Promise<void> {
  const text = dialog.locator('#dialogue-text');
  for (let line = 0; line < 6; line += 1) {
    const before = (await text.textContent()) ?? '';
    if (target.test(before)) return;
    await expect.poll(async () => {
      const current = (await text.textContent()) ?? '';
      if (current !== before) return true;
      const advance = dialog.getByRole('button', { name: /Continue|Show full line/ });
      if (await advance.isVisible()) await advance.click();
      return false;
    }, {
      timeout: 5_000,
      intervals: [50, 100],
      message: 'Dialogue did not advance to the exhausted-catalog lore reward',
    }).toBe(true);
  }
  throw new Error('Exhausted-catalog lore reward never appeared in the vault dialogue');
}
