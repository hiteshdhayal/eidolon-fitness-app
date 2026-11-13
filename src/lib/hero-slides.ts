import { existsSync, readFileSync } from 'node:fs';

export interface SlideOutput {
  width: number;
  file: string;
  bytes: number;
}

interface ProcessedSlide {
  id: string;
  file: string;
  alt: string;
  variant: 'cutout' | 'background';
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  scale: number;
  outputs: { avif: SlideOutput[]; webp: SlideOutput[] };
}

export interface HeroSlide extends ProcessedSlide {
  avifSrcset: string;
  webpSrcset: string;
  fallback: string;
}

const manifestPath = 'src/assets/hero/processed/manifest.json';

const urls = import.meta.glob<string>('../assets/hero/processed/*.{avif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function urlFor(file: string): string | undefined {
  return urls[`../assets/hero/processed/${file}`];
}

function readProcessed(): ProcessedSlide[] {
  if (!existsSync(manifestPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      slides?: ProcessedSlide[];
    };
    return parsed.slides ?? [];
  } catch {
    return [];
  }
}

export const heroSizes = '(min-width: 1024px) 45vw, (min-width: 768px) 55vw, 100vw';

export function getHeroSlides(): { slides: HeroSlide[]; sizes: string } {
  const slides = readProcessed()
    .map((slide) => {
      const avifSrcset = slide.outputs.avif
        .map((output) => {
          const url = urlFor(output.file);
          return url ? `${url} ${output.width}w` : '';
        })
        .filter(Boolean)
        .join(', ');

      const webpSrcset = slide.outputs.webp
        .map((output) => {
          const url = urlFor(output.file);
          return url ? `${url} ${output.width}w` : '';
        })
        .filter(Boolean)
        .join(', ');

      const largestWebp = slide.outputs.webp[slide.outputs.webp.length - 1];
      const fallback = largestWebp ? urlFor(largestWebp.file) : undefined;

      return { ...slide, avifSrcset, webpSrcset, fallback };
    })
    .filter((slide) => slide.fallback && slide.avifSrcset && slide.webpSrcset)
    .map((slide) => ({ ...slide, fallback: slide.fallback as string }));

  return { slides, sizes: heroSizes };
}
