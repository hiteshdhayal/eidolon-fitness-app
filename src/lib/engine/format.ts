/** Household measures for display: "1½ katori", "3 rotis", "75 g". */
import { UNITS, type Food } from '../../data/foods/schema';

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

export function formatQty(q: number): string {
  const whole = Math.floor(q + 1e-9);
  const frac = Math.round((q - whole) * 4) / 4;
  const f = FRACTIONS[frac] ?? '';
  if (whole === 0) return f || '0';
  return `${whole}${f}`;
}

export function measureText(f: Food, multiplier: number): string {
  if (Math.abs(multiplier - 1) < 1e-9) return f.serving.measure;
  const qty = f.serving.qty * multiplier;
  const unit = UNITS[f.serving.unit];
  if (f.serving.unit === 'g') return `${Math.round(qty)} g`;
  if (unit.count) {
    const n = Math.round(qty);
    return `${n} ${n === 1 ? unit.one : unit.many}`;
  }
  return `${formatQty(qty)} ${qty > 1 ? unit.many : unit.one}`;
}
