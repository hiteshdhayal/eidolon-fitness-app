/**
 * Versioned localStorage for the questionnaire and the saved plan (Part B).
 * Every read/write is wrapped: private mode, a full disk or corrupt JSON must
 * never crash the page. Invalid data reads as `null`.
 */
import { z } from 'zod';
import { AnswersSchema, GroceryListSchema, PlanSchema } from './engine/schema';
import type { AnswersInput, GroceryList, Plan } from './engine/types';
import { ProgressSchema, type Entry, type Progress } from './progress/schema';

export const DRAFT_KEY = 'eidolon:draft:v1';
export const PLAN_KEY = 'eidolon:plan:v1';
export const GROCERIES_KEY = 'eidolon:groceries:v1';
export const PROGRESS_KEY = 'eidolon:progress:v1';
export const KEY_PREFIX = 'eidolon:';

/** The draft answers: a partial AnswersInput, validated loosely. */
const DraftAnswersSchema = z.object(AnswersSchema.shape).partial();

export const DraftSchema = z.object({
  v: z.literal(1),
  answers: DraftAnswersSchema,
  stepId: z.string(),
  updatedAt: z.string(),
});

export const SavedPlanSchema = z.object({
  v: z.literal(1),
  answers: AnswersSchema,
  plan: PlanSchema,
  groceries: GroceryListSchema,
  savedAt: z.string(),
});

export const GroceriesSchema = z.object({
  v: z.literal(1),
  seed: z.number().int(),
  checked: z.array(z.string()),
});

export type DraftAnswers = Partial<AnswersInput>;
export type Draft = z.infer<typeof DraftSchema>;
export type SavedPlan = z.infer<typeof SavedPlanSchema>;
export type Groceries = z.infer<typeof GroceriesSchema>;
export type { GroceryList, Plan };

function store(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Only `v: 1` exists today; the switch is where future versions plug in. */
export function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const version = (raw as { v?: unknown }).v;
  switch (version) {
    case 1:
      return raw;
    default:
      return null;
  }
}

function load<T>(key: string, schema: z.ZodType<T>): T | null {
  const storage = store();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = schema.safeParse(migrate(JSON.parse(raw)));
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn(`[storage] ignoring invalid ${key}`);
      return null;
    }
    return parsed.data;
  } catch {
    if (import.meta.env.DEV) console.warn(`[storage] could not read ${key}`);
    return null;
  }
}

function save<T>(key: string, value: T): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private mode — ignore
  }
}

function remove(key: string): void {
  const storage = store();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function readDraft(): Draft | null {
  return load(DRAFT_KEY, DraftSchema);
}

export function writeDraft(draft: Draft): void {
  save(DRAFT_KEY, draft);
}

export function clearDraft(): void {
  remove(DRAFT_KEY);
}

export function readPlan(): SavedPlan | null {
  return load(PLAN_KEY, SavedPlanSchema);
}

export function writePlan(saved: SavedPlan): void {
  save(PLAN_KEY, saved);
}

export function clearPlan(): void {
  remove(PLAN_KEY);
}

/** Grocery ticks are tied to the plan seed; a new plan starts with no ticks. */
export function readGroceries(seed: number): Groceries {
  const stored = load(GROCERIES_KEY, GroceriesSchema);
  if (stored && stored.seed === seed) return stored;
  return { v: 1, seed, checked: [] };
}

export function writeGroceries(seed: number, checked: string[]): void {
  save(GROCERIES_KEY, { v: 1, seed, checked } satisfies Groceries);
}

// ---------------------------------------------------------------------------
// Progress log (spec §10)
// ---------------------------------------------------------------------------

const round1 = (value: number) => Math.round(value * 10) / 10;

/** crypto.randomUUID() where available; the only allowed Math.random fallback. */
function newId(): string {
  const scope = globalThis as { crypto?: { randomUUID?: () => string } };
  if (scope.crypto && typeof scope.crypto.randomUUID === 'function') {
    return scope.crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const EMPTY_PROGRESS: Progress = { v: 1, entries: [], dismissedRules: {} };

export function readProgress(): Progress {
  return load(PROGRESS_KEY, ProgressSchema) ?? { ...EMPTY_PROGRESS, entries: [] };
}

export function writeProgress(progress: Progress): boolean {
  const storage = store();
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** One entry per date: saving on an existing date replaces it and keeps its id. */
export function upsertEntry(input: {
  date: string;
  weightKg: number;
  waistCm?: number;
}): Progress {
  const current = readProgress();
  const existing = current.entries.find((entry) => entry.date === input.date);
  const entry: Entry = {
    id: existing?.id ?? newId(),
    date: input.date,
    weightKg: round1(input.weightKg),
    createdAt: new Date().toISOString(),
  };
  if (input.waistCm !== undefined) entry.waistCm = round1(input.waistCm);

  const entries = current.entries
    .filter((item) => item.date !== input.date)
    .concat(entry)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const next: Progress = { ...current, entries };
  writeProgress(next);
  return next;
}

export function deleteEntry(id: string): Progress {
  const current = readProgress();
  const next: Progress = {
    ...current,
    entries: current.entries.filter((entry) => entry.id !== id),
  };
  writeProgress(next);
  return next;
}

export function setProgressFields(fields: Partial<Pick<Progress, 'nudgeDismissedOn' | 'dismissedRules'>>): Progress {
  const current = readProgress();
  const next: Progress = { ...current, ...fields };
  writeProgress(next);
  return next;
}

/** Remove every `eidolon:*` key, by iterating the keys rather than a fixed list. */
export function clearAll(): void {
  const storage = store();
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // ignore
  }
}

