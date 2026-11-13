import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';

const HERO_DIR = 'src/assets/hero';
const SLIDES_DIR = join(HERO_DIR, 'slides');
const OUT_DIR = join(HERO_DIR, 'processed');
const SOURCE_MANIFEST = 'src/data/hero-slides.json';
const PROCESSED_MANIFEST = join(OUT_DIR, 'manifest.json');

const WIDTHS = [480, 768, 1080, 1440];
const MAX_SLIDES = 8;
const SUPPORTED = /\.(png|jpe?g|webp)$/i;

await mkdir(OUT_DIR, { recursive: true });

const folderFiles = existsSync(SLIDES_DIR)
  ? (await readdir(SLIDES_DIR))
      .filter((file) => SUPPORTED.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  : [];

let sources = folderFiles.map((file) => ({ file, path: join(SLIDES_DIR, file) }));
let skippedFiles = [];

if (sources.length > MAX_SLIDES) {
  skippedFiles = sources.slice(MAX_SLIDES).map((source) => source.file);
  sources = sources.slice(0, MAX_SLIDES);
}

if (sources.length === 0) {
  for (const fallback of ['hero.png', 'hero.jpg']) {
    const path = join(HERO_DIR, fallback);
    if (existsSync(path)) {
      sources = [{ file: fallback, path }];
      break;
    }
  }
}

let sourceManifest = [];
if (existsSync(SOURCE_MANIFEST)) {
  try {
    sourceManifest = JSON.parse(await readFile(SOURCE_MANIFEST, 'utf8'));
  } catch {
    console.warn(`Hero processing: ${SOURCE_MANIFEST} is not valid JSON; regenerating.`);
  }
}

const byFile = new Map(sourceManifest.map((entry) => [entry.file, entry]));
const manifest = sources.map(({ file }) => {
  const existing = byFile.get(file) ?? {};
  return {
    alt: '',
    focalX: 50,
    focalY: 50,
    scale: 1,
    skip: false,
    ...existing,
    file,
  };
});

if (folderFiles.length > 0) {
  await writeFile(SOURCE_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (sources.length === 0) {
  const stale = existsSync(OUT_DIR) ? await readdir(OUT_DIR) : [];
  await Promise.all(stale.map((file) => rm(join(OUT_DIR, file), { force: true })));
  console.log('Hero processing: no slides and no hero.png/hero.jpg found, nothing to do.');
  process.exit(0);
}

const selected = manifest
  .map((entry, index) => ({ entry, source: sources[index], index }))
  .filter(({ entry }) => !entry.skip);

const expected = new Set();
const rows = [];
const processedSlides = [];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cropBox(width, height, focalX, focalY) {
  const targetRatio = 4 / 5;
  let cropWidth = width;
  let cropHeight = height;

  if (width / height > targetRatio) {
    cropWidth = Math.round(height * targetRatio);
  } else {
    cropHeight = Math.round(width / targetRatio);
  }

  const left = clamp(Math.round((width - cropWidth) * (focalX / 100)), 0, width - cropWidth);
  const top = clamp(Math.round((height - cropHeight) * (focalY / 100)), 0, height - cropHeight);

  return { left, top, width: cropWidth, height: cropHeight };
}

function colorise(pipeline) {
  return pipeline.grayscale().linear(1.12, -12).tint({ r: 228, g: 233, b: 238 });
}

for (const { entry, source, index } of selected) {
  const id = String(index + 1).padStart(2, '0');
  const warnings = [];

  if (!entry.alt) warnings.push('no alt text in src/data/hero-slides.json');

  const metadata = await sharp(source.path).metadata();
  const stats = await sharp(source.path).stats();
  const isCutout = Boolean(metadata.hasAlpha) && stats.isOpaque === false;
  const variant = isCutout ? 'cutout' : 'background';

  if ((metadata.height ?? 0) < 1000) {
    warnings.push(`low resolution ${metadata.width}x${metadata.height} (under 1000px tall)`);
  }

  const focalX = clamp(Number(entry.focalX ?? 50), 0, 100);
  const focalY = clamp(Number(entry.focalY ?? 50), 0, 100);
  const scale = clamp(Number(entry.scale ?? 1), 0.5, 2);

  let baseBuffer;
  let baseWidth;
  let baseHeight;

  if (isCutout) {
    const trimmed = await sharp(source.path).trim({ threshold: 8 }).png().toBuffer();
    const figure = await colorise(
      sharp(trimmed).resize({
        width: Math.round(1080 * scale),
        height: Math.round(1350 * scale),
        fit: 'inside',
        withoutEnlargement: false,
      }),
    )
      .png()
      .toBuffer();
    const figureMeta = await sharp(figure).metadata();
    const left = Math.round((1080 - (figureMeta.width ?? 0)) / 2);
    const top = 1350 - (figureMeta.height ?? 0);

    baseBuffer = await sharp({
      create: {
        width: 1080,
        height: 1350,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: figure, left, top }])
      .png()
      .toBuffer();
    baseWidth = 1080;
    baseHeight = 1350;
  } else {
    const box = cropBox(metadata.width ?? 0, metadata.height ?? 0, focalX, focalY);
    baseWidth = box.width;
    baseHeight = box.height;
    baseBuffer = await sharp(source.path)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .toBuffer();

    if (WIDTHS.some((width) => width > box.width)) {
      warnings.push(`upscaled from ${box.width}px source`);
    }
    if (focalX < 12 || focalX > 88 || focalY < 12 || focalY > 88) {
      warnings.push('focal point near the crop edge');
    }
  }

  const outputs = { avif: [], webp: [] };
  let largest = 0;

  for (const width of WIDTHS) {
    const height = Math.round((width * 5) / 4);
    const avifFile = `slide-${id}-${width}.avif`;
    const webpFile = `slide-${id}-${width}.webp`;
    const avifPath = join(OUT_DIR, avifFile);
    const webpPath = join(OUT_DIR, webpFile);
    expected.add(avifFile);
    expected.add(webpFile);

    const makePipeline = () =>
      colorise(
        sharp(baseBuffer).resize({
          width,
          height,
          fit: 'cover',
          withoutEnlargement: false,
        }),
      );

    const limitKb = width === 1080 ? (index === 0 ? 180 : 150) : Infinity;
    const limitBytes = limitKb * 1024;

    for (const quality of [52, 45, 38, 32, 28]) {
      await makePipeline().avif({ quality, effort: 6 }).toFile(avifPath);
      const { size } = await stat(avifPath);
      if (size <= limitBytes) break;
    }

    const avifSize = (await stat(avifPath)).size;
    if (Number.isFinite(limitBytes) && avifSize > limitBytes) {
      warnings.push(
        `${width}w AVIF is ${Math.round(avifSize / 1024)} KB over ${limitKb} KB budget`,
      );
    }

    await makePipeline().webp({ quality: 80, effort: 4 }).toFile(webpPath);

    outputs.avif.push({ width, file: avifFile, bytes: avifSize });
    outputs.webp.push({
      width,
      file: webpFile,
      bytes: (await stat(webpPath)).size,
    });
    largest = Math.max(largest, avifSize);
  }

  processedSlides.push({
    id,
    file: entry.file,
    alt: entry.alt,
    variant,
    width: 1080,
    height: 1350,
    sourceWidth: baseWidth,
    sourceHeight: baseHeight,
    focalX,
    focalY,
    scale,
    outputs,
  });

  rows.push({
    slide: id,
    file: entry.file,
    variant,
    source: `${metadata.width}x${metadata.height}`,
    largestAvif: `${Math.round(largest / 1024)} KB`,
    warnings: warnings.length > 0 ? warnings.join('; ') : '—',
  });
}

const existing = existsSync(OUT_DIR) ? await readdir(OUT_DIR) : [];
const keep = new Set([...expected, basename(PROCESSED_MANIFEST)]);
for (const file of existing) {
  if (!keep.has(file)) await rm(join(OUT_DIR, file), { force: true });
}

await writeFile(
  PROCESSED_MANIFEST,
  `${JSON.stringify(
    { generatedAt: new Date().toISOString(), slides: processedSlides },
    null,
    2,
  )}\n`,
);

console.log('\nHero slides processed:');
console.table(rows);

if (skippedFiles.length > 0) {
  console.log(`Skipped (more than ${MAX_SLIDES} files): ${skippedFiles.join(', ')}`);
}
