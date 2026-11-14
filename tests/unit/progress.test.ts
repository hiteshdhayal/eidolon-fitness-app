import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatLong,
  formatShort,
  todayLocal,
} from '../../src/lib/progress/dates';
import {
  formatSigned,
  smoothed,
  smoothedSeries,
  summary,
  valueNear,
} from '../../src/lib/progress/stats';
import { evaluateRules, isNudgeDue, type RuleInput } from '../../src/lib/progress/rules';
import type { Entry } from '../../src/lib/progress/schema';
import {
  clearAll,
  deleteEntry,
  PROGRESS_KEY,
  readProgress,
  upsertEntry,
  writeProgress,
} from '../../src/lib/storage';
import { applyWeightParam } from '../../src/lib/questionnaire/flow';

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

let idCounter = 0;
function entry(date: string, weightKg: number, waistCm?: number): Entry {
  idCounter += 1;
  return {
    id: `id-${idCounter}`,
    date,
    weightKg,
    ...(waistCm !== undefined ? { waistCm } : {}),
    createdAt: '2026-11-14T00:00:00.000Z',
  };
}

describe('dates', () => {
  it('todayLocal uses the device local date, not UTC', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Asia/Kolkata';
    try {
      const earlyMorning = new Date('2026-11-14T01:00:00+05:30');
      expect(earlyMorning.getDate()).toBe(14);
      expect(todayLocal(earlyMorning)).toBe('2026-11-14');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('daysBetween counts whole days, b minus a', () => {
    expect(daysBetween('2026-11-01', '2026-11-14')).toBe(13);
    expect(daysBetween('2026-11-14', '2026-11-01')).toBe(-13);
    expect(daysBetween('2026-11-14', '2026-11-14')).toBe(0);
  });

  it('addDays crosses months', () => {
    expect(addDays('2026-11-28', 5)).toBe('2026-12-03');
    expect(addDays('2026-11-14', -14)).toBe('2026-10-31');
  });

  it('formats short and long dates', () => {
    expect(formatShort('2026-11-13')).toBe('13 Nov');
    expect(formatLong('2026-11-13')).toBe('13 Nov 2026');
  });
});

describe('stats', () => {
  const edges = [
    entry('2026-11-08', 100), // day −6 from the 14th -> included
    entry('2026-11-07', 200), // day −7 -> excluded
    entry('2026-11-14', 80),
  ];

  it('smoothed includes day −6 and excludes day −7', () => {
    // mean of 100 and 80 only
    expect(smoothed(edges, '2026-11-14')).toBeCloseTo(90, 6);
  });

  it('smoothed returns undefined for an empty window', () => {
    expect(smoothed([entry('2026-01-01', 80)], '2026-11-14')).toBeUndefined();
  });

  it('smoothedSeries gives one point per entry date', () => {
    const series = smoothedSeries([entry('2026-11-01', 80), entry('2026-11-02', 82)]);
    expect(series.map((point) => point.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(series[1]?.value).toBeCloseTo(81, 6);
  });

  it('valueNear finds the smoothed value at the latest entry within the tolerance', () => {
    const entries = [entry('2026-11-01', 80), entry('2026-11-03', 82)];
    // latest entry in [11-01, 11-04] is 11-03; smoothed at 11-03 = mean(80, 82).
    expect(valueNear(entries, '2026-11-04', 3)).toBeCloseTo(81, 6);
    expect(valueNear(entries, '2026-11-10', 3)).toBeUndefined();
  });

  it('summary with no entries', () => {
    expect(summary([])).toEqual({ count: 0 });
  });

  it('summary with one entry', () => {
    const result = summary([entry('2026-11-01', 80)]);
    expect(result.count).toBe(1);
    expect(result.latestWeight).toBe(80);
    expect(result.changeKg).toBeUndefined();
    expect(result.weeklyKg).toBeUndefined();
  });

  it('summary with two entries over a short span has no weekly rate', () => {
    const result = summary([entry('2026-11-01', 84), entry('2026-11-04', 83)]);
    expect(result.changeKg).toBe(-1);
    expect(result.weeklyKg).toBeUndefined();
  });

  it('summary with a span over 7 days computes the weekly rate', () => {
    const result = summary([entry('2026-10-17', 84), entry('2026-11-14', 81.6)]);
    expect(result.changeKg).toBe(-2.4);
    expect(result.weeklyKg).toBe(-0.6);
  });

  it('summary reads waist only when two entries have it', () => {
    const partial = summary([
      entry('2026-11-01', 84, 90),
      entry('2026-11-08', 83),
      entry('2026-11-14', 82),
    ]);
    expect(partial.waistChangeCm).toBeUndefined();

    const full = summary([
      entry('2026-11-01', 84, 90),
      entry('2026-11-08', 83, 88),
      entry('2026-11-14', 82, 86),
    ]);
    expect(full.waistChangeCm).toBe(-4);
    expect(full.firstWaistDate).toBe('2026-11-01');
  });

  it('formatSigned uses the true minus sign', () => {
    expect(formatSigned(-2.4, 'kg')).toBe('\u22122.4 kg');
    expect(formatSigned(0.6, 'kg')).toBe('+0.6 kg');
    expect(formatSigned(0, 'kg')).toBe('0.0 kg');
    expect(formatSigned(-0.04, 'kg')).toBe('0.0 kg');
  });
});

describe('rules', () => {
  const d = '2026-11-25';
  const base: Omit<RuleInput, 'entries' | 'today'> = {
    planWeightKg: 88,
    effectiveGoal: 'lose',
    mode: 'full',
    dismissedRules: {},
  };

  // a = day −14, b = day −7, c = today; 1% faster for two weeks.
  const fastLossEntries = [entry('2026-11-11', 90), entry('2026-11-18', 89), entry(d, 88)];

  it('fastLoss fires at 1.1% a week for two weeks', () => {
    const result = evaluateRules({ ...base, entries: fastLossEntries, today: d });
    expect(result?.id).toBe('fastLoss');
    expect(result?.suggestions).toHaveLength(4);
    expect(result?.action).toBe('updatePlan');
  });

  it('fastLoss does not fire at 0.9% a week', () => {
    const entries = [entry('2026-11-11', 90), entry('2026-11-18', 89.19), entry(d, 88.4)];
    expect(evaluateRules({ ...base, entries, today: d })).toBeNull();
  });

  it('fastLoss does not fire with only one fast week', () => {
    const entries = [entry('2026-11-11', 90), entry('2026-11-18', 88.9), entry(d, 88.8)];
    expect(evaluateRules({ ...base, entries, today: d })).toBeNull();
  });

  it('fastLoss does not fire when a point is beyond the 3-day tolerance', () => {
    // b sits at day −11, outside [d−10, d−7], so valueNear(d−7) is undefined.
    const entries = [entry('2026-11-11', 90), entry('2026-11-14', 89), entry(d, 88)];
    expect(evaluateRules({ ...base, entries, today: d })).toBeNull();
  });

  it('bigChange fires at exactly 3.0 kg', () => {
    const result = evaluateRules({
      ...base,
      planWeightKg: 82,
      entries: [entry(d, 79)],
      today: d,
    });
    expect(result?.id).toBe('bigChange');
    expect(result?.body).toContain('lost 3.0 kg');
  });

  it('bigChange does not fire at 2.9 kg', () => {
    const result = evaluateRules({
      ...base,
      planWeightKg: 82,
      entries: [entry(d, 79.1)],
      today: d,
    });
    expect(result).toBeNull();
  });

  it('bigChange fires on a gain and says "gained"', () => {
    const result = evaluateRules({
      ...base,
      planWeightKg: 82,
      entries: [entry(d, 85.2)],
      today: d,
    });
    expect(result?.id).toBe('bigChange');
    expect(result?.body).toContain('gained 3.2 kg');
  });

  const plateauEntries = [
    entry('2026-11-04', 80),
    entry('2026-11-19', 80.1),
    entry('2026-11-22', 80),
    entry('2026-11-25', 79.9),
  ];

  it('plateau fires for a lose goal with ±0.3 kg over 21 days and 3+ entries', () => {
    const result = evaluateRules({
      ...base,
      planWeightKg: 80,
      entries: plateauEntries,
      today: d,
    });
    expect(result?.id).toBe('plateau');
    expect(result?.suggestions).toHaveLength(4);
  });

  it('plateau does not fire for gain or healthier goals', () => {
    expect(
      evaluateRules({
        ...base,
        planWeightKg: 80,
        effectiveGoal: 'gain',
        entries: plateauEntries,
        today: d,
      }),
    ).toBeNull();
    expect(
      evaluateRules({
        ...base,
        planWeightKg: 80,
        effectiveGoal: 'healthier',
        entries: plateauEntries,
        today: d,
      }),
    ).toBeNull();
  });

  it('plateau does not fire with only 2 entries in the window', () => {
    const entries = [entry('2026-11-04', 80), entry('2026-11-25', 80)];
    expect(evaluateRules({ ...base, planWeightKg: 80, entries, today: d })).toBeNull();
  });

  it('keeps the priority order when several rules qualify', () => {
    const result = evaluateRules({
      ...base,
      planWeightKg: 92, // latest 88 -> bigChange would also fire
      entries: fastLossEntries,
      today: d,
    });
    expect(result?.id).toBe('fastLoss');
  });

  it('hides a dismissed rule for 14 days, then shows it again', () => {
    const dismissed = { fastLoss: '2026-11-25' };
    expect(
      evaluateRules({
        ...base,
        entries: fastLossEntries,
        today: '2026-11-30',
        dismissedRules: dismissed,
      }),
    ).toBeNull();
    expect(
      evaluateRules({
        ...base,
        entries: fastLossEntries,
        today: '2026-12-09',
        dismissedRules: dismissed,
      })?.id,
    ).toBe('fastLoss');
  });

  it('returns null in guidance mode', () => {
    expect(
      evaluateRules({ ...base, mode: 'guidance', entries: fastLossEntries, today: d }),
    ).toBeNull();
  });
});

describe('nudge', () => {
  const savedAt = '2026-11-04T09:00:00+05:30';

  it('is due when the plan is a week old and there are no entries', () => {
    expect(isNudgeDue({ savedAt, entries: [], today: '2026-11-14' })).toBe(true);
  });

  it('is not due while the plan is younger than a week', () => {
    expect(
      isNudgeDue({ savedAt: '2026-11-10T09:00:00+05:30', entries: [], today: '2026-11-14' }),
    ).toBe(false);
  });

  it('is not due when a check-in was logged within the last week', () => {
    expect(isNudgeDue({ savedAt, entries: [entry('2026-11-11', 80)], today: '2026-11-14' })).toBe(
      false,
    );
  });

  it('is due when the last check-in is more than a week old', () => {
    expect(isNudgeDue({ savedAt, entries: [entry('2026-11-04', 80)], today: '2026-11-14' })).toBe(
      true,
    );
  });

  it('is not due within a week of being dismissed, then is due again', () => {
    expect(
      isNudgeDue({ savedAt, entries: [], nudgeDismissedOn: '2026-11-10', today: '2026-11-14' }),
    ).toBe(false);
    expect(
      isNudgeDue({ savedAt, entries: [], nudgeDismissedOn: '2026-11-04', today: '2026-11-14' }),
    ).toBe(true);
  });
});

describe('progress storage', () => {
  it('reads an empty log when the key is missing', () => {
    expect(readProgress()).toEqual({ v: 1, entries: [], dismissedRules: {} });
  });

  it('reads an empty log when the key is invalid', () => {
    localStorage.setItem(PROGRESS_KEY, '{bad');
    expect(readProgress().entries).toEqual([]);
  });

  it('upsert replaces the same date, keeps the id and stays sorted', () => {
    const first = upsertEntry({ date: '2026-11-10', weightKg: 82 });
    const id = first.entries[0]?.id;
    const after = upsertEntry({ date: '2026-11-01', weightKg: 83 });
    const replaced = upsertEntry({ date: '2026-11-10', weightKg: 81.4 });

    expect(replaced.entries.map((item) => item.date)).toEqual(['2026-11-01', '2026-11-10']);
    expect(replaced.entries[1]?.id).toBe(id);
    expect(replaced.entries[1]?.weightKg).toBe(81.4);
    expect(after.entries).toHaveLength(2);
  });

  it('rounds weight and waist to one decimal', () => {
    const log = upsertEntry({ date: '2026-11-10', weightKg: 82.34, waistCm: 88.76 });
    expect(log.entries[0]?.weightKg).toBe(82.3);
    expect(log.entries[0]?.waistCm).toBe(88.8);
  });

  it('deleteEntry removes one entry by id', () => {
    const log = upsertEntry({ date: '2026-11-10', weightKg: 82 });
    const id = log.entries[0]?.id ?? '';
    expect(deleteEntry(id).entries).toHaveLength(0);
  });

  it('writeProgress persists the log', () => {
    writeProgress({
      v: 1,
      entries: [entry('2026-11-10', 82)],
      dismissedRules: { plateau: '2026-11-14' },
    });
    expect(readProgress().dismissedRules.plateau).toBe('2026-11-14');
  });

  it('clearAll removes only eidolon keys', () => {
    localStorage.setItem('unrelated-key', 'keep me');
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, entries: [], dismissedRules: {} }));
    localStorage.setItem('eidolon:draft:v1', '{}');
    clearAll();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem('eidolon:draft:v1')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep me');
  });
});

describe('applyWeightParam', () => {
  const draft = { weightKg: 82 };

  it('overrides the draft weight from a valid param', () => {
    expect(applyWeightParam(draft, new URLSearchParams('weight=78.5')).weightKg).toBe(78.5);
  });

  it('ignores an out-of-range, non-numeric or missing param', () => {
    expect(applyWeightParam(draft, new URLSearchParams('weight=25')).weightKg).toBe(82);
    expect(applyWeightParam(draft, new URLSearchParams('weight=abc')).weightKg).toBe(82);
    expect(applyWeightParam(draft, new URLSearchParams('')).weightKg).toBe(82);
  });
});
