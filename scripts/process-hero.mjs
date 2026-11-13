import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const HERO_DIR = 'src/assets/hero';
const OUT_DIR = join(HERO_DIR, 'processed');

const sources = {
  cutout: join(HERO_DIR, 'hero.png'),
  scene: join(HERO_DIR, 'hero.jpg'),
};

await mkdir(OUT_DIR, { recursive: true });

const present = Object.entries(sources).filter(([, file]) => existsSync(file));

// Remove stale outputs first, so deleting a source also removes its processed file.
const existing = existsSync(OUT_DIR) ? await readdir(OUT_DIR) : [];
const expected = new Set();
if (existsSync(sources.cutout)) expected.add('hero-cutout.png');
if (existsSync(sources.scene)) expected.add('hero-scene.jpg');
for (const file of existing) {
  if (!expected.has(file)) await rm(join(OUT_DIR, file), { force: true });
}

if (present.length === 0) {
  console.log('Hero processing: no hero.png or hero.jpg found, nothing to do.');
  process.exit(0);
}

for (const [variant, file] of present) {
  const image = sharp(file);
  const metadata = await image.metadata();
  const width = Math.min(metadata.width ?? 1920, 1920);

  // sharp keeps only the last linear() call, so use one combined adjustment.
  // Scene: map a near-black background (~45) to obsidian (~11) and lift the subject.
  const [gain, offset] = variant === 'scene' ? [1.3, -47] : [1.12, -12];

  const pipeline = image
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .grayscale()
    .linear(gain, offset)
    .tint({ r: 228, g: 233, b: 238 });

  const output =
    variant === 'cutout' ? join(OUT_DIR, 'hero-cutout.png') : join(OUT_DIR, 'hero-scene.jpg');

  if (variant === 'cutout') {
    await pipeline.png({ compressionLevel: 9 }).toFile(output);
  } else {
    await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(output);
  }

  const info = await stat(output);
  console.log(`Hero processing: wrote ${output} (${Math.round(info.size / 1024)} KB)`);
}
