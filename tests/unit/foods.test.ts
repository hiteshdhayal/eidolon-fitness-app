import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOODS } from '../../src/data/foods/index';
import { HEALTH_NOTE_RULES } from '../../src/lib/engine/healthNotes';
import { REGIONS, STATES, STATE_CODES } from '../../src/lib/engine/regions';
import { foodReviewCsv } from '../../scripts/food-review';

const root = resolve(__dirname, '../..');
const availableTo = (region: (typeof REGIONS)[number]) => {
  const states = new Set(STATES.filter((s) => s.region === region).map((s) => s.code));
  return FOODS.filter((f) => f.region === region || f.states.some((s) => states.has(s)));
};

describe('food database', () => {
  it('has at least 220 items with unique ids', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(220);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
  it.each(REGIONS)('%s meets the per-region minimums', (region) => {
    const list = availableTo(region);
    const count = (pred: (f: (typeof FOODS)[number]) => boolean) => list.filter(pred).length;
    expect(
      count((f) => f.role === 'complete' && f.slots.includes('breakfast')),
    ).toBeGreaterThanOrEqual(8);
    expect(
      count((f) => (f.role === 'curry' || f.role === 'complete') && f.slots.includes('lunch')),
    ).toBeGreaterThanOrEqual(10);
    expect(count((f) => f.role === 'side')).toBeGreaterThanOrEqual(6);
    expect(count((f) => f.slots.includes('snack') && f.role !== 'addon')).toBeGreaterThanOrEqual(5);
  });
  it('has the shared staples and protein add-ons', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const id of [
      'chapati',
      'rice',
      'bajra-roti',
      'jowar-bhakri',
      'mandua-roti',
      'paneer',
      'tofu',
      'soya-chunks',
      'moong-sprouts',
      'kala-chana-boiled',
      'curd',
      'chaas',
      'sattu-drink',
      'boiled-eggs',
      'grilled-chicken',
      'tawa-fish',
      'rajma',
      'toor-dal',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
  it('kcal are rounded to 10 and agree with the macros (±20%)', () => {
    for (const f of FOODS) {
      const p = f.perServing;
      expect(p.kcal % 10, f.id).toBe(0);
      if (p.kcal >= 50)
        expect(
          Math.abs(4 * p.protein + 4 * p.carbs + 9 * p.fat - p.kcal) / p.kcal,
          f.id,
        ).toBeLessThanOrEqual(0.2);
    }
  });
  it('no item claims to be verified against IFCT yet', () => {
    for (const f of FOODS) expect(f.verified).toBe(false);
  });
});

describe('region map', () => {
  it('covers all 28 states and 8 union territories', () => {
    expect(STATE_CODES.length).toBe(36);
    expect(STATES.filter((s) => s.kind === 'state').length).toBe(28);
    expect(STATES.filter((s) => s.kind === 'ut').length).toBe(8);
  });
});

describe('content kept in sync', () => {
  it("health-note frontmatter matches the engine's rules", () => {
    const dir = resolve(root, 'src/content/health-notes');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.map((f) => f.replace(/\.md$/, '')).sort()).toEqual(
      HEALTH_NOTE_RULES.map((r) => r.id).sort(),
    );
    for (const rule of HEALTH_NOTE_RULES) {
      const text = readFileSync(resolve(dir, `${rule.id}.md`), 'utf8');
      const appliesTo = JSON.parse(/appliesTo:\s*(\[.*\])/.exec(text)![1]!);
      const priority = Number(/priority:\s*(\d+)/.exec(text)![1]);
      expect(appliesTo, rule.id).toEqual(rule.appliesTo);
      expect(priority, rule.id).toBe(rule.priority);
      expect(text).toMatch(/reviewedBy: ""/);
    }
  });
  it('docs/food-review.csv is up to date (run `pnpm food:review`)', () => {
    expect(readFileSync(resolve(root, 'docs/food-review.csv'), 'utf8')).toBe(foodReviewCsv());
  });
});
