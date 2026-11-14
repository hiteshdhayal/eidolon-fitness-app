/**
 * Header/hero/final/sticky "plan" CTA rules (Part A4). Pure so both the small
 * inline script and the unit tests share one source of truth.
 */

export type PlanCtaKind = 'header' | 'default';

export interface PlanCtaResult {
  /** Hide the CTA entirely (only the header CTA on /plan). */
  hidden: boolean;
  /** Label to apply, if the default is not already correct. */
  label?: string;
  /** Href to apply, if the default is not already correct. */
  href?: string;
}

export function planCtaFor(kind: PlanCtaKind, path: string, hasPlan: boolean): PlanCtaResult {
  const onPlan = path === '/plan' || path === '/plan/';
  const onMyPlan = path === '/my-plan' || path === '/my-plan/';

  if (kind === 'header') {
    if (onPlan) return { hidden: true };
    if (onMyPlan) {
      return hasPlan
        ? { hidden: false, label: 'Edit my plan', href: '/plan/?edit=1' }
        : { hidden: false, label: 'Build my plan', href: '/plan/' };
    }
  }

  return hasPlan
    ? { hidden: false, label: 'Open my plan', href: '/my-plan/' }
    : { hidden: false, label: 'Build my plan', href: '/plan/' };
}
