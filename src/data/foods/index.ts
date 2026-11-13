/**
 * The food database. Import this module lazily from the plan island
 * (`await import("~/data/foods")`) so the questionnaire's first screen
 * doesn't wait for it (spec §17).
 *
 * Every entry is parsed with FoodSchema at import time, so `astro build`
 * and `pnpm test` both fail on a bad entry.
 */
import { FoodSchema, type Food } from './schema';
import { pan } from './pan';
import { north } from './north';
import { west } from './west';
import { south } from './south';
import { east } from './east';
import { northeast } from './northeast';
import { central } from './central';

export const FOOD_FILES = { pan, north, west, south, east, northeast, central } as const;

function load(): Food[] {
  const all = Object.values(FOOD_FILES).flat();
  const parsed = FoodSchema.array().parse(all);
  const seen = new Set<string>();
  for (const f of parsed) {
    if (seen.has(f.id)) throw new Error(`Duplicate food id: ${f.id}`);
    seen.add(f.id);
  }
  for (const f of parsed) {
    for (const p of f.pairsWith) {
      const target = parsed.find((x) => x.id === p);
      if (!target || target.role !== 'staple')
        throw new Error(`${f.id}: pairsWith "${p}" is not a staple`);
    }
  }
  return parsed;
}

export const FOODS: readonly Food[] = load();
export const FOODS_BY_ID: ReadonlyMap<string, Food> = new Map(FOODS.map((f) => [f.id, f]));

export function food(id: string): Food {
  const f = FOODS_BY_ID.get(id);
  if (!f) throw new Error(`Unknown food id: ${id}`);
  return f;
}

export type { Food } from './schema';
