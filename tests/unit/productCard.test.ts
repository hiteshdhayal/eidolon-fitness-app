import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * affiliate_click can't be exercised end-to-end yet: every seed product in
 * src/data/products.ts has affiliateUrl: '' (no real links chosen), so the
 * "Check price" button that carries the tracking attributes never renders
 * in a real build — there's nothing to click. This checks the component's
 * source directly for the attributes spec §18 requires (product + article,
 * no personal data), so the wiring is still covered until a real affiliate
 * link exists and the Playwright flow can click it for real.
 */
describe('ProductCard affiliate_click wiring (source check)', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/components/mdx/ProductCard.astro'),
    'utf8',
  );

  it('fires affiliate_click with product and article only, inside the affiliateUrl branch', () => {
    const buttonBlock = source.slice(source.indexOf('product.affiliateUrl ? ('));
    expect(buttonBlock).toContain("'data-umami-event': 'affiliate_click'");
    expect(buttonBlock).toContain("'data-umami-event-product': product.id");
    expect(buttonBlock).toContain("'data-umami-event-article': articleSlug");
  });

  it('marks the link sponsored, nofollow and opening in a new tab', () => {
    expect(source).toContain('rel="sponsored nofollow noopener"');
    expect(source).toContain('target="_blank"');
  });

  it('derives articleSlug from the URL, not from any personal data', () => {
    expect(source).toMatch(/const articleSlug = segments\[segments\.length - 1\] \?\? '';/);
  });
});
