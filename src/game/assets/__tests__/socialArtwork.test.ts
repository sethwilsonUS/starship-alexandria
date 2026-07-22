import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';

type ConceptOutput = {
  path: string;
  role: string;
  width: number;
  height: number;
  derivedFrom?: string;
};

type ConceptGeneration = {
  id: string;
  prompt: string;
  outputs: ConceptOutput[];
};

type ConceptManifest = {
  version: number;
  generations: ConceptGeneration[];
};

const PUBLIC_ROOT = path.join(process.cwd(), 'public');

describe('social artwork', () => {
  test('uses the selected Celestial Acropolis artwork for the README and social card', async () => {
    const manifest = JSON.parse(
      await fs.readFile(path.join(PUBLIC_ROOT, 'images', 'manifest.json'), 'utf8'),
    ) as ConceptManifest;

    expect(manifest.version).toBe(2);
    expect(manifest.generations.map((generation) => generation.id)).toEqual([
      'celestial-acropolis-key-art',
    ]);

    const keyArtGeneration = manifest.generations[0];
    expect(keyArtGeneration.prompt).toContain('Direction 1 — "The Celestial Acropolis."');
    expect(keyArtGeneration.outputs).toMatchObject([
      {
        path: '/images/starship-alexandria-key-art.png',
        role: 'readme-key-art',
        width: 1734,
        height: 907,
      },
      {
        path: '/images/og.png',
        role: 'social-card',
        width: 1200,
        height: 630,
        derivedFrom: '/images/starship-alexandria-key-art.png',
      },
    ]);

    const socialCard = await sharp(path.join(PUBLIC_ROOT, 'images', 'og.png')).metadata();
    expect({
      format: socialCard.format,
      width: socialCard.width,
      height: socialCard.height,
    }).toEqual({ format: 'png', width: 1200, height: 630 });

    const readme = await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf8');
    expect(readme).toContain(
      '![Starship Alexandria hovers above a moonlit Arcadian city of temples and a ruined cathedral while a lone archivist stands in a blue transporter beam.](public/images/starship-alexandria-key-art.png)',
    );
  });
});
