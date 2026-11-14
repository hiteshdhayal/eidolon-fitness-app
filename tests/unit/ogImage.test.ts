import { describe, expect, it } from 'vitest';
import { renderOgImage } from '../../src/lib/seo/ogImage';

/** PNG IHDR chunk: width/height are the first two big-endian uint32s after it. */
function pngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('renderOgImage', () => {
  it('renders a 1200x630 PNG under 150 KB for a short title', async () => {
    const png = await renderOgImage({ eyebrow: 'Home', title: 'Eidolon' });
    const { width, height } = pngSize(png);
    expect(width).toBe(1200);
    expect(height).toBe(630);
    expect(png.byteLength).toBeLessThan(150 * 1024);
  });

  it('renders a 1200x630 PNG under 150 KB for a long, wrapped title', async () => {
    const png = await renderOgImage({
      eyebrow: 'Article',
      title:
        'This is a deliberately very long article title that keeps going and going and going to force the smallest font size and the most lines',
    });
    const { width, height } = pngSize(png);
    expect(width).toBe(1200);
    expect(height).toBe(630);
    expect(png.byteLength).toBeLessThan(150 * 1024);
  });
});
