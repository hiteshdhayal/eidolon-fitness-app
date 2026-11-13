/**
 * Daily targets (spec §7.2) and the plain-language "How I worked this out"
 * steps shown on the plan page.
 */
import {
  DAY_TYPE_STEPS,
  FAT_LOSS_DEFICIT_PCT,
  FAT_LOSS_DEFICIT_PCT_LEAN,
  FAT_MIN_G_PER_KG,
  FAT_PCT_DEFAULT,
  FAT_PCT_LOWER_CARB,
  FIBER_G_PER_1000_KCAL,
  FIBER_MAX_G,
  FIBER_MIN_G,
  GAIN_SURPLUS_PCT,
  KCAL_FLOOR,
  KCAL_PER_KG_FAT,
  KCAL_ROUND_TO,
  LOWER_CARB_CONDITIONS,
  LOWER_CARB_MAX_PCT,
  MAX_DEFICIT_KCAL,
  MAX_SURPLUS_KCAL,
  MAX_WEEKLY_LOSS_PCT,
  MUSCLE_SURPLUS_KCAL,
  BMI_CUTOFFS,
  PROTEIN_FAT_LOSS_ADD,
  PROTEIN_FLOOR_AGE,
  PROTEIN_G_PER_KG,
  PROTEIN_MAX_G_PER_KG,
  PROTEIN_MIN_G_PER_KG_50_PLUS,
  PROTEIN_ROUND_TO,
  REFERENCE_WEIGHT_BMI,
  SALT_MAX_G,
  STEPS_INCREASE,
  STEPS_MIDPOINT,
  STEPS_TARGET_CAP,
  WATER_ML_PER_KG,
  WATER_ROUND_TO,
  WATER_TRAINING_DAY_EXTRA_ML,
} from './constants';
import { activityFactor, bmi, bmiBand, bmr, roundTo, weightAtBmi } from './numbers';
import type { Answers, SafetyResult, Targets } from './types';

export function isLowerCarb(a: Answers): boolean {
  return a.conditions.some((c) => (LOWER_CARB_CONDITIONS as readonly string[]).includes(c));
}

/** Loss-rate cap: a deficit that would lose ≤ 1% of body weight per week. */
export function maxDeficitForRate(weightKg: number): number {
  return (weightKg * MAX_WEEKLY_LOSS_PCT * KCAL_PER_KG_FAT) / 7;
}

export function proteinPerKg(
  a: Answers,
  effectiveGoal: Answers['goal'],
  inDeficit: boolean,
): number {
  let g: number;
  if (a.trainingDays === '5-6' || a.trainingDays === '7' || effectiveGoal === 'muscle')
    g = PROTEIN_G_PER_KG.high;
  else if (a.trainingDays === '3-4') g = PROTEIN_G_PER_KG['3-4'];
  else if (a.trainingDays === '1-2') g = PROTEIN_G_PER_KG['1-2'];
  else g = PROTEIN_G_PER_KG.none;
  if (inDeficit) g += PROTEIN_FAT_LOSS_ADD;
  g = Math.min(g, PROTEIN_MAX_G_PER_KG);
  if (a.age >= PROTEIN_FLOOR_AGE) g = Math.max(g, PROTEIN_MIN_G_PER_KG_50_PLUS);
  return Math.round(g * 100) / 100;
}

export function stepsTarget(a: Answers): number {
  const current =
    a.steps === 'unsure' ? DAY_TYPE_STEPS[a.dayType ?? 'sitting'] : STEPS_MIDPOINT[a.steps];
  const target = Math.min(current + STEPS_INCREASE, STEPS_TARGET_CAP);
  return Math.max(target, current);
}

export function computeTargets(a: Answers, safety: SafetyResult): Targets {
  const goal = safety.effectiveGoal;
  const currentBmi = bmi(a.weightKg, a.heightCm);
  const band = bmiBand(currentBmi);
  const restKcal = bmr(a);
  const af = activityFactor(a);
  const maintenance = restKcal * af;

  // ---- goal adjustment -------------------------------------------------
  let adjustment = 0;
  if (goal === 'lose') {
    const pct = Math.min(
      currentBmi < BMI_CUTOFFS.healthy ? FAT_LOSS_DEFICIT_PCT_LEAN : FAT_LOSS_DEFICIT_PCT,
      safety.maxDeficitPct,
    );
    adjustment = -Math.min(pct * maintenance, MAX_DEFICIT_KCAL, maxDeficitForRate(a.weightKg));
  } else if (goal === 'muscle') {
    adjustment = currentBmi < BMI_CUTOFFS.healthy ? MUSCLE_SURPLUS_KCAL : 0;
  } else if (goal === 'gain') {
    adjustment = Math.min(GAIN_SURPLUS_PCT * maintenance, MAX_SURPLUS_KCAL);
  }

  // ---- floor and rounding ----------------------------------------------
  const floor = Math.max(restKcal, KCAL_FLOOR[a.sex]);
  let kcal = Math.max(maintenance + adjustment, floor);
  kcal = roundTo(kcal, KCAL_ROUND_TO);
  if (kcal < floor) kcal += KCAL_ROUND_TO; // rounding must not dip under the floor
  const actualAdjustment = Math.round(kcal - maintenance);
  const inDeficit = goal === 'lose' && actualAdjustment < 0;

  // ---- protein ---------------------------------------------------------
  const referenceWeightKg =
    currentBmi > REFERENCE_WEIGHT_BMI ? weightAtBmi(REFERENCE_WEIGHT_BMI, a.heightCm) : a.weightKg;
  const gPerKg = proteinPerKg(a, goal, inDeficit);
  const protein = roundTo(referenceWeightKg * gPerKg, PROTEIN_ROUND_TO);

  // ---- fat and carbs ---------------------------------------------------
  const lowerCarb = isLowerCarb(a);
  const proteinKcal = protein * 4;
  let fatPct = lowerCarb ? FAT_PCT_LOWER_CARB : FAT_PCT_DEFAULT;
  let fat = Math.max((kcal * fatPct) / 9, FAT_MIN_G_PER_KG * referenceWeightKg);
  let carbs = (kcal - proteinKcal - fat * 9) / 4;
  if (lowerCarb && (carbs * 4) / kcal > LOWER_CARB_MAX_PCT) {
    // The ≤ 45% carb rule wins: carbs sit at 45% and fat takes the rest.
    // Fat only passes FAT_PCT_MAX_LOWER_CARB when protein is low; that's logged
    // in docs/DECISIONS.md as the trade-off.
    carbs = Math.floor((kcal * LOWER_CARB_MAX_PCT) / 4);
    fat = (kcal - proteinKcal - carbs * 4) / 9;
  }
  fat = Math.round(fat);
  carbs = Math.max(
    0,
    lowerCarb
      ? Math.min(Math.round(carbs), Math.floor((kcal * LOWER_CARB_MAX_PCT) / 4))
      : Math.round(carbs),
  );
  fatPct = (fat * 9) / kcal;
  const carbPct = Math.round(((carbs * 4) / kcal) * 100);

  // ---- the rest --------------------------------------------------------
  const fiber = Math.round(
    Math.min(FIBER_MAX_G, Math.max(FIBER_MIN_G, (kcal / 1000) * FIBER_G_PER_1000_KCAL)),
  );
  const waterMl = roundTo(a.weightKg * WATER_ML_PER_KG, WATER_ROUND_TO);
  const training = a.trainingDays !== 'none';
  const steps = stepsTarget(a);

  const t: Targets = {
    bmi: Math.round(currentBmi * 10) / 10,
    bmiBand: band,
    bmr: Math.round(restKcal),
    activityFactor: af,
    tdee: Math.round(maintenance),
    goalAdjustmentKcal: actualAdjustment,
    kcal,
    protein,
    proteinPerKg: gPerKg,
    referenceWeightKg: Math.round(referenceWeightKg * 10) / 10,
    fat,
    carbs,
    carbPct,
    fiber,
    waterMl,
    waterMlTrainingDay: training ? waterMl + WATER_TRAINING_DAY_EXTRA_ML : waterMl,
    saltG: SALT_MAX_G,
    stepsTarget: steps,
    lowerCarb,
    proteinRequested: protein,
    proteinLowered: false,
    explain: [],
  };
  t.explain = explainTargets(a, safety, t, Math.round(fatPct * 100));
  return t;
}

const fmt = (n: number) => n.toLocaleString('en-IN');

export function explainTargets(
  a: Answers,
  safety: SafetyResult,
  t: Targets,
  fatPctWhole: number,
): Targets['explain'] {
  const steps: Targets['explain'] = [];
  steps.push({
    title: 'Your body at rest',
    text: `At rest, your body uses about ${fmt(t.bmr)} kcal a day. I worked this out from your age, height and weight with the Mifflin-St Jeor formula, the one dietitians use most.`,
  });
  steps.push({
    title: 'Your activity',
    text: `Your daily steps and training give an activity factor of ${t.activityFactor}. So on a normal day you use about ${fmt(t.tdee)} kcal.`,
  });

  const adj = t.goalAdjustmentKcal;
  let goalText: string;
  if (safety.effectiveGoal === 'lose' && adj < 0) {
    const kgWeek = Math.round(((-adj * 7) / KCAL_PER_KG_FAT) * 10) / 10;
    goalText = `To lose fat steadily, I took off ${fmt(-adj)} kcal a day. That's about ${kgWeek} kg a week — slow enough to keep your muscle and stick with it.`;
    if (safety.mode === 'gentle')
      goalText += ' I kept the cut small because of your health answers.';
  } else if (safety.effectiveGoal === 'muscle' && adj > 0) {
    goalText = `To build muscle, I added ${fmt(adj)} kcal a day on top of what you use. Pair it with the protein below and steady training.`;
  } else if (safety.effectiveGoal === 'muscle') {
    goalText =
      "You're building muscle at your current weight, so calories stay at maintenance. Protein and training do the work.";
  } else if (safety.effectiveGoal === 'gain' && adj > 0) {
    goalText = `To gain weight steadily, I added ${fmt(adj)} kcal a day.`;
  } else {
    goalText =
      'Calories stay at maintenance, so your weight should hold steady while your food quality goes up.';
  }
  if (safety.goalChanged) goalText = `${SAFETY_MESSAGES_LOW_BMI} ${goalText}`;
  steps.push({ title: 'Your goal', text: `${goalText} Your target is ${fmt(t.kcal)} kcal a day.` });

  const refNote =
    t.referenceWeightKg < a.weightKg
      ? ` (the weight at a BMI of 25 for your height, which is the right base for protein)`
      : '';
  steps.push({
    title: 'Why protein is set here',
    text: `${t.protein} g a day: ${t.proteinPerKg} g for each kg of ${t.referenceWeightKg} kg${refNote}. Protein keeps you full and protects your muscle${safety.effectiveGoal === 'lose' ? ' while you lose fat' : ''}. Dal, curd, paneer, chana and eggs get you there without shakes.`,
  });

  let carbText = `Fat is about ${fatPctWhole}% of your calories (${t.fat} g), and carbs fill the rest (${t.carbs} g).`;
  if (t.lowerCarb)
    carbText +=
      ' Because of your health answers, I kept carbs at or under 45% and picked lower-GI grains like millets, whole wheat and oats.';
  steps.push({ title: 'Carbs and fat', text: carbText });

  steps.push({
    title: 'Water, salt and steps',
    text: `Aim for about ${(t.waterMl / 1000).toFixed(1)} litres of water a day${t.waterMlTrainingDay > t.waterMl ? ` (${(t.waterMlTrainingDay / 1000).toFixed(1)} on training days)` : ''}, under ${t.saltG} g of salt, and ${fmt(t.stepsTarget)} steps.${a.conditions.includes('highBP') ? ' With high BP, the salt limit matters most: go easy on pickles, papad and namkeen.' : ''}`,
  });
  return steps;
}

const SAFETY_MESSAGES_LOW_BMI =
  "Your weight is already below the healthy range for your height, so this plan doesn't cut calories.";
