#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(
  projectRoot,
  'public',
  'images',
  'starship-alexandria-key-art.png',
);
const outputPath = path.join(projectRoot, 'public', 'images', 'og.png');
const temporaryOutputPath = `${outputPath}.next`;

const sourceMetadata = await sharp(sourcePath).metadata();
if (sourceMetadata.format !== 'png' || sourceMetadata.width !== 1734 || sourceMetadata.height !== 907) {
  throw new Error(
    `Expected the selected 1734x907 PNG source; received ${sourceMetadata.width}x${sourceMetadata.height} ${sourceMetadata.format}`,
  );
}

try {
  await sharp(sourcePath)
    .resize(1200, 630, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(temporaryOutputPath);
  await fs.rename(temporaryOutputPath, outputPath);
} finally {
  await fs.rm(temporaryOutputPath, { force: true });
}

console.log('Generated public/images/og.png at 1200x630.');
