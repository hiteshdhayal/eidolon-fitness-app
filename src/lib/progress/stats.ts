/**
 * Pure weight statistics for the tracker. All functions take the entry list
 * (kept sorted ascending by storage) and a date, so tests are deterministic.
 * Full precision is kept for the rules; rounding happens only for display.
 */
import { addDays, daysBetween } from './dates';
import type { Entry } from './schema';

const round1 = (n: number) => Math.round(n * 10) / 10;

function sorted(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Mean weight over the trailing 7-day window [date − 6, date], or undefined. */
export function smoothed(entries: Entry[], date: string): number | undefined {
  const from = addDays(date, -6);
  const window = entries.filter((entry) => entry.date >= from && entry.date <= date);
  if (window.length === 0) return undefined;
  return window.reduce((sum, entry) => sum + entry.weightKg, 0) / window.length;
}

/** The moving-average line: one point per entry date. */
export function smoothedSeries(entries: Entry[]): { date: string; value: number }[] {
  const list = sorted(entries);
  const out: { date: string; value: number }[] = [];
  for (const entry of list) {
    const value = smoothed(list, entry.date);
    if (value !== undefined) out.push({ date: entry.date, value });
  }
  return out;
}

/**
 * The smoothed value at the latest entry date inside [date − tolerance, date],
 * or undefined when there is no entry in that window.
 */
export function valueNear(entries: Entry[], date: string, toleranceDays = 3): number | undefined {
  const list = sorted(entries);
  const from = addDays(date, -toleranceDays);
  const candidates = list.filter((entry) => entry.date >= from && entry.date <= date);
  if (candidates.length === 0) return undefined;
  const latest = candidates[candidates.length - 1];
  if (!latest) return undefined;
  return smoothed(list, latest.date);
}

export interface Summary {
  count: number;
  changeKg?: number;
  weeklyKg?: number;
  firstDate?: string;
  latestDate?: string;
  latestWeight?: number;
  waistChangeCm?: number;
  /** Date of the first entry that has a waist measurement. */
  firstWaistDate?: string;
}

export function summary(entries: Entry[]): Summary {
  const list = sorted(entries);
  const first = list[0];
  const latest = list[list.length - 1];
  if (!first || !latest) return { count: 0 };

  const result: Summary = {
    count: list.length,
    firstDate: first.date,
    latestDate: latest.date,
    latestWeight: latest.weightKg,
  };

  if (list.length >= 2) {
    const changeKg = round1(latest.weightKg - first.weightKg);
    result.changeKg = changeKg;
    const span = daysBetween(first.date, latest.date);
    if (span >= 7) result.weeklyKg = round1(changeKg / (span / 7));
  }

  const waists = list.filter((entry) => entry.waistCm !== undefined);
  const firstWaist = waists[0];
  const lastWaist = waists[waists.length - 1];
  if (waists.length >= 2 && firstWaist && lastWaist) {
    result.waistChangeCm = round1((lastWaist.waistCm as number) - (firstWaist.waistCm as number));
    result.firstWaistDate = firstWaist.date;
  }

  return result;
}

/** "−2.4 kg", "+0.6 kg", "0.0 kg" — with the true minus sign (U+2212). */
export function formatSigned(n: number, unit: string): string {
  const value = round1(n);
  if (value === 0) return `0.0 ${unit}`;
  const sign = value < 0 ? '\u2212' : '+';
  return `${sign}${Math.abs(value).toFixed(1)} ${unit}`;
}
