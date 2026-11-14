/**
 * Pure chart maths for the weight chart. No DOM, no dates library.
 */
import { addDays, daysBetween } from './dates';
import type { Entry } from './schema';

export type ChartRange = '4w' | '12w' | 'all';

export interface ChartDomain {
  min: number;
  max: number;
  ticks: number[];
}

const RANGE_DAYS: Record<Exclude<ChartRange, 'all'>, number> = { '4w': 28, '12w': 84 };

function sorted(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function visibleRange(entries: Entry[], range: ChartRange, today: string): Entry[] {
  const list = sorted(entries);
  if (range === 'all') return list;
  const from = addDays(today, -RANGE_DAYS[range]);
  return list.filter((entry) => entry.date >= from);
}

function makeTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let value = min; value <= max + 1e-9; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

/**
 * A padded, "nice" y domain for the visible weights, optionally including the
 * target when it sits within 5 kg of the data. Snaps outward and keeps 3–6 ticks.
 */
export function yDomain(values: number[], targetKg?: number): ChartDomain {
  let min = values.length ? Math.min(...values) : 0;
  let max = values.length ? Math.max(...values) : 1;

  if (targetKg !== undefined && targetKg >= min - 5 && targetKg <= max + 5) {
    min = Math.min(min, targetKg);
    max = Math.max(max, targetKg);
  }

  min -= 0.5;
  max += 0.5;
  const span = max - min;

  let step = span <= 3 ? 0.5 : span <= 8 ? 1 : span <= 20 ? 2 : 5;
  let low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  let ticks = makeTicks(low, high, step);

  while (ticks.length > 6) {
    step *= 2;
    low = Math.floor(min / step) * step;
    high = Math.ceil(max / step) * step;
    ticks = makeTicks(low, high, step);
  }
  while (ticks.length < 3 && step > 0.25) {
    step /= 2;
    low = Math.floor(min / step) * step;
    high = Math.ceil(max / step) * step;
    ticks = makeTicks(low, high, step);
  }

  return { min: low, max: high, ticks };
}

export function xScale(date: string, domain: { from: string; to: string }, width: number): number {
  const span = Math.max(1, daysBetween(domain.from, domain.to));
  return (daysBetween(domain.from, date) / span) * width;
}

export function yScale(
  value: number,
  domain: { min: number; max: number },
  height: number,
): number {
  const span = Math.max(1e-6, domain.max - domain.min);
  return height - ((value - domain.min) / span) * height;
}

/** Evenly spaced dates, at most `maxTicks` of them. */
export function xTicks(dates: string[], maxTicks: number): string[] {
  const unique = [...new Set(dates)].sort();
  if (unique.length <= maxTicks) return unique;
  const out: string[] = [];
  const step = (unique.length - 1) / (maxTicks - 1);
  for (let i = 0; i < maxTicks; i += 1) {
    const date = unique[Math.round(i * step)];
    if (date && !out.includes(date)) out.push(date);
  }
  return out;
}
