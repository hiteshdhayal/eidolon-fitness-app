import { describe, expect, it } from 'vitest';
import { capitalize, itemMeta } from '../../src/lib/plan/format';

describe('itemMeta', () => {
  it('drops the grams figure when the measure already has one', () => {
    expect(itemMeta({ measure: '200 g cooked rice', grams: 200, kcal: 260, protein: 5 })).toBe(
      '200 g cooked rice · 260 kcal · 5 g protein',
    );
  });

  it('keeps the grams figure when the measure has none', () => {
    expect(itemMeta({ measure: '2 rotis', grams: 70, kcal: 210, protein: 6 })).toBe(
      '2 rotis · 70 g · 210 kcal · 6 g protein',
    );
  });

  it('treats a measure with a bracketed weight as already having grams', () => {
    expect(itemMeta({ measure: '1 katori (150 g)', grams: 150, kcal: 180, protein: 8 })).toBe(
      '1 katori (150 g) · 180 kcal · 8 g protein',
    );
  });

  it('handles millilitres', () => {
    expect(itemMeta({ measure: '250 ml milk', grams: 250, kcal: 160, protein: 8 })).toBe(
      '250 ml milk · 160 kcal · 8 g protein',
    );
  });

  it('does not treat a bare count as grams', () => {
    expect(itemMeta({ measure: '3 idlis', grams: 120, kcal: 150, protein: 4 })).toBe(
      '3 idlis · 120 g · 150 kcal · 4 g protein',
    );
  });
});

describe('capitalize', () => {
  it('uppercases only the first letter and keeps the rest', () => {
    expect(capitalize('hitesh')).toBe('Hitesh');
    expect(capitalize('Aarav')).toBe('Aarav');
    expect(capitalize('')).toBe('');
  });
});
