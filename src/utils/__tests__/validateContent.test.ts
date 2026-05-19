import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';

const validatorPath = path.resolve(process.cwd(), 'scripts/validate-content.js');
let tempDirs: string[] = [];

function writeContentFile(root: string, filename: string, content: string): void {
  writeFileSync(path.join(root, 'public', 'content', filename), content);
}

function createValidContentTree(gameloopYaml: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'starship-content-'));
  tempDirs.push(root);

  const contentRoot = path.join(root, 'public', 'content');
  mkdirSync(path.join(contentRoot, 'texts'), { recursive: true });

  writeContentFile(
    root,
    'npcs.yaml',
    `
npcs:
  - id: npc-ada
    name: Ada
    firstMeet:
      - text: "Hello."
    return:
      - text: "Welcome back."
`
  );
  writeContentFile(
    root,
    'journals.yaml',
    `
journals:
  - id: journal-001
    title: First Note
    lines:
      - text: "Remember this."
`
  );
  writeContentFile(
    root,
    'books.yaml',
    `
books:
  - id: book-001
    title: Sample
    author: Anonymous
    totalFragments: 1
    fragments:
      - id: fragment-001
        label: Sample Fragment
        order: 1
        textFile: sample.txt
`
  );
  writeFileSync(path.join(contentRoot, 'texts', 'sample.txt'), 'sample text');
  writeContentFile(
    root,
    'rooms.yaml',
    `
roomNames:
  - Reading Room
`
  );
  writeContentFile(
    root,
    'dialogue.yaml',
    `
transporter:
  noFragments:
    text: "Return?"
    choices:
      - label: "Yes"
        key: "y"
        action: "beam-up"
  fragmentsRemaining:
    text: "{count} left."
    choices:
      - label: "Stay"
        key: "s"
        action: "stay"
  allCollected:
    text: "All done."
    choices:
      - label: "Leave"
        key: "l"
        action: "beam-up"
marthaHint:
  template: "Try {rooms}."
  fallback: "Keep looking."
`
  );
  writeContentFile(
    root,
    'artifacts.yaml',
    `
artifacts:
  - id: artifact-001
    name: Compass
    description: Points toward home.
`
  );
  writeContentFile(root, 'gameloop.yaml', gameloopYaml);

  return root;
}

function runValidator(cwd: string) {
  return spawnSync(process.execPath, [validatorPath], {
    cwd,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('validate-content gameloop voiceLineId validation', () => {
  it('rejects duplicate gameloop voiceLineId values across welcome, victory, and vault lines', () => {
    const root = createValidContentTree(`
welcome:
  lines:
    - text: "Welcome aboard."
      voiceLineId: opening.welcome.01
victory:
  lines:
    - text: "You made it."
vault:
  alreadyOpened:
    - text: "Already open."
  openWithArtifact:
    - text: "The code is {code}."
  openEmpty:
    - text: "Nothing here."
  locked:
    - text: "Locked."
      voiceLineId: opening.welcome.01
`);

    const result = runValidator(root);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('Duplicate voiceLineId "opening.welcome.01"');
  });
});
