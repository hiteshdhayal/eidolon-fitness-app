import { describe, expect, it } from 'vitest';
import { clamp, formatKcal, formatNumber, roundToNearest, slugify } from './format';

describe('clamp', () => {
  it('returns the value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below the minimum', () => {
    expect(clamp(-2, 0, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('roundToNearest', () => {
  it('rounds to the nearest 50', () => {
    expect(roundToNearest(1837, 50)).toBe(1850);
    expect(roundToNearest(1824, 50)).toBe(1800);
  });

  it('returns the value unchanged for a non-positive step', () => {
    expect(roundToNearest(1837, 0)).toBe(1837);
  });
});

describe('formatKcal', () => {
  it('adds the unit and groups Indian digits', () => {
    expect(formatKcal(1840)).toBe('1,840 kcal');
  });

  it('rounds fractional calories', () => {
    expect(formatKcal(1840.6)).toBe('1,841 kcal');
  });
});

describe('formatNumber', () => {
  it('formats with no decimals by default', () => {
    expect(formatNumber(12000)).toBe('12,000');
  });

  it('formats one decimal place when asked', () => {
    expect(formatNumber(72.35, 1)).toBe('72.4');
  });
});

describe('slugify', () => {
  it('builds a clean slug', () => {
    expect(slugify('High-protein South Indian breakfast')).toBe(
      'high-protein-south-indian-breakfast',
    );
  });

  it('strips punctuation and accents', () => {
    expect(slugify('  Puttu & Kadala — Kerala ')).toBe('puttu-kadala-kerala');
  });
});
