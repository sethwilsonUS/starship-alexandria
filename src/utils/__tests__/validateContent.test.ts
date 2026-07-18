import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
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
    role: Archivist
    themeIds: [scriptorium]
    firstMeet:
      - text: "Hello."
    return:
      - text: "Welcome back."
    postVault:
      - text: "The safe is open."
  - id: npc-ben
    name: Ben
    role: Runner
    themeIds: [scriptorium]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The safe is open." }]
  - id: npc-cam
    name: Cam
    role: Historian
    themeIds: [cathedral]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The reliquary is open." }]
  - id: npc-dev
    name: Dev
    role: Conservator
    themeIds: [cathedral]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The reliquary is open." }]
  - id: npc-ela
    name: Ela
    role: Student
    themeIds: [university]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The lockbox is open." }]
  - id: npc-finn
    name: Finn
    role: Lecturer
    themeIds: [university]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The lockbox is open." }]
  - id: npc-gia
    name: Gia
    role: Botanist
    themeIds: [gardens]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The cache is open." }]
  - id: npc-hale
    name: Hale
    role: Groundskeeper
    themeIds: [gardens]
    firstMeet: [{ text: "Hello." }]
    return: [{ text: "Welcome back." }]
    postVault: [{ text: "The cache is open." }]
`
  );
  writeContentFile(
    root,
    'journals.yaml',
    `
journals:
  - id: journal-001
    title: First Note
    themeIds: [scriptorium]
    lines:
      - text: "Remember this."
  - id: journal-002
    title: Second Note
    themeIds: [cathedral]
    lines: [{ text: "Remember this." }]
  - id: journal-003
    title: Third Note
    themeIds: [university]
    lines: [{ text: "Remember this." }]
  - id: journal-004
    title: Fourth Note
    themeIds: [gardens]
    lines: [{ text: "Remember this." }]
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
    source:
      provider: Project Gutenberg
      ebookNumber: 1
      edition: Test edition
      url: https://www.gutenberg.org/ebooks/1
      publicDomainNote: Public domain in the USA
    fragments:
      - id: fragment-001
        label: Sample Fragment
        order: 1
        textFile: sample.txt
        sourceLocation: Chapter I
        themeAffinities: [scriptorium]
`
  );
  writeFileSync(path.join(contentRoot, 'texts', 'sample.txt'), 'sample text');
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
  writeContentFile(
    root,
    'vaults.yaml',
    `
vaults:
  - &vault
    id: vault-scriptorium
    themeId: scriptorium
    name: Archive Safe
    clue:
      id: clue-scriptorium
      title: Card
      lines: [{ text: "The figures are {code}." }]
    dialogue:
      locked: [{ text: "Locked." }]
      opening: [{ text: "You recall {code}." }]
      opened: [{ text: "Open." }]
    exhaustedReward:
      journalTitle: Note
      journalText: "Keep reading."
      batteries: 2
  - <<: *vault
    id: vault-cathedral
    themeId: cathedral
    name: Reliquary
    clue: { id: clue-cathedral, title: Hymnal, lines: [{ text: "The figures are {code}." }] }
    dialogue:
      locked: [{ text: "Locked." }]
      opening: [{ text: "You recall {code}." }]
      opened: [{ text: "Open." }]
    exhaustedReward: { journalTitle: Note, journalText: "Keep reading.", batteries: 2 }
  - <<: *vault
    id: vault-university
    themeId: university
    name: Lockbox
    clue: { id: clue-university, title: Memo, lines: [{ text: "The figures are {code}." }] }
    dialogue:
      locked: [{ text: "Locked." }]
      opening: [{ text: "You recall {code}." }]
      opened: [{ text: "Open." }]
    exhaustedReward: { journalTitle: Note, journalText: "Keep reading.", batteries: 2 }
  - <<: *vault
    id: vault-gardens
    themeId: gardens
    name: Cache
    clue: { id: clue-gardens, title: Log, lines: [{ text: "The figures are {code}." }] }
    dialogue:
      locked: [{ text: "Locked." }]
      opening: [{ text: "You recall {code}." }]
      opened: [{ text: "Open." }]
    exhaustedReward: { journalTitle: Note, journalText: "Keep reading.", batteries: 2 }
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
  it('rejects duplicate gameloop voiceLineId values across welcome and victory lines', () => {
    const root = createValidContentTree(`
welcome:
  lines:
    - text: "Welcome aboard."
      voiceLineId: opening.welcome.01
victory:
  lines:
    - text: "You made it."
      voiceLineId: opening.welcome.01
`);

    const result = runValidator(root);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('Duplicate voiceLineId "opening.welcome.01"');
  });
});

describe('validate-content literary and destination schema validation', () => {
  const validGameloop = `
welcome:
  lines: [{ text: "Welcome aboard." }]
victory:
  lines: [{ text: "You made it." }]
`;

  it('accepts a fully sourced catalog with two NPCs and one vault per theme', () => {
    const root = createValidContentTree(validGameloop);
    const result = runValidator(root);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('All content files valid');
  });

  it('rejects deprecated totalFragments and unknown theme affinities', () => {
    const root = createValidContentTree(validGameloop);
    writeContentFile(
      root,
      'books.yaml',
      `
books:
  - id: book-001
    title: Sample
    author: Anonymous
    totalFragments: 99
    source:
      provider: Project Gutenberg
      ebookNumber: 1
      edition: Test edition
      url: https://www.gutenberg.org/ebooks/1
      publicDomainNote: Public domain in the USA
    fragments:
      - id: fragment-001
        label: Sample Fragment
        order: 1
        textFile: sample.txt
        sourceLocation: Chapter I
        themeAffinities: [moon-base]
`
    );

    const result = runValidator(root);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('Deprecated field "totalFragments"');
    expect(output).toContain('Unknown theme affinity "moon-base"');
  });

  it('rejects Project Gutenberg boilerplate inside an excerpt', () => {
    const root = createValidContentTree(validGameloop);
    writeFileSync(
      path.join(root, 'public', 'content', 'texts', 'sample.txt'),
      '*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***'
    );

    const result = runValidator(root);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('contains Project Gutenberg boilerplate');
  });

  it('rejects destination pools that do not contain exactly two NPCs', () => {
    const root = createValidContentTree(validGameloop);
    const npcPath = path.join(root, 'public', 'content', 'npcs.yaml');
    const yaml = readFileSync(npcPath, 'utf8').replace(
      'themeIds: [gardens]',
      'themeIds: [scriptorium]'
    );
    writeFileSync(npcPath, yaml);

    const result = runValidator(root);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Theme "scriptorium" must have exactly 2 NPCs');
    expect(result.stdout).toContain('Theme "gardens" must have exactly 2 NPCs');
  });

  it('rejects journals without a valid destination affinity', () => {
    const root = createValidContentTree(validGameloop);
    const journalPath = path.join(root, 'public', 'content', 'journals.yaml');
    const yaml = readFileSync(journalPath, 'utf8').replace(
      'themeIds: [gardens]',
      'themeIds: [deep-space]'
    );
    writeFileSync(journalPath, yaml);

    const result = runValidator(root);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Unknown theme "deep-space"');
    expect(result.stdout).toContain('Theme "gardens" must have at least 1 journal');
  });
});
