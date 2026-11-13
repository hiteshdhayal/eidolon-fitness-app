export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundToNearest(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

const kcalFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatKcal(value: number): string {
  return `${kcalFormatter.format(Math.round(value))} kcal`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
