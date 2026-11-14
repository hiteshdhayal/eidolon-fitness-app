import { describe, expect, it } from 'vitest';
import { planCtaFor } from '../../src/lib/cta';

describe('planCtaFor', () => {
  describe('header CTA', () => {
    it('is hidden on /plan with and without a plan', () => {
      expect(planCtaFor('header', '/plan/', false).hidden).toBe(true);
      expect(planCtaFor('header', '/plan/', true).hidden).toBe(true);
      expect(planCtaFor('header', '/plan', true).hidden).toBe(true);
    });

    it('offers to build the plan on /my-plan with no plan', () => {
      expect(planCtaFor('header', '/my-plan/', false)).toEqual({
        hidden: false,
        label: 'Build my plan',
        href: '/plan/',
      });
    });

    it('offers to edit the plan on /my-plan with a plan', () => {
      expect(planCtaFor('header', '/my-plan/', true)).toEqual({
        hidden: false,
        label: 'Edit my plan',
        href: '/plan/?edit=1',
      });
    });

    it('opens a saved plan from anywhere else', () => {
      expect(planCtaFor('header', '/', true)).toEqual({
        hidden: false,
        label: 'Open my plan',
        href: '/my-plan/',
      });
    });

    it('builds the plan from anywhere else with no saved plan', () => {
      expect(planCtaFor('header', '/learn/', false)).toEqual({
        hidden: false,
        label: 'Build my plan',
        href: '/plan/',
      });
    });
  });

  describe('hero / final / sticky CTA', () => {
    it('builds the plan with no saved plan', () => {
      expect(planCtaFor('default', '/', false)).toEqual({
        hidden: false,
        label: 'Build my plan',
        href: '/plan/',
      });
    });

    it('opens the plan with a saved plan', () => {
      expect(planCtaFor('default', '/', true)).toEqual({
        hidden: false,
        label: 'Open my plan',
        href: '/my-plan/',
      });
    });

    it('is never hidden', () => {
      expect(planCtaFor('default', '/plan/', true).hidden).toBe(false);
    });
  });
});
