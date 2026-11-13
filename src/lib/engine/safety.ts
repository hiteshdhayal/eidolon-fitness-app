/**
 * Safety gate (spec §7.1). Runs before anything else and decides the mode:
 *   guidance – no numbers at all (under 18, pregnant, kidney disease)
 *   gentle   – numbers, but small or no deficit plus a consult note
 *   full     – the normal plan
 */
import {
  ADULT_AGE,
  FAT_LOSS_DEFICIT_PCT,
  GENTLE_MAX_DEFICIT_PCT,
  MIN_TARGET_BMI,
  OLDER_ADULT_AGE,
} from './constants';
import { bmi, weightAtBmi } from './numbers';
import type { Answers, Goal, Mode, SafetyResult } from './types';

export const SAFETY_MESSAGES = {
  teen: 'Plans with calorie numbers are for adults, so here are balanced meal ideas from your region instead. Talk to a parent or doctor before trying to change your weight.',
  pregnant:
    'During pregnancy I only share general healthy-eating ideas, with no calorie cut. Your gynaecologist or a registered dietitian should set your targets.',
  kidney:
    'With kidney disease, protein, potassium and phosphorus need to be set for you by a doctor. Please see your doctor or a kidney (renal) dietitian before changing your diet.',
  breastfeeding:
    "While you're breastfeeding, this plan stays at maintenance calories, with no deficit. Check with your doctor before trying to change your weight.",
  diabetesMeds:
    'Some diabetes medicines (like insulin or glimepiride) can cause low sugar when you eat less. Talk to your doctor before cutting calories.',
  heart:
    'With a heart condition, I keep any calorie cut small (10% at most). Please go through this plan with your doctor.',
  olderAdult:
    'At 65 and above, I keep any calorie cut small (10% at most). Check with your doctor before changing how you eat.',
  lowBmiLose:
    "Your weight is already below the healthy range for your height, so I've set this plan to eat healthier and get fitter instead of losing weight. If your weight worries you, a doctor can help.",
  targetTooLow: (kg: number) =>
    `That's below a healthy weight for your height. Let's aim for ${kg} kg or above.`,
} as const;

export function runSafetyGate(a: Answers): SafetyResult {
  const reasons: SafetyResult['reasons'] = [];
  const has = (c: Answers['conditions'][number]) => a.conditions.includes(c);

  // ---- guidance mode ---------------------------------------------------
  const guidance: string[] = [];
  if (a.age < ADULT_AGE) guidance.push('teen');
  if (has('pregnant')) guidance.push('pregnant');
  if (has('kidney')) guidance.push('kidney');
  for (const code of guidance)
    reasons.push({ code, message: SAFETY_MESSAGES[code as 'teen' | 'pregnant' | 'kidney'] });

  // ---- gentle mode -----------------------------------------------------
  const gentle: string[] = [];
  if (has('breastfeeding')) gentle.push('breastfeeding');
  const onDiabetesMeds =
    a.medications.includes('insulin') || a.medications.includes('diabetesTablets');
  if (a.diabetesType === 'type1' || onDiabetesMeds) gentle.push('diabetesMeds');
  if (has('heart')) gentle.push('heart');
  if (a.age >= OLDER_ADULT_AGE) gentle.push('olderAdult');
  if (guidance.length === 0) {
    for (const code of gentle) {
      reasons.push({
        code,
        message: SAFETY_MESSAGES[code as 'breastfeeding' | 'diabetesMeds' | 'heart' | 'olderAdult'],
      });
    }
  }

  const mode: Mode = guidance.length > 0 ? 'guidance' : gentle.length > 0 ? 'gentle' : 'full';

  // ---- rules in every mode ---------------------------------------------
  const currentBmi = bmi(a.weightKg, a.heightCm);
  let effectiveGoal: Goal = a.goal;
  let goalChanged = false;
  if (currentBmi < MIN_TARGET_BMI && a.goal === 'lose') {
    effectiveGoal = 'healthier';
    goalChanged = true;
    reasons.push({ code: 'lowBmiLose', message: SAFETY_MESSAGES.lowBmiLose });
  }

  const minHealthyWeightKg = Math.ceil(weightAtBmi(MIN_TARGET_BMI, a.heightCm));
  let targetWeightRejected = false;
  if (a.targetWeightKg !== undefined && bmi(a.targetWeightKg, a.heightCm) < MIN_TARGET_BMI) {
    targetWeightRejected = true;
    // Guidance mode shows no weight numbers at all, so no "aim for X kg" either.
    if (mode !== 'guidance') {
      reasons.push({
        code: 'targetTooLow',
        message: SAFETY_MESSAGES.targetTooLow(minHealthyWeightKg),
      });
    }
  }

  // Largest deficit allowed as a fraction of TDEE.
  let maxDeficitPct = FAT_LOSS_DEFICIT_PCT;
  if (mode === 'guidance' || gentle.includes('breastfeeding')) maxDeficitPct = 0;
  else if (mode === 'gentle') maxDeficitPct = GENTLE_MAX_DEFICIT_PCT;

  return {
    mode,
    reasons,
    maxDeficitPct,
    effectiveGoal,
    goalChanged,
    targetWeightRejected,
    minHealthyWeightKg,
    spreadCarbsEvenly: gentle.includes('diabetesMeds'),
    showProteinTarget: mode !== 'guidance',
    showNumbers: mode !== 'guidance',
  };
}
