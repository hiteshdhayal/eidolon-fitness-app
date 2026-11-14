/**
 * Questionnaire flow (Part C): branching, completeness, validation and the
 * mapping to engine answers. No storage or engine imports beyond the tiny
 * constant lists in engine/schema.
 */
import { CONDITIONS, FEMALE_CONDITIONS, MALE_CONDITIONS } from '../engine/schema';
import { STATES } from '../engine/regions';
import type { AnswersInput, Condition } from '../engine/types';
import { QUESTIONS, questionById, type DraftAnswers, type QuestionDef } from './questions';

export const INTRO = 'intro';
export const REVIEW = 'review';

export const AGE_MIN = 13;
export const AGE_MAX = 90;
export const HEIGHT_MIN_CM = 120;
export const HEIGHT_MAX_CM = 220;
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 250;

export const AGE_ERROR = 'Enter an age between 13 and 90.';
export const HEIGHT_ERROR = 'Enter a height between 4 ft 0 in and 7 ft 2 in (120–220 cm).';
export const WEIGHT_ERROR = 'Enter a weight between 30 and 250 kg.';

/** Visible question steps, in order, after branching. */
export function visibleSteps(answers: DraftAnswers): string[] {
  return QUESTIONS.filter((question) => !question.show || question.show(answers)).map(
    (question) => question.id,
  );
}

/**
 * Override the draft's weight from a `weight` query param (Part F1, "Update my
 * plan"). Only a valid 30–250 kg number is applied; anything else leaves the
 * draft exactly as it was.
 */
export function applyWeightParam(draft: DraftAnswers, params: URLSearchParams): DraftAnswers {
  const raw = params.get('weight');
  if (raw === null || raw.trim() === '') return draft;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < WEIGHT_MIN_KG || value > WEIGHT_MAX_KG) return draft;
  return { ...draft, weightKg: Math.round(value * 10) / 10 };
}

export function isFinalQuestion(id: string): boolean {
  return id === QUESTIONS[QUESTIONS.length - 1]?.id;
}

export function heightCmFromFtIn(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

/** Round-trip a stored height (cm) back to whole feet and inches for the input. */
export function ftInFromCm(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

/** Minimum healthy weight for a height (BMI 18.5), rounded up to a whole kg. */
export function minHealthyWeightKg(heightCm: number): number {
  return Math.ceil(18.5 * (heightCm / 100) ** 2);
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isAgeComplete(age: unknown): boolean {
  return isValidNumber(age) && Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX;
}

export function isWeightComplete(weight: unknown): boolean {
  return isValidNumber(weight) && weight >= WEIGHT_MIN_KG && weight <= WEIGHT_MAX_KG;
}

export function isHeightComplete(answers: DraftAnswers): boolean {
  const cm = answers.heightCm;
  if (!isValidNumber(cm)) return false;
  if (cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM) return false;
  if (answers.heightUnit === 'ftin') {
    const { feet, inches } = ftInFromCm(cm);
    if (feet < 3 || feet > 7 || inches < 0 || inches > 11) return false;
  }
  return true;
}

export function isStepComplete(id: string, answers: DraftAnswers): boolean {
  switch (id) {
    case 'age':
      return isAgeComplete(answers.age);
    case 'height':
      return isHeightComplete(answers);
    case 'weight':
      return isWeightComplete(answers.weightKg);
    case 'targetWeight':
      return answers.targetWeightKg === undefined || isWeightComplete(answers.targetWeightKg);
    case 'conditions':
      return Array.isArray(answers.conditions);
    case 'diabetesType':
      return typeof answers.diabetesType === 'string';
    case 'medications':
      return Array.isArray(answers.medications);
    case 'trainingType':
      return true;
    case 'meats':
      return Array.isArray(answers.meats) && answers.meats.length > 0;
    case 'restrictions':
      return Array.isArray(answers.restrictions);
    case 'firstName':
      return true;
    default: {
      const value = (answers as Record<string, unknown>)[id];
      return value !== undefined && value !== null && value !== '';
    }
  }
}

/**
 * Multi-select toggle with an exclusive "none" (value ""): picking none
 * clears the others; picking any other clears none; clearing the last real
 * option leaves the step unanswered (undefined).
 */
export function toggleMultiValue(
  current: string[] | undefined,
  value: string,
): string[] | undefined {
  if (value === '') return [];
  const withoutNone = (current ?? []).filter((item) => item !== '');
  const next = withoutNone.includes(value)
    ? withoutNone.filter((item) => item !== value)
    : [...withoutNone, value];
  return next.length ? next : undefined;
}

/** First error message for a step, or null when it's fine (or incomplete). */
export function validate(id: string, answers: DraftAnswers): string | null {
  switch (id) {
    case 'age':
      if (answers.age === undefined) return null;
      return isAgeComplete(answers.age) ? null : AGE_ERROR;
    case 'height':
      if (answers.heightCm === undefined) return null;
      return isHeightComplete(answers) ? null : HEIGHT_ERROR;
    case 'weight':
      if (answers.weightKg === undefined) return null;
      return isWeightComplete(answers.weightKg) ? null : WEIGHT_ERROR;
    case 'targetWeight':
      if (answers.targetWeightKg === undefined) return null;
      return isWeightComplete(answers.targetWeightKg) ? null : WEIGHT_ERROR;
    default:
      return null;
  }
}

function allowedConditions(sex: DraftAnswers['sex'], conditions: string[]): Condition[] {
  const allowed: readonly string[] =
    sex === 'male' ? MALE_CONDITIONS : sex === 'female' ? FEMALE_CONDITIONS : CONDITIONS;
  return conditions.filter((condition): condition is Condition => allowed.includes(condition));
}

/**
 * Draft → engine answers. Hidden-step answers are dropped, "none" is an empty
 * array, and the object must pass AnswersSchema.parse (Part C).
 */
export function toEngineAnswers(answers: DraftAnswers): AnswersInput {
  const linked = answers.dietType === 'nonveg';
  const restrictions = (answers.restrictions ?? []).filter(
    (restriction) => !(answers.dietType === 'jain' && restriction === 'noOnionGarlic'),
  );

  return {
    goal: answers.goal as AnswersInput['goal'],
    sex: answers.sex as AnswersInput['sex'],
    age: answers.age as number,
    heightCm: answers.heightCm as number,
    heightUnit: answers.heightUnit,
    weightKg: answers.weightKg as number,
    targetWeightKg:
      (answers.goal === 'lose' || answers.goal === 'gain') && (answers.age ?? 0) >= 18
        ? answers.targetWeightKg
        : undefined,
    conditions: allowedConditions(answers.sex, answers.conditions ?? []),
    diabetesType: (answers.conditions ?? []).includes('diabetes')
      ? answers.diabetesType
      : undefined,
    medications: answers.medications ?? [],
    trainingDays: answers.trainingDays as AnswersInput['trainingDays'],
    trainingType:
      answers.trainingDays && answers.trainingDays !== 'none' ? (answers.trainingType ?? []) : [],
    steps: answers.steps as AnswersInput['steps'],
    dayType: answers.steps === 'unsure' ? answers.dayType : undefined,
    state: answers.state as AnswersInput['state'],
    homeRegion: answers.state === 'OUT' ? answers.homeRegion : undefined,
    cuisineMix: answers.cuisineMix as AnswersInput['cuisineMix'],
    dietType: answers.dietType as AnswersInput['dietType'],
    meats: linked ? (answers.meats ?? []) : [],
    restrictions,
    foodSource: answers.foodSource as AnswersInput['foodSource'],
    mealPattern: answers.mealPattern as AnswersInput['mealPattern'],
    budget: answers.budget as AnswersInput['budget'],
    supplements: answers.supplements ?? 'foodOnly',
    firstName: answers.firstName?.trim() ? answers.firstName.trim() : undefined,
  };
}

function labelFor(question: QuestionDef, value: unknown, answers: DraftAnswers): string {
  const options = question.optionsFor?.(answers) ?? question.options ?? [];
  const match = options.find((option) => option.value === value);
  return match ? match.label : String(value);
}

function listLabel(id: string, values: string[], answers: DraftAnswers, noneLabel: string): string {
  if (values.length === 0) return noneLabel;
  const question = questionById(id);
  const options = question?.optionsFor?.(answers) ?? question?.options ?? [];
  return values
    .map((value) => options.find((option) => option.value === value)?.label ?? value)
    .join(', ');
}

/** Plain-word summary of an answered step, for the review screen. */
export function describeAnswer(id: string, answers: DraftAnswers): string {
  const question = questionById(id);
  const value = (answers as Record<string, unknown>)[id];

  switch (id) {
    case 'age':
      return `${answers.age} years`;
    case 'height': {
      const cm = answers.heightCm ?? 0;
      if (answers.heightUnit === 'cm') return `${cm} cm`;
      const { feet, inches } = ftInFromCm(cm);
      return `${feet} ft ${inches} in`;
    }
    case 'weight':
      return `${answers.weightKg} kg`;
    case 'targetWeight':
      return answers.targetWeightKg === undefined ? 'Skipped' : `${answers.targetWeightKg} kg`;
    case 'firstName':
      return answers.firstName?.trim() ? answers.firstName.trim() : 'Skipped';
    case 'state':
      return answers.state === 'OUT'
        ? 'Outside India'
        : (STATES.find((state) => state.code === answers.state)?.name ?? '—');
    case 'homeRegion':
      return STATES.find((state) => state.code === answers.homeRegion)?.name ?? '—';
    case 'conditions':
      return listLabel('conditions', answers.conditions ?? [], answers, 'None of these');
    case 'medications':
      return listLabel('medications', answers.medications ?? [], answers, 'None');
    case 'restrictions':
      return listLabel('restrictions', answers.restrictions ?? [], answers, 'None');
    case 'meats':
      return listLabel('meats', answers.meats ?? [], answers, '—');
    case 'trainingType':
      return listLabel('trainingType', answers.trainingType ?? [], answers, '—');
    default:
      return question ? labelFor(question, value, answers) : '—';
  }
}
