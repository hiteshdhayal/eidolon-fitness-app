/**
 * Questionnaire definitions (Part C). Copy and options only — the flow logic
 * (visible steps, validation, engine mapping) lives in `flow.ts`.
 *
 * Labels map to engine values exactly as written here.
 */
import type { AnswersInput } from '../engine/types';

export type DraftAnswers = Partial<AnswersInput>;

export interface Choice {
  value: string | number;
  label: string;
  sublabel?: string;
}

export type QuestionKind = 'single' | 'multi' | 'number' | 'height' | 'state' | 'text';

export interface QuestionDef {
  id: string;
  kind: QuestionKind;
  legend: string;
  helper?: string;
  options?: Choice[];
  /** Options that depend on earlier answers (conditions, restrictions). */
  optionsFor?: (a: DraftAnswers) => Choice[];
  /** Adds an exclusive "None" row for multi-select questions. */
  noneLabel?: string;
  /** Multi-select that is allowed to be empty (trainingType). */
  optional?: boolean;
  /** Optional-with-a-skip control (targetWeight, firstName). */
  skippable?: boolean;
  placeholder?: string;
  show?: (a: DraftAnswers) => boolean;
}

const CONDITION_CHOICES: Record<string, Choice> = {
  pcos: { value: 'pcos', label: 'PCOS / PCOD' },
  hypothyroid: { value: 'hypothyroid', label: 'Thyroid: hypothyroid (underactive)' },
  hyperthyroid: { value: 'hyperthyroid', label: 'Thyroid: hyperthyroid (overactive)' },
  anaemia: { value: 'anaemia', label: 'Low iron / anaemia' },
  vitaminDB12: { value: 'vitaminDB12', label: 'Vitamin D or B12 deficiency' },
  diabetes: { value: 'diabetes', label: 'Diabetes or prediabetes' },
  highBP: { value: 'highBP', label: 'High blood pressure' },
  cholesterol: { value: 'cholesterol', label: 'High cholesterol or triglycerides' },
  fattyLiver: { value: 'fattyLiver', label: 'Fatty liver' },
  uricAcid: { value: 'uricAcid', label: 'High uric acid / gout' },
  thyroid: { value: 'thyroid', label: 'Thyroid issue' },
  acidityIBS: { value: 'acidityIBS', label: 'Acidity, bloating or IBS' },
  menopause: { value: 'menopause', label: 'Perimenopause / menopause' },
  pregnant: { value: 'pregnant', label: 'Pregnant' },
  breastfeeding: { value: 'breastfeeding', label: 'Breastfeeding' },
  kidney: { value: 'kidney', label: 'Kidney disease' },
  heart: { value: 'heart', label: 'Heart condition' },
};

const FEMALE_CONDITION_ORDER = [
  'pcos',
  'hypothyroid',
  'hyperthyroid',
  'anaemia',
  'vitaminDB12',
  'diabetes',
  'highBP',
  'cholesterol',
  'fattyLiver',
  'acidityIBS',
  'menopause',
  'pregnant',
  'breastfeeding',
  'kidney',
  'heart',
] as const;

const MALE_CONDITION_ORDER = [
  'diabetes',
  'highBP',
  'cholesterol',
  'fattyLiver',
  'uricAcid',
  'thyroid',
  'vitaminDB12',
  'acidityIBS',
  'kidney',
  'heart',
] as const;

/** "Prefer not to say": the female list, then the male-only items. */
const UNSPECIFIED_CONDITION_ORDER = [...FEMALE_CONDITION_ORDER, 'uricAcid', 'thyroid'] as const;

export function conditionChoices(sex: DraftAnswers['sex']): Choice[] {
  const order =
    sex === 'male'
      ? MALE_CONDITION_ORDER
      : sex === 'female'
        ? FEMALE_CONDITION_ORDER
        : UNSPECIFIED_CONDITION_ORDER;
  return order.map((code) => CONDITION_CHOICES[code] as Choice);
}

export const MEDICATION_CHOICES: Choice[] = [
  { value: 'diabetesTablets', label: 'Diabetes tablets (e.g. metformin, glimepiride)' },
  { value: 'insulin', label: 'Insulin' },
  { value: 'thyroid', label: 'Thyroid medicine' },
  { value: 'bp', label: 'Blood pressure medicine' },
  { value: 'cholesterol', label: 'Cholesterol medicine' },
  { value: 'other', label: 'Other regular medicine' },
];

export const RESTRICTION_CHOICES: Choice[] = [
  { value: 'lactose', label: 'Lactose intolerant' },
  { value: 'noDairy', label: 'No dairy at all' },
  { value: 'glutenFree', label: 'Gluten-free' },
  { value: 'peanut', label: 'Peanut allergy' },
  { value: 'treeNut', label: 'Tree-nut allergy' },
  { value: 'soy', label: 'Soy-free' },
  { value: 'noOnionGarlic', label: 'No onion & garlic' },
];

export function restrictionChoices(dietType: DraftAnswers['dietType']): Choice[] {
  return dietType === 'jain'
    ? RESTRICTION_CHOICES.filter((option) => option.value !== 'noOnionGarlic')
    : RESTRICTION_CHOICES;
}

export const MEAT_CHOICES: Choice[] = [
  { value: 'chicken', label: 'Chicken' },
  { value: 'fish', label: 'Fish & seafood' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'mutton', label: 'Mutton' },
  { value: 'pork', label: 'Pork' },
  { value: 'beef', label: 'Beef' },
];

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'goal',
    kind: 'single',
    legend: "What's your goal?",
    options: [
      { value: 'lose', label: 'Lose fat' },
      { value: 'muscle', label: 'Build muscle' },
      { value: 'healthier', label: 'Eat healthier and get fitter' },
      { value: 'gain', label: 'Gain weight' },
    ],
  },
  {
    id: 'sex',
    kind: 'single',
    legend: 'Your sex',
    helper: 'Used to estimate your calorie needs.',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'unspecified', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'age',
    kind: 'number',
    legend: 'How old are you?',
    placeholder: 'Years',
  },
  {
    id: 'height',
    kind: 'height',
    legend: 'How tall are you?',
  },
  {
    id: 'weight',
    kind: 'number',
    legend: 'What do you weigh?',
    placeholder: 'Kilograms',
  },
  {
    id: 'targetWeight',
    kind: 'number',
    legend: 'Do you have a target weight?',
    helper: 'Optional. A realistic pace is about 0.5 kg a week.',
    skippable: true,
    placeholder: 'Kilograms',
    show: (a) => (a.goal === 'lose' || a.goal === 'gain') && (a.age ?? 0) >= 18,
  },
  {
    id: 'conditions',
    kind: 'multi',
    legend: 'Any of these apply to you?',
    helper:
      'Pick all that apply. This only changes food choices and safety notes — and it stays on your phone.',
    optionsFor: (a) => conditionChoices(a.sex),
    noneLabel: 'None of these',
  },
  {
    id: 'diabetesType',
    kind: 'single',
    legend: 'Which type?',
    options: [
      { value: 'pre', label: 'Prediabetes' },
      { value: 'type2', label: 'Type 2' },
      { value: 'type1', label: 'Type 1' },
      { value: 'unsure', label: 'Not sure' },
    ],
    show: (a) => (a.conditions ?? []).includes('diabetes'),
  },
  {
    id: 'medications',
    kind: 'multi',
    legend: 'Do you take any of these regularly?',
    helper:
      'Your plan never changes your medicines. This only adds safety notes. Always follow your doctor.',
    options: MEDICATION_CHOICES,
    noneLabel: 'None',
  },
  {
    id: 'trainingDays',
    kind: 'single',
    legend: 'How often do you train?',
    options: [
      { value: 'none', label: 'Not training right now' },
      { value: '1-2', label: '1–2 days a week' },
      { value: '3-4', label: '3–4 days' },
      { value: '5-6', label: '5–6 days' },
      { value: '7', label: 'Every day' },
    ],
  },
  {
    id: 'trainingType',
    kind: 'multi',
    legend: 'What kind of training?',
    optional: true,
    options: [
      { value: 'gym', label: 'Gym / weights' },
      { value: 'home', label: 'Home workouts' },
      { value: 'cardio', label: 'Running or cycling' },
      { value: 'sports', label: 'Sports' },
      { value: 'yoga', label: 'Yoga or pilates' },
    ],
    show: (a) => !!a.trainingDays && a.trainingDays !== 'none',
  },
  {
    id: 'steps',
    kind: 'single',
    legend: 'Your average daily steps',
    helper:
      'Check your weekly average — on iPhone in the Health or Fitness app, on Android in Google Fit or Samsung Health.',
    options: [
      { value: 'lt3k', label: 'Under 3,000' },
      { value: '3-6k', label: '3,000–6,000' },
      { value: '6-9k', label: '6,000–9,000' },
      { value: '9-12k', label: '9,000–12,000' },
      { value: 'gt12k', label: 'More than 12,000' },
      { value: 'unsure', label: 'Not sure' },
    ],
  },
  {
    id: 'dayType',
    kind: 'single',
    legend: "What's a normal day like?",
    options: [
      { value: 'sitting', label: 'Mostly sitting' },
      { value: 'someWalking', label: 'Some walking' },
      { value: 'onFeet', label: 'On my feet most of the day' },
      { value: 'physical', label: 'Physical work' },
    ],
    show: (a) => a.steps === 'unsure',
  },
  {
    id: 'state',
    kind: 'state',
    legend: 'Where do you live?',
    helper: 'Your plan will use the food you grew up eating.',
  },
  {
    id: 'homeRegion',
    kind: 'state',
    legend: "Which state's food do you cook at home?",
    show: (a) => a.state === 'OUT',
  },
  {
    id: 'cuisineMix',
    kind: 'single',
    legend: 'How should your plan mix food?',
    options: [
      { value: 'mostlyMine', label: "Mostly my region's food" },
      { value: 'mixIn', label: 'Mix in food from other regions' },
    ],
  },
  {
    id: 'dietType',
    kind: 'single',
    legend: 'How do you eat?',
    options: [
      { value: 'veg', label: 'Vegetarian' },
      { value: 'eggetarian', label: 'Eggetarian (veg + eggs)' },
      { value: 'nonveg', label: 'Non-vegetarian' },
      { value: 'vegan', label: 'Vegan' },
      { value: 'jain', label: 'Jain', sublabel: 'No onion, garlic or root vegetables' },
    ],
  },
  {
    id: 'meats',
    kind: 'multi',
    legend: 'Which do you eat?',
    options: MEAT_CHOICES,
    show: (a) => a.dietType === 'nonveg',
  },
  {
    id: 'restrictions',
    kind: 'multi',
    legend: 'Any allergies or things you avoid?',
    helper:
      "Lactose intolerant? Many people still do fine with curd — I'll keep milk out either way.",
    optionsFor: (a) => restrictionChoices(a.dietType),
    noneLabel: 'None',
  },
  {
    id: 'foodSource',
    kind: 'single',
    legend: 'Who makes your food?',
    helper: "If you don't control the menu, I'll show you how to build your plate instead.",
    options: [
      { value: 'self', label: 'I cook for myself' },
      { value: 'family', label: 'Family cooks at home' },
      { value: 'hostel', label: 'Hostel, PG or mess' },
      { value: 'eatOut', label: 'I mostly order or eat out' },
    ],
  },
  {
    id: 'mealPattern',
    kind: 'single',
    legend: 'How do you like to eat?',
    options: [
      { value: '3', label: '3 meals' },
      { value: '3+snacks', label: '3 meals + snacks' },
      { value: '2', label: '2 meals (I skip breakfast)' },
    ],
  },
  {
    id: 'budget',
    kind: 'single',
    legend: 'Your food budget',
    helper: 'Affects things like paneer, nuts, fish and tofu.',
    options: [
      { value: 'cheap', label: 'Keep it cheap' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'flexible', label: 'Flexible' },
    ],
  },
  {
    id: 'supplements',
    kind: 'single',
    legend: 'Supplements?',
    helper: 'You never need supplements for this plan.',
    options: [
      { value: 'foodOnly', label: 'Food only, please' },
      { value: 'open', label: 'Open to it if it helps' },
    ],
  },
  {
    id: 'firstName',
    kind: 'text',
    legend: 'What should I call you?',
    skippable: true,
    placeholder: 'First name',
  },
];

export const QUESTION_IDS = QUESTIONS.map((question) => question.id);

export function questionById(id: string): QuestionDef | undefined {
  return QUESTIONS.find((question) => question.id === id);
}
