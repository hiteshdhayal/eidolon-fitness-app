import { describe, expect, it } from 'vitest';
import { wrapOgTitle } from '../../src/lib/seo/ogTitle';

describe('wrapOgTitle', () => {
  it('keeps a short title on one line at the max size', () => {
    const { lines, fontSize } = wrapOgTitle('BMI calculator');
    expect(lines).toHaveLength(1);
    expect(fontSize).toBe(72);
  });

  it('uppercases the title', () => {
    const { lines } = wrapOgTitle('bmi calculator');
    expect(lines[0]).toBe('BMI CALCULATOR');
  });

  it('wraps a medium title onto 2-3 lines without shrinking below the floor', () => {
    const { lines, fontSize } = wrapOgTitle(
      'Free Indian diet plan, built on your food',
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(fontSize).toBeGreaterThanOrEqual(56);
  });

  it('never goes below 56px', () => {
    const { fontSize } = wrapOgTitle(
      'This is a deliberately very long article title that keeps going and going and going and going to force the smallest size',
    );
    expect(fontSize).toBeGreaterThanOrEqual(56);
  });

  it('never produces more than 3 lines, and ellipsises the last one when truncated', () => {
    const { lines } = wrapOgTitle(
      'This is a deliberately very long article title that keeps going and going and going and going to force the smallest size and then some more words after that to be absolutely sure it overflows three lines',
    );
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines[lines.length - 1]).toMatch(/…$/);
  });

  it('is deterministic', () => {
    const a = wrapOgTitle('Calorie calculator for Indians');
    const b = wrapOgTitle('Calorie calculator for Indians');
    expect(a).toEqual(b);
  });
});
