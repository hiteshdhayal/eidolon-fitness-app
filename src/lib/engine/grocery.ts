/**
 * Weekly grocery list (spec §7.3), grouped by category. Single-ingredient
 * foods (rice, atta, curd, eggs …) get a weekly amount; dishes add their
 * key ingredients. Item ids are stable slugs so Phase 3 can persist the
 * checkboxes.
 */
import type { Food } from '../../data/foods/schema';
import type { DayDraft } from './generate';
import type { Answers, GroceryCategory, GroceryList } from './types';

export const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  grains: 'Grains',
  dals: 'Dals and legumes',
  dairy: 'Dairy and alternatives',
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  protein: 'Protein',
  spicesOil: 'Spices and oil',
};

const ORDER: GroceryCategory[] = [
  'grains',
  'dals',
  'dairy',
  'vegetables',
  'fruits',
  'protein',
  'spicesOil',
];

/** First match wins. Order matters: "coconut milk" before "coconut". */
const RULES: [RegExp, GroceryCategory][] = [
  [/coconut milk|soy milk|almond milk/, 'dairy'],
  [/peanut butter|peanuts?|almonds?|walnuts?|cashew|raisins|dried prawns|ngari/, 'protein'],
  [
    /oil|masala|powder|seeds|cumin|turmeric|jaggery|gur\b|tamarind|kokum|kodampuli|asafoetida|panch phoron|bay leaf|pepper|ajwain|fennel|sugar|khar|sesame|yeast|dry red chilli|kashmiri chilli|mathania chilli|whole spices|kasuri methi|dry ginger|dry mango|amchur|salt|chaat/,
    'spicesOil',
  ],
  [/curd|milk|paneer|chhena|ghee|butter|cream|\bdoi\b|lassi/, 'dairy'],
  [/eggs?\b|chicken|fish|rohu|katla|prawns|mutton|pork|tofu|soya|soybean/, 'protein'],
  [
    /dal\b|chana|rajma|moong|matki|dried peas|yellow peas|urad|masoor|toor|sattu|besan|lentil|kala chana|kabuli|sprouts|hara chana/,
    'dals',
  ],
  [
    /rice|atta|flour|poha|chura|chira|rava|dalia|oats|bread|pao|pav|noodles|maida|jowar|bajra|ragi|makki|mandua|sabudana|muri|kurmura|khakhra|batter|puttu podi|bhajani|makhana|sev|farsan|chak-hao|kabok|chikki|corn cobs/,
    'grains',
  ],
  [/banana|fruit|lemon|pomegranate|guava|apple|orange|amla/, 'fruits'],
];

export function categorize(name: string): GroceryCategory {
  const n = name.toLowerCase();
  for (const [re, cat] of RULES) if (re.test(n)) return cat;
  return 'vegetables';
}

const ONION_GARLIC = /\bonion|garlic|shallot|spring onion/;
const ROOT_VEG = /potato|carrot|radish|beet|\byam\b|turnip|\bginger\b|lotus stem|garadu|nadru/;

function skipIngredient(name: string, f: Food, a: Answers): boolean {
  const n = name.toLowerCase();
  const jain = a.dietType === 'jain';
  const noOG = jain || a.restrictions.includes('noOnionGarlic');
  if (noOG && f.canSkip.includes('onionGarlic') && ONION_GARLIC.test(n)) return true;
  if (jain && f.canSkip.includes('rootVeg') && ROOT_VEG.test(n)) return true;
  if (
    (a.restrictions.includes('noDairy') || a.dietType === 'vegan') &&
    categorize(n) === 'dairy' &&
    !/coconut|soy|almond/.test(n)
  )
    return true;
  return false;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function formatAmount(amount: number, unit: 'g' | 'ml' | 'pcs'): string {
  if (unit === 'pcs') return `${Math.ceil(amount)}`;
  if (amount >= 1000) {
    const v = Math.round(amount / 100) / 10;
    return `about ${v} ${unit === 'g' ? 'kg' : 'litres'}`;
  }
  return `about ${Math.max(50, Math.round(amount / 50) * 50)} ${unit}`;
}

export function buildGroceryList(days: DayDraft[], a: Answers): GroceryList {
  const items = new Map<
    string,
    { name: string; uses: number; amount: number; unit: 'g' | 'ml' | 'pcs' | null }
  >();
  const add = (name: string, amount = 0, unit: 'g' | 'ml' | 'pcs' | null = null) => {
    const key = slug(name);
    const cur = items.get(key) ?? { name: cap(name), uses: 0, amount: 0, unit };
    cur.uses += 1;
    if (unit && (cur.unit === null || cur.unit === unit)) {
      cur.unit = unit;
      cur.amount += amount;
    }
    items.set(key, cur);
  };

  for (const day of days)
    for (const meal of day.meals)
      for (const c of meal.comps) {
        const f = c.food;
        if (f.raw) add(f.raw.item, f.raw.amount * c.m, f.raw.unit);
        else for (const ing of f.buys) if (!skipIngredient(ing, f, a)) add(ing);
      }

  const grouped = new Map<GroceryCategory, GroceryList['categories'][number]['items']>();
  for (const [id, it] of items) {
    const category = categorize(it.name);
    const list = grouped.get(category) ?? [];
    list.push({
      id,
      name: it.name,
      category,
      amount: it.unit && it.amount > 0 ? formatAmount(it.amount, it.unit) : '',
      uses: it.uses,
    });
    grouped.set(category, list);
  }

  return {
    categories: ORDER.filter((c) => grouped.has(c)).map((c) => ({
      id: c,
      label: CATEGORY_LABELS[c],
      items: grouped.get(c)!.sort((x, y) => y.uses - x.uses || x.name.localeCompare(y.name)),
    })),
  };
}
