import { beforeEach, describe, expect, it } from 'vitest';
import { buildPlan, groceryListFor } from '../../src/lib/engine/index';
import { FOODS } from '../../src/data/foods/index';
import { AnswersSchema } from '../../src/lib/engine/schema';
import {
  clearAll,
  GROCERIES_KEY,
  PLAN_KEY,
  PROGRESS_KEY,
  readPlan,
  readProgress,
  readStoredGroceries,
  writePlan,
  writeProgress,
  writeStoredGroceries,
} from '../../src/lib/storage';
import { applyImport, buildExport, isTooBig, parseExport } from '../../src/lib/progress/transfer';
import { BASE, NOW } from './personas';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

function savedFixture() {
  const answers = AnswersSchema.parse(BASE);
  const plan = buildPlan(answers, FOODS, { now: NOW });
  const groceries = groceryListFor(plan, answers, FOODS);
  return { v: 1 as const, answers, plan, groceries, savedAt: '2026-11-13T10:00:00Z' };
}

function seedEverything() {
  const saved = savedFixture();
  writePlan(saved);
  writeProgress({
    v: 1,
    entries: [
      {
        id: 'a',
        date: '2026-11-01',
        weightKg: 82,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
    dismissedRules: {},
  });
  // eidolon:groceries:v1 is the ticked set, not the plan's grocery list.
  writeStoredGroceries({ v: 1, seed: saved.plan.seed, checked: ['rice'] });
  return saved;
}

describe('export / import', () => {
  it('round-trips to identical storage', () => {
    seedEverything();
    const before = {
      plan: readPlan(),
      progress: readProgress(),
      groceries: readStoredGroceries(),
    };
    const bundle = buildExport(new Date('2026-11-14T00:00:00Z'));
    expect(bundle.app).toBe('eidolon');
    expect(bundle.exportVersion).toBe(1);

    clearAll();
    expect(readPlan()).toBeNull();

    const parsed = parseExport(JSON.stringify(bundle));
    expect(parsed).not.toBeNull();
    applyImport(parsed!);

    expect(readPlan()).toEqual(before.plan);
    expect(readProgress()).toEqual(before.progress);
    expect(readStoredGroceries()).toEqual(before.groceries);
  });

  it('rejects a wrong app name', () => {
    seedEverything();
    const bundle = { ...buildExport(), app: 'other' };
    expect(parseExport(JSON.stringify(bundle))).toBeNull();
  });

  it('rejects a wrong exportVersion', () => {
    seedEverything();
    const bundle = { ...buildExport(), exportVersion: 2 };
    expect(parseExport(JSON.stringify(bundle))).toBeNull();
  });

  it('rejects a broken plan', () => {
    seedEverything();
    const bundle = buildExport();
    const broken = { ...bundle, plan: { ...bundle.plan, plan: { kind: 'nonsense' } } };
    expect(parseExport(JSON.stringify(broken))).toBeNull();
  });

  it('rejects bad entries', () => {
    seedEverything();
    const bundle = buildExport();
    const broken = {
      ...bundle,
      progress: { v: 1, entries: [{ id: 'x', date: 'yesterday', weightKg: 5 }], dismissedRules: {} },
    };
    expect(parseExport(JSON.stringify(broken))).toBeNull();
  });

  it('rejects a file over 1 MB', () => {
    expect(isTooBig(1_000_000)).toBe(false);
    expect(isTooBig(1_000_001)).toBe(true);
  });

  it('accepts a progress-only file and removes the plan key', () => {
    seedEverything();
    const bundle = { ...buildExport(), plan: null, groceries: null };
    const parsed = parseExport(JSON.stringify(bundle));
    expect(parsed).not.toBeNull();
    applyImport(parsed!);
    expect(readPlan()).toBeNull();
    expect(readStoredGroceries()).toBeNull();
    expect(readProgress().entries).toHaveLength(1);
  });

  it('clearAll removes eidolon keys and keeps unrelated ones after an import', () => {
    seedEverything();
    localStorage.setItem('unrelated', 'keep');
    clearAll();
    expect(localStorage.getItem(PLAN_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem(GROCERIES_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
