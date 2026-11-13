/**
 * Hostel / mess and eat-out modes (spec §7.3): when someone doesn't
 * control the menu, they get plate-building rules instead of recipes.
 */
import { checkFood, type FoodContext } from './filter';
import type { Food } from '../../data/foods/schema';
import type { PlateGuide, Targets } from './types';

function proteinWords(ctx: FoodContext): string {
  const a = ctx.answers;
  const noDairy = a.restrictions.includes('noDairy') || a.dietType === 'vegan';
  const parts = ['dal'];
  if (!noDairy) parts.push('paneer');
  if (a.dietType === 'vegan' || a.dietType === 'veg' || a.dietType === 'jain')
    parts.push('chana or rajma');
  if (a.dietType === 'eggetarian' || (a.dietType === 'nonveg' && a.meats.includes('eggs')))
    parts.push('egg');
  if (a.dietType === 'nonveg' && a.meats.includes('chicken')) parts.push('chicken');
  if (a.dietType === 'nonveg' && a.meats.includes('fish')) parts.push('fish');
  return parts.join('/');
}

function portions(t: Targets): string[] {
  const perMain = Math.round(t.protein / 3 / 5) * 5;
  const carbs =
    t.kcal < 1600
      ? '2 rotis or 1 katori rice'
      : t.kcal < 2200
        ? '2–3 rotis or 1½ katori rice'
        : '3–4 rotis or 2 katori rice';
  return [
    `At lunch and dinner: ${carbs}.`,
    `Protein at every meal: aim for about ${perMain} g at each main meal. An extra katori of dal or curd is the easiest way at a mess.`,
    `Your day adds up to about ${t.kcal.toLocaleString('en-IN')} kcal and ${t.protein} g protein.`,
  ];
}

const ORDERING: Record<string, { place: string; tip: string; needs?: string[] }[]> = {
  south: [
    { place: 'South Indian restaurant', tip: '2 idli + extra sambar instead of a masala dosa.' },
    {
      place: 'Meals / thali',
      tip: 'Finish the sambar, rasam, poriyal and curd; take one serving of rice, not a refill.',
    },
  ],
  north: [
    {
      place: 'Dhaba',
      tip: 'Dal + 2 tandoori rotis + salad instead of butter naan and paneer butter masala.',
    },
    {
      place: 'Chole or rajma counter',
      tip: 'Rajma-chawal or chole with 2 rotis; skip the bhature most days.',
    },
  ],
  west: [
    {
      place: 'Gujarati or Kathiawadi thali',
      tip: 'Dal, kadhi, 2 rotlis and the sabzis; go easy on the farsan and sweets.',
    },
    { place: 'Misal or vada pav stall', tip: 'Misal with 1 pav and less farsan beats 2 vada pav.' },
  ],
  east: [
    {
      place: 'Bengali or Odia hotel',
      tip: 'Rice with dal, a sabzi and a fish curry; skip the extra fried item.',
      needs: ['fish'],
    },
    { place: 'Litti stall', tip: '2 littis with chokha; ask them not to dunk the litti in ghee.' },
  ],
  northeast: [
    { place: 'Momo stall', tip: 'Steamed over fried; add a bowl of thukpa for a fuller meal.' },
    {
      place: 'Rice hotel',
      tip: 'Rice with dal, a green and a light curry; skip the extra pork fat.',
      needs: ['pork'],
    },
  ],
  central: [
    {
      place: 'Poha-jalebi stall',
      tip: 'Poha with sprouts on top, and leave the jalebi for once a week.',
    },
    { place: 'Dal-bafla place', tip: '1–2 baflas with extra dal; ask for less ghee.' },
  ],
  general: [
    {
      place: 'Chinese counter',
      tip: 'A clear soup + a dry stir-fry (paneer, tofu or chicken) instead of fried rice + manchurian.',
    },
    {
      place: 'Biryani night',
      tip: '1 plate is plenty; add raita and salad and skip the extra gravy.',
    },
    {
      place: 'Office canteen',
      tip: 'Build the plate yourself: half sabzi and salad first, then dal or curd, then roti or rice.',
    },
  ],
};

export function buildPlateGuide(ctx: FoodContext, t: Targets): PlateGuide {
  const a = ctx.answers;
  const hostel = a.foodSource === 'hostel';
  const dietOk = (needs?: string[]) =>
    !needs || needs.every((n) => a.dietType === 'nonveg' && (a.meats as string[]).includes(n));

  const messTips = [
    'Fill half the plate with sabzi and salad before you take rice or roti.',
    'Take an extra katori of dal or curd instead of a second helping of rice.',
    'Skip the fried item (puri, pakora, papad) most days; once a week is fine.',
    'Pick dry sabzi over oily gravies when you can — gravies hide a lot of oil.',
  ];
  if (hostel)
    messTips.push('Keep a protein back-up in your room for days the mess is light on dal.');
  if (a.dietType === 'eggetarian' || (a.dietType === 'nonveg' && a.meats.includes('eggs'))) {
    messTips.push('If the mess serves eggs at breakfast, take 2.');
  }

  const backups: Food[] = [
    'roasted-chana',
    'sattu-drink',
    'peanuts',
    'curd',
    'boiled-eggs',
    'roasted-makhana',
  ]
    .map((id) => ctx.allowed.find((f) => f.id === id))
    .filter((f): f is Food => !!f && checkFood(f, a) !== null);
  const proteinTips = backups.map(
    (f) => `${f.name} (${f.serving.measure}) — about ${f.perServing.protein} g protein`,
  );

  const orderingGuide = [...(ORDERING[ctx.region] ?? []), ...ORDERING.general!]
    .filter((o) => dietOk(o.needs))
    .filter((o) => !(o.place === 'Biryani night' && a.dietType !== 'nonveg'))
    .map(({ place, tip }) => ({ place, tip }));

  return {
    baseRule: `½ plate sabzi/salad, ¼ ${proteinWords(ctx)}, ¼ roti or rice — 2 rotis or 1 katori rice.`,
    portions: portions(t),
    messTips,
    orderingGuide,
    proteinTips,
  };
}
