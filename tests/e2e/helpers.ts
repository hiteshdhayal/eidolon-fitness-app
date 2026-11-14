import { expect, type Page } from '@playwright/test';
import { AnswersSchema } from '../../src/lib/engine/schema';
import { buildPlan, groceryListFor } from '../../src/lib/engine/index';
import { FOODS } from '../../src/data/foods/index';
import { STATES } from '../../src/lib/engine/regions';
import { PLAN_KEY, DRAFT_KEY } from '../../src/lib/storage';
import type { AnswersInput } from '../../src/lib/engine/types';

export interface UiPersona {
  goal: string;
  sex: string;
  age: number;
  heightCm: number;
  weight: number;
  targetWeight?: number;
  conditions: string[];
  diabetesType?: string;
  medications: string[];
  trainingDays: string;
  trainingType: string[];
  steps: string;
  dayType?: string;
  state: string;
  homeRegion?: string;
  cuisineMix: string;
  dietType: string;
  meats: string[];
  restrictions: string[];
  foodSource: string;
  mealPattern: string;
  budget: string;
  supplements: string;
  firstName?: string;
}

export const VEG_HARYANA: UiPersona = {
  goal: 'Lose fat',
  sex: 'Male',
  age: 28,
  heightCm: 175.3,
  weight: 82,
  conditions: [],
  medications: [],
  trainingDays: '3–4 days',
  trainingType: ['Gym / weights'],
  steps: '6,000–9,000',
  state: 'Haryana',
  cuisineMix: "Mostly my region's food",
  dietType: 'Vegetarian',
  meats: [],
  restrictions: [],
  foodSource: 'Family cooks at home',
  mealPattern: '3 meals + snacks',
  budget: 'Moderate',
  supplements: 'Food only, please',
};

export const KERALA_PCOS: UiPersona = {
  goal: 'Lose fat',
  sex: 'Female',
  age: 31,
  heightCm: 158,
  weight: 68,
  conditions: ['PCOS / PCOD'],
  medications: [],
  trainingDays: '1–2 days a week',
  trainingType: [],
  steps: '3,000–6,000',
  state: 'Kerala',
  cuisineMix: "Mostly my region's food",
  dietType: 'Non-vegetarian',
  meats: ['Chicken', 'Fish & seafood', 'Eggs'],
  restrictions: [],
  foodSource: 'Family cooks at home',
  mealPattern: '3 meals',
  budget: 'Moderate',
  supplements: 'Food only, please',
};

export const JAIN_GUJARAT: UiPersona = {
  goal: 'Eat healthier and get fitter',
  sex: 'Female',
  age: 40,
  heightCm: 160,
  weight: 64,
  conditions: [],
  medications: [],
  trainingDays: 'Not training right now',
  trainingType: [],
  steps: '3,000–6,000',
  state: 'Gujarat',
  cuisineMix: "Mostly my region's food",
  dietType: 'Jain',
  meats: [],
  restrictions: [],
  foodSource: 'Family cooks at home',
  mealPattern: '3 meals + snacks',
  budget: 'Moderate',
  supplements: 'Food only, please',
};

export const TEEN: UiPersona = {
  ...VEG_HARYANA,
  age: 16,
  weight: 60,
  heightCm: 170,
};

export const PREGNANT: UiPersona = {
  ...KERALA_PCOS,
  conditions: ['Pregnant'],
  dietType: 'Vegetarian',
  meats: [],
  state: 'Tamil Nadu',
  trainingDays: 'Not training right now',
  trainingType: [],
};

export const HOSTEL: UiPersona = {
  ...VEG_HARYANA,
  age: 20,
  weight: 70,
  state: 'Karnataka',
  foodSource: 'Hostel, PG or mess',
};

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function currentStep(page: Page): Promise<string | null> {
  return page
    .locator('[data-step]')
    .getAttribute('data-step', { timeout: 5000 })
    .catch(() => null);
}

async function clickOption(page: Page, label: string): Promise<void> {
  await page
    .locator('label.qc-option')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first()
    .click();
}

async function clickNext(page: Page): Promise<void> {
  const before = await currentStep(page);
  // The last question's button reads "Review answers" instead of "Next".
  await page.getByRole('button', { name: /^(Next|Review answers)$/ }).click();
  if (before) {
    await page.waitForFunction(
      (previous) => document.querySelector('[data-step]')?.getAttribute('data-step') !== previous,
      before,
    );
  }
}

async function single(page: Page, label: string): Promise<void> {
  const before = await currentStep(page);
  await clickOption(page, label);
  await page.waitForTimeout(300);
  if ((await currentStep(page)) === before) await clickNext(page);
}

async function multi(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) await clickOption(page, label);
  await clickNext(page);
}

async function fillNumber(page: Page, selector: string, value: number): Promise<void> {
  await page.locator(selector).fill(String(value));
  await clickNext(page);
}

async function chooseState(page: Page, name: string): Promise<void> {
  const input = page.locator('.qc-combobox input');
  await input.fill(name);
  await input.press('Enter');
  await clickNext(page);
}

/** Walks the real questionnaire UI using the visible labels. */
export async function fillQuestionnaire(page: Page, persona: UiPersona): Promise<void> {
  await page.goto('/plan/');
  await page.getByRole('button', { name: /^Start/ }).click();

  await single(page, persona.goal);
  await single(page, persona.sex);
  await fillNumber(page, '#age-input', persona.age);

  await page.getByRole('button', { name: 'cm', exact: true }).click();
  await page.locator('#height-cm').fill(String(persona.heightCm));
  await clickNext(page);
  await fillNumber(page, '#weight-input', persona.weight);

  if ((await currentStep(page)) === 'targetWeight') {
    if (persona.targetWeight !== undefined) {
      await page.locator('#targetWeight-input').fill(String(persona.targetWeight));
    }
    await clickNext(page);
  }

  if ((await currentStep(page)) === 'conditions') {
    await multi(page, persona.conditions.length ? persona.conditions : ['None of these']);
  }
  if ((await currentStep(page)) === 'diabetesType' && persona.diabetesType) {
    await single(page, persona.diabetesType);
  }
  if ((await currentStep(page)) === 'medications') {
    await multi(page, persona.medications.length ? persona.medications : ['None']);
  }

  await single(page, persona.trainingDays);
  if ((await currentStep(page)) === 'trainingType') {
    if (persona.trainingType.length) await multi(page, persona.trainingType);
    else await clickNext(page);
  }
  await single(page, persona.steps);
  if ((await currentStep(page)) === 'dayType' && persona.dayType) {
    await single(page, persona.dayType);
  }

  await chooseState(page, persona.state);
  if ((await currentStep(page)) === 'homeRegion' && persona.homeRegion) {
    await chooseState(page, persona.homeRegion);
  }
  await single(page, persona.cuisineMix);
  await single(page, persona.dietType);
  if ((await currentStep(page)) === 'meats') await multi(page, persona.meats);
  if ((await currentStep(page)) === 'restrictions') {
    await multi(page, persona.restrictions.length ? persona.restrictions : ['None']);
  }
  await single(page, persona.foodSource);
  await single(page, persona.mealPattern);
  await single(page, persona.budget);
  await single(page, persona.supplements);
  if ((await currentStep(page)) === 'firstName') {
    if (persona.firstName) await page.locator('#firstName-input').fill(persona.firstName);
    await clickNext(page);
  }

  await expect(page.locator('.qc-legend')).toHaveText('Check your answers');
  await page.getByRole('button', { name: /Build my plan/ }).click();
  await page.waitForURL('**/my-plan/');
}

const CONDITIONS: Record<string, AnswersInput['conditions'][number]> = {
  'PCOS / PCOD': 'pcos',
  'Thyroid: hypothyroid (underactive)': 'hypothyroid',
  'Thyroid: hyperthyroid (overactive)': 'hyperthyroid',
  'Low iron / anaemia': 'anaemia',
  'Vitamin D or B12 deficiency': 'vitaminDB12',
  'Diabetes or prediabetes': 'diabetes',
  'High blood pressure': 'highBP',
  'High cholesterol or triglycerides': 'cholesterol',
  'Fatty liver': 'fattyLiver',
  'High uric acid / gout': 'uricAcid',
  'Thyroid issue': 'thyroid',
  'Acidity, bloating or IBS': 'acidityIBS',
  'Perimenopause / menopause': 'menopause',
  Pregnant: 'pregnant',
  Breastfeeding: 'breastfeeding',
  'Kidney disease': 'kidney',
  'Heart condition': 'heart',
};

const MEDICATIONS: Record<string, AnswersInput['medications'][number]> = {
  'Diabetes tablets (e.g. metformin, glimepiride)': 'diabetesTablets',
  Insulin: 'insulin',
  'Thyroid medicine': 'thyroid',
  'Blood pressure medicine': 'bp',
  'Cholesterol medicine': 'cholesterol',
  'Other regular medicine': 'other',
};

type TrainingCode = NonNullable<AnswersInput['trainingType']>[number];
type MeatCode = NonNullable<AnswersInput['meats']>[number];
type RestrictionCode = NonNullable<AnswersInput['restrictions']>[number];

const TRAINING: Record<string, TrainingCode> = {
  'Gym / weights': 'gym',
  'Home workouts': 'home',
  'Running or cycling': 'cardio',
  Sports: 'sports',
  'Yoga or pilates': 'yoga',
};

const MEATS: Record<string, MeatCode> = {
  Chicken: 'chicken',
  'Fish & seafood': 'fish',
  Eggs: 'eggs',
  Mutton: 'mutton',
  Pork: 'pork',
  Beef: 'beef',
};

const RESTRICTIONS: Record<string, RestrictionCode> = {
  'Lactose intolerant': 'lactose',
  'No dairy at all': 'noDairy',
  'Gluten-free': 'glutenFree',
  'Peanut allergy': 'peanut',
  'Tree-nut allergy': 'treeNut',
  'Soy-free': 'soy',
  'No onion & garlic': 'noOnionGarlic',
};

function mapped<T extends string>(labels: string[], map: Record<string, T>): T[] {
  return labels.map((label) => map[label]).filter((value): value is T => Boolean(value));
}

/** Persona answers for seeding a saved plan or a draft directly. */
export function answersFor(persona: UiPersona): AnswersInput {
  const state = STATES.find((item) => item.name === persona.state);
  const homeRegion = persona.homeRegion
    ? STATES.find((item) => item.name === persona.homeRegion)
    : undefined;

  return {
    goal:
      persona.goal === 'Lose fat'
        ? 'lose'
        : persona.goal === 'Build muscle'
          ? 'muscle'
          : persona.goal === 'Gain weight'
            ? 'gain'
            : 'healthier',
    sex: persona.sex === 'Male' ? 'male' : persona.sex === 'Female' ? 'female' : 'unspecified',
    age: persona.age,
    heightCm: persona.heightCm,
    heightUnit: 'cm',
    weightKg: persona.weight,
    targetWeightKg: persona.targetWeight,
    conditions: mapped(persona.conditions, CONDITIONS),
    diabetesType: persona.diabetesType as AnswersInput['diabetesType'],
    medications: mapped(persona.medications, MEDICATIONS),
    trainingDays:
      persona.trainingDays === 'Not training right now'
        ? 'none'
        : persona.trainingDays === '1–2 days a week'
          ? '1-2'
          : persona.trainingDays === '3–4 days'
            ? '3-4'
            : persona.trainingDays === '5–6 days'
              ? '5-6'
              : '7',
    trainingType: mapped(persona.trainingType, TRAINING),
    steps:
      persona.steps === 'Under 3,000'
        ? 'lt3k'
        : persona.steps === '3,000–6,000'
          ? '3-6k'
          : persona.steps === '6,000–9,000'
            ? '6-9k'
            : persona.steps === '9,000–12,000'
              ? '9-12k'
              : persona.steps === 'More than 12,000'
                ? 'gt12k'
                : 'unsure',
    dayType: persona.dayType as AnswersInput['dayType'],
    state: (state?.code ?? 'HR') as AnswersInput['state'],
    homeRegion: homeRegion?.code as AnswersInput['homeRegion'],
    cuisineMix: persona.cuisineMix === 'Mix in food from other regions' ? 'mixIn' : 'mostlyMine',
    dietType:
      persona.dietType === 'Vegetarian'
        ? 'veg'
        : persona.dietType === 'Eggetarian (veg + eggs)'
          ? 'eggetarian'
          : persona.dietType === 'Non-vegetarian'
            ? 'nonveg'
            : persona.dietType === 'Vegan'
              ? 'vegan'
              : 'jain',
    meats: persona.dietType === 'Non-vegetarian' ? mapped(persona.meats, MEATS) : [],
    restrictions: mapped(persona.restrictions, RESTRICTIONS),
    foodSource:
      persona.foodSource === 'I cook for myself'
        ? 'self'
        : persona.foodSource === 'Hostel, PG or mess'
          ? 'hostel'
          : persona.foodSource === 'I mostly order or eat out'
            ? 'eatOut'
            : 'family',
    mealPattern:
      persona.mealPattern === '3 meals'
        ? '3'
        : persona.mealPattern === '2 meals (I skip breakfast)'
          ? '2'
          : '3+snacks',
    budget:
      persona.budget === 'Keep it cheap'
        ? 'cheap'
        : persona.budget === 'Flexible'
          ? 'flexible'
          : 'moderate',
    supplements: persona.supplements === 'Open to it if it helps' ? 'open' : 'foodOnly',
    firstName: persona.firstName,
  };
}

/** Seed eidolon:plan:v1 with a real engine plan before the page loads. */
export async function seedPlan(page: Page, persona: UiPersona): Promise<void> {
  const raw = answersFor(persona);
  const answers = AnswersSchema.parse(raw);
  const plan = buildPlan(answers, FOODS, { now: new Date('2026-11-13T10:00:00Z') });
  const groceries = groceryListFor(plan, answers, FOODS);
  const saved = {
    v: 1,
    answers,
    plan,
    groceries,
    savedAt: '2026-11-13T10:00:00Z',
  };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: PLAN_KEY, value: JSON.stringify(saved) },
  );
}

/** Seed a questionnaire draft at a specific step. */
export async function seedDraft(
  page: Page,
  answers: Record<string, unknown>,
  stepId: string,
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    {
      key: DRAFT_KEY,
      value: JSON.stringify({ v: 1, answers, stepId, updatedAt: '2026-11-13T10:00:00Z' }),
    },
  );
}

export { escape };
