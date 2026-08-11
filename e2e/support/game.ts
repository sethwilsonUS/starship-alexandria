import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';

export type ThemeId = 'scriptorium' | 'cathedral' | 'university' | 'gardens';
export type EntityKind = 'fragment' | 'npc' | 'journal' | 'map' | 'clue' | 'prop';

export interface Point {
  x: number;
  y: number;
}

export interface E2ESnapshot {
  inputReady: boolean;
  motionEnabled: boolean;
  playerMidStep: boolean;
  seed: string;
  themeId: ThemeId;
  cells: Array<Array<{ walkable: boolean; surface: string; zoneId: string | null }>>;
  player: Point;
  extraction: Point;
  entities: Array<{
    id: string;
    kind: EntityKind;
    position: Point;
    blocksMovement: boolean;
  }>;
  vault: { id: string; position: Point; clueId: string };
}

const themeTitles: Record<ThemeId, string> = {
  scriptorium: 'The Ruined Scriptorium',
  cathedral: 'Cathedral of the Last Canticle',
  university: 'The Shattered Collegium',
  gardens: 'The Overgrown Athenaeum',
};

export async function expectAxeClean(page: Page, surface: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const details = result.violations.map((violation) => {
    const targets = violation.nodes.flatMap((node) => node.target).join(', ');
    return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}; ${targets}`;
  });
  expect(result.violations, `${surface} accessibility violations:\n${details.join('\n')}`).toEqual([]);
}

export async function launchToShip(page: Page, options: { seed?: string; returning?: boolean } = {}): Promise<void> {
  const query = new URLSearchParams({ seed: options.seed ?? 'playwright-archive' });
  await page.goto(`/?${query.toString()}`);

  const gate = page.getByRole('dialog', {
    name: options.returning ? /Welcome back, Archivist/ : 'How to Play',
  });
  await expect(gate).toBeVisible();
  await expect(gate.getByRole('status')).toContainText('Archive synchronized');

  const begin = gate.getByRole('button', {
    name: options.returning ? /Resume aboard Alexandria/ : /Begin recovery mission/,
  });
  await expect(begin).toBeEnabled();
  await begin.focus();
  await page.keyboard.press('Enter');
  await expect(gate).toBeHidden();

  await expect(page.getByRole('region', { name: 'Library Collection' })).toBeVisible();
  await expect(page.locator('#game-controls')).toBeFocused();
}

export async function openMissionPicker(page: Page): Promise<Locator> {
  const controls = page.locator('#game-controls');
  await controls.focus();
  await page.keyboard.press('Space');
  const picker = page.getByRole('dialog', { name: 'Choose the next recovery site' });
  await expect(picker).toBeVisible();
  return picker;
}

export async function chooseTheme(page: Page, picker: Locator, themeId: ThemeId): Promise<E2ESnapshot> {
  const heading = picker.getByRole('heading', { name: themeTitles[themeId] });
  await expect(heading).toBeVisible();
  const card = picker.getByRole('article').filter({ hasText: themeTitles[themeId] });
  const depart = card.getByRole('button', { name: /Lock coordinates/ });
  await expect(depart).toBeVisible();
  await depart.focus();
  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();
  await page.waitForFunction((expectedTheme) => {
    const snapshot = (window as Window & { __STARSHIP_E2E__?: E2ESnapshot }).__STARSHIP_E2E__;
    return snapshot?.themeId === expectedTheme;
  }, themeId);
  return readSnapshot(page);
}

export async function readSnapshot(page: Page): Promise<E2ESnapshot> {
  return page.evaluate(() => {
    const snapshot = (window as Window & { __STARSHIP_E2E__?: E2ESnapshot }).__STARSHIP_E2E__;
    if (!snapshot) throw new Error('E2E snapshot is unavailable');
    return snapshot;
  });
}

export async function moveToEntity(page: Page, kind: EntityKind, range: 'on' | 'adjacent' = 'on'): Promise<void> {
  const snapshot = await readSnapshot(page);
  const entity = snapshot.entities.find((candidate) => candidate.kind === kind);
  if (!entity) throw new Error(`Generated expedition has no ${kind} entity`);
  await moveToPoint(page, entity.position, range);
}

/** BFS keyboard route from the snapshot's player position to the target, honoring blockers. */
export function planPath(snapshot: E2ESnapshot, target: Point, range: 'on' | 'adjacent' = 'on'): PathStep[] {
  const blocked = new Set(
    snapshot.entities
      .filter((entity) => entity.blocksMovement)
      .map((entity) => pointKey(entity.position)),
  );
  blocked.add(pointKey(snapshot.vault.position));

  const goals = range === 'on'
    ? [target]
    : neighbors(target).filter((point) => isWalkable(snapshot, point) && !blocked.has(pointKey(point)));
  const path = bfs(snapshot, snapshot.player, goals, blocked);
  if (!path) throw new Error(`No keyboard path from ${pointKey(snapshot.player)} to ${range} ${pointKey(target)}`);
  return path;
}

export async function moveToPoint(page: Page, target: Point, range: 'on' | 'adjacent' = 'on'): Promise<void> {
  const snapshot = await readSnapshot(page);
  const path = planPath(snapshot, target, range);

  await page.locator('#game-controls').focus();
  await page.waitForFunction(() => {
    return (window as Window & { __STARSHIP_E2E__?: E2ESnapshot }).__STARSHIP_E2E__?.inputReady === true;
  });
  for (const step of path) {
    await page.keyboard.press(step.key);
    await page.waitForFunction(
      ({ x, y }) => {
        const current = (window as Window & { __STARSHIP_E2E__?: E2ESnapshot }).__STARSHIP_E2E__?.player;
        return current?.x === x && current?.y === y;
      },
      step.to,
    );
  }
}

export async function interact(page: Page): Promise<Locator> {
  await page.keyboard.press('KeyE');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function expectInteractionPrompt(page: Page, name: RegExp): Promise<Locator> {
  const prompt = page.getByRole('status', { name });
  await expect(prompt).toBeVisible();
  return prompt;
}

export interface PathStep {
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
  to: Point;
}

function bfs(
  snapshot: E2ESnapshot,
  start: Point,
  goals: Point[],
  blocked: Set<string>,
): PathStep[] | null {
  const goalKeys = new Set(goals.map(pointKey));
  const startKey = pointKey(start);
  if (goalKeys.has(startKey)) return [];

  const queue: Point[] = [start];
  const visited = new Set([startKey]);
  const previous = new Map<string, { from: string; key: PathStep['key']; point: Point }>();

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const { point, key } of keyedNeighbors(current)) {
      const nextKey = pointKey(point);
      if (visited.has(nextKey) || blocked.has(nextKey) || !isWalkable(snapshot, point)) continue;
      visited.add(nextKey);
      previous.set(nextKey, { from: pointKey(current), key, point });
      if (goalKeys.has(nextKey)) return rebuildPath(previous, startKey, nextKey);
      queue.push(point);
    }
  }
  return null;
}

function rebuildPath(
  previous: Map<string, { from: string; key: PathStep['key']; point: Point }>,
  startKey: string,
  goalKey: string,
): PathStep[] {
  const reversed: PathStep[] = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    const entry = previous.get(cursor);
    if (!entry) throw new Error(`Broken BFS predecessor chain at ${cursor}`);
    reversed.push({ key: entry.key, to: entry.point });
    cursor = entry.from;
  }
  return reversed.reverse();
}

function isWalkable(snapshot: E2ESnapshot, point: Point): boolean {
  return point.x >= 0
    && point.y >= 0
    && Boolean(snapshot.cells[point.y]?.[point.x]?.walkable);
}

function keyedNeighbors(point: Point): Array<{ point: Point; key: PathStep['key'] }> {
  return [
    { point: { x: point.x, y: point.y - 1 }, key: 'ArrowUp' },
    { point: { x: point.x, y: point.y + 1 }, key: 'ArrowDown' },
    { point: { x: point.x - 1, y: point.y }, key: 'ArrowLeft' },
    { point: { x: point.x + 1, y: point.y }, key: 'ArrowRight' },
  ];
}

function neighbors(point: Point): Point[] {
  return keyedNeighbors(point).map((entry) => entry.point);
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}
