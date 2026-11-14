/**
 * Formatting helpers for the plan view island. Kept out of the JSX so they can
 * be unit-tested.
 */

export interface MeasureItem {
  measure: string;
  grams: number;
  kcal: number;
  protein: number;
}

/** True when a household measure already states a gram or millilitre figure. */
const HAS_GRAM_OR_ML = /\d+\s?(g|ml)\b/;

/**
 * The mono meta line under a meal item. The measure already carries grams for
 * single-ingredient foods ("200 g cooked rice", "1 katori (150 g)"), so only add
 * a grams figure when the measure does not.
 */
export function itemMeta(item: MeasureItem): string {
  const tail = `${item.kcal} kcal · ${item.protein} g protein`;
  if (HAS_GRAM_OR_ML.test(item.measure)) return `${item.measure} · ${tail}`;
  return `${item.measure} · ${item.grams} g · ${tail}`;
}

/** "hitesh" → "Hitesh". Used for the display name only; stored value is unchanged. */
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
