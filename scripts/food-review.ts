/**
 * Writes docs/food-review.csv: every food item, one row each, for a
 * dietitian and me to review (spec §8). Run with `pnpm food:review`.
 * Opens cleanly in Excel or Google Sheets (UTF-8 with BOM).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOODS } from '../src/data/foods/index';

const HEADER = [
  'id',
  'name',
  'english_gloss',
  'local_names',
  'region',
  'states',
  'role',
  'slots',
  'serving',
  'serving_grams',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'gi',
  'budget_1to3',
  'occasional',
  'veg',
  'eggetarian',
  'vegan',
  'jain_safe',
  'contains',
  'can_skip',
  'source',
  'verified',
  'reviewer_notes',
];

const cell = (v: unknown): string => {
  const s = Array.isArray(v)
    ? v.join('; ')
    : typeof v === 'boolean'
      ? v
        ? 'yes'
        : 'no'
      : String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function foodReviewCsv(): string {
  const rows = FOODS.map((f) => [
    f.id,
    f.name,
    f.gloss,
    f.localNames,
    f.region,
    f.states,
    f.role,
    f.slots,
    f.serving.measure,
    f.serving.grams,
    f.perServing.kcal,
    f.perServing.protein,
    f.perServing.carbs,
    f.perServing.fat,
    f.perServing.fiber,
    f.gi,
    f.budget,
    f.occasional,
    f.diet.veg,
    f.diet.egg,
    f.diet.vegan,
    f.diet.jainSafe,
    Object.entries(f.contains)
      .filter(([, v]) => v)
      .map(([k]) => k),
    f.canSkip,
    f.source,
    f.verified,
    '',
  ]);
  return '﻿' + [HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../docs/food-review.csv');
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, foodReviewCsv());
  console.log(`Wrote ${FOODS.length} foods to ${out}`);
}
