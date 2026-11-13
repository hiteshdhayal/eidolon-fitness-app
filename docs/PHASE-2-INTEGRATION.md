# Phase 2 — dropping the engine into the Eidolon repo

Phase 2 is pure TypeScript with no UI, so it was built and tested outside your
repo. Everything uses relative imports, so it works whatever your path
aliases are.

## 1. Copy the files

Copy these folders into your repo root, keeping the same paths:

```
src/lib/engine/          ← plan engine (11 files)
src/data/foods/          ← food database (7 region files + schema)
src/content/health-notes/← 12 health-note drafts (reviewedBy left empty)
scripts/food-review.ts   ← writes docs/food-review.csv
tests/unit/              ← 192 Vitest cases
docs/food-review.csv     ← 251 foods, ready for the dietitian
```

Then append `docs/DECISIONS-phase-2.md` to your `docs/DECISIONS.md` and
delete the separate file.

## 2. Dependencies and scripts

```bash
pnpm add zod
pnpm add -D tsx
```

Add to `package.json` → `scripts`:

```json
"food:review": "tsx scripts/food-review.ts"
```

If your `vitest.config.ts` has an `include`, make sure it covers
`tests/unit/**/*.test.ts`.

## 3. Register the health-notes collection

In `src/content.config.ts` (Astro 5):

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const healthNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/health-notes' }),
  schema: z.object({
    title: z.string(),
    appliesTo: z.array(z.string()),
    priority: z.number(),
    reviewedBy: z.string().default(''),
  }),
});

export const collections = { /* …existing… */ healthNotes };
```

Show "Reviewed by …" only when `reviewedBy` is not empty (§7.4).

## 4. Run the checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Your ESLint config hasn't run on these files yet. They pass `tsc` strict with
`noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`, so
expect, at most, style-level fixes.

## 5. How Phase 3 uses it

```ts
import {
  buildPlan,
  getSwaps,
  applySwap,
  shuffleDay,
  groceryListFor,
  PlanSchema,
} from '../lib/engine';

// Load the food DB lazily, after the questionnaire starts (spec §17)
const { FOODS } = await import('../data/foods');

const plan = buildPlan(answers, FOODS); // validates answers with zod first
localStorage.setItem('eidolon:plan:v1', JSON.stringify(plan));

// Reading it back
const saved = PlanSchema.parse(JSON.parse(localStorage.getItem('eidolon:plan:v1')!));

switch (saved.kind) {
  case 'recipes':
    /* 7 days → day tabs, Swap, Shuffle day, Groceries */ break;
  case 'plateRules':
    /* hostel / eat-out → saved.plateGuide */ break;
  case 'guidance':
    /* teen / pregnant / kidney → saved.guidance, NO numbers */ break;
}

const options = getSwaps(saved, answers, FOODS, dayIndex, mealIndex); // 3 options
const next = applySwap(saved, answers, FOODS, dayIndex, mealIndex, itemIndex, options[0]);
const fresh = shuffleDay(saved, answers, FOODS, dayIndex);
const groceries = groceryListFor(saved, answers, FOODS); // stable item ids for checkboxes
```

What the plan page reads from the plan:

| UI piece                    | Field                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Key numbers (black section) | `targets.kcal`, `protein`, `carbs`, `fat`, `fiber`, `waterMl`, `stepsTarget`                                          |
| "How I worked this out"     | `targets.explain[]` (title + plain-language text)                                                                     |
| Banner (gentle / guidance)  | `safety.mode`, `safety.reasons[].message`                                                                             |
| Health callouts             | `healthNoteIds[]` → health-notes collection entries                                                                   |
| Plain-language notes        | `notes[]` (e.g. protein lowered for feasibility)                                                                      |
| Each meal                   | `days[d].meals[m]`: `time`, `label`, `items[]` with `name`, `gloss`, `measure`, `grams`, `kcal`, `protein`, `notes[]` |
| Disclaimer                  | `disclaimer`                                                                                                          |

`STATES` (all 36 states and UTs, with region) is exported for the state picker.

## 6. Before launch

- **Dietitian review:** open `docs/food-review.csv`. Every row has
  `verified = no`. When a value is checked against IFCT 2017, set `source` and
  `verified: true` in the region file and run `pnpm food:review` (a test fails
  if the CSV is stale).
- **Health notes:** have a doctor or dietitian read the 12 drafts and fill in
  `reviewedBy`.
- **Tuning:** every number lives in `src/lib/engine/constants.ts` with a
  comment saying where it comes from.
