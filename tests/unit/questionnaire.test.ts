import { beforeEach, describe, expect, it } from 'vitest';
import { AnswersSchema } from '../../src/lib/engine/schema';
import {
  ftInFromCm,
  heightCmFromFtIn,
  minHealthyWeightKg,
  toEngineAnswers,
  toggleMultiValue,
  visibleSteps,
} from '../../src/lib/questionnaire/flow';
import { conditionChoices, type DraftAnswers } from '../../src/lib/questionnaire/questions';
import {
  DRAFT_KEY,
  GROCERIES_KEY,
  PLAN_KEY,
  readDraft,
  readGroceries,
  readPlan,
  writeDraft,
  writeGroceries,
} from '../../src/lib/storage';
import { PERSONAS } from './personas';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

const base: DraftAnswers = {
  goal: 'lose',
  sex: 'female',
  age: 30,
  heightCm: 160,
  weightKg: 62,
  conditions: [],
  medications: [],
  trainingDays: '3-4',
  trainingType: ['gym'],
  steps: '6-9k',
  state: 'HR',
  cuisineMix: 'mostlyMine',
  dietType: 'veg',
  meats: [],
  restrictions: [],
  foodSource: 'family',
  mealPattern: '3+snacks',
  budget: 'moderate',
  supplements: 'foodOnly',
};

describe('questionnaire branching', () => {
  it('shows target weight only for lose/gain at 18+', () => {
    expect(visibleSteps({ ...base, goal: 'lose', age: 30 })).toContain('targetWeight');
    expect(visibleSteps({ ...base, goal: 'gain', age: 20 })).toContain('targetWeight');
    expect(visibleSteps({ ...base, goal: 'healthier', age: 30 })).not.toContain('targetWeight');
    expect(visibleSteps({ ...base, goal: 'lose', age: 16 })).not.toContain('targetWeight');
  });

  it('shows diabetes type only when diabetes is picked', () => {
    expect(visibleSteps({ ...base, conditions: ['diabetes'] })).toContain('diabetesType');
    expect(visibleSteps({ ...base, conditions: ['pcos'] })).not.toContain('diabetesType');
  });

  it('hides training type when not training', () => {
    expect(visibleSteps({ ...base, trainingDays: 'none' })).not.toContain('trainingType');
    expect(visibleSteps({ ...base, trainingDays: '1-2' })).toContain('trainingType');
  });

  it('shows day type only when steps are unsure', () => {
    expect(visibleSteps({ ...base, steps: 'unsure' })).toContain('dayType');
    expect(visibleSteps({ ...base, steps: '6-9k' })).not.toContain('dayType');
  });

  it('shows home region only when living outside India', () => {
    expect(visibleSteps({ ...base, state: 'OUT' })).toContain('homeRegion');
    expect(visibleSteps({ ...base, state: 'KL' })).not.toContain('homeRegion');
  });

  it('shows meats only for non-vegetarians', () => {
    expect(visibleSteps({ ...base, dietType: 'nonveg', meats: ['chicken'] })).toContain('meats');
    expect(visibleSteps({ ...base, dietType: 'veg' })).not.toContain('meats');
  });
});

describe('"none" exclusivity', () => {
  it('clears the others when none is picked', () => {
    expect(toggleMultiValue(['pcos', 'diabetes'], '')).toEqual([]);
  });

  it('clears none when a real option is picked', () => {
    expect(toggleMultiValue([], 'pcos')).toEqual(['pcos']);
  });

  it('returns undefined when the last real option is unpicked', () => {
    expect(toggleMultiValue(['pcos'], 'pcos')).toBeUndefined();
  });
});

describe('condition options by sex', () => {
  it('offers the female list to women', () => {
    const values = conditionChoices('female').map((option) => option.value);
    expect(values).toContain('pcos');
    expect(values).toContain('pregnant');
    expect(values).not.toContain('uricAcid');
  });

  it('offers the male list to men, in spec order', () => {
    const values = conditionChoices('male').map((option) => option.value);
    expect(values).toContain('uricAcid');
    expect(values).toContain('thyroid');
    expect(values).not.toContain('pcos');
    expect(values[0]).toBe('diabetes');
  });

  it('offers the female list then the male-only items when unspecified', () => {
    const values = conditionChoices(undefined).map((option) => option.value);
    expect(values).toContain('pcos');
    expect(values).toContain('uricAcid');
    expect(values.indexOf('uricAcid')).toBeGreaterThan(values.indexOf('pcos'));
  });
});

describe('height conversion', () => {
  it('converts ft·in to cm and back', () => {
    expect(heightCmFromFtIn(5, 9)).toBe(175.3);
    expect(ftInFromCm(175.3)).toEqual({ feet: 5, inches: 9 });
  });

  it('computes the minimum healthy weight', () => {
    expect(minHealthyWeightKg(165)).toBe(51);
  });
});

describe('toEngineAnswers', () => {
  it('passes AnswersSchema for every persona', () => {
    for (const [name, persona] of Object.entries(PERSONAS)) {
      const result = AnswersSchema.safeParse(toEngineAnswers({ ...persona }));
      expect(result.success, `${name}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('drops answers that belong to hidden steps', () => {
    const answers = toEngineAnswers({
      ...base,
      dietType: 'veg',
      meats: ['chicken'],
      steps: '6-9k',
      dayType: 'sitting',
      state: 'KL',
      homeRegion: 'KL',
      trainingDays: 'none',
      trainingType: ['gym'],
      age: 16,
      targetWeightKg: 45,
    });
    expect(answers.meats).toEqual([]);
    expect(answers.dayType).toBeUndefined();
    expect(answers.homeRegion).toBeUndefined();
    expect(answers.trainingType).toEqual([]);
    expect(answers.targetWeightKg).toBeUndefined();
  });
});

describe('storage', () => {
  it('round-trips a draft', () => {
    writeDraft({ v: 1, answers: { goal: 'lose' }, stepId: 'goal', updatedAt: '2026-01-01' });
    expect(readDraft()?.stepId).toBe('goal');
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(DRAFT_KEY, '{bad');
    expect(readDraft()).toBeNull();
  });

  it('returns null for an unknown version', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ v: 2, answers: {}, stepId: 'goal', updatedAt: '' }),
    );
    expect(readDraft()).toBeNull();
  });

  it('returns null for a corrupt plan', () => {
    localStorage.setItem(PLAN_KEY, '"{bad"');
    expect(readPlan()).toBeNull();
  });

  it('resets grocery ticks when the plan seed changes', () => {
    writeGroceries(10, ['rice']);
    expect(readGroceries(10).checked).toEqual(['rice']);
    expect(readGroceries(11).checked).toEqual([]);
    expect(readGroceries(11).seed).toBe(11);
  });

  it('ignores a stored groceries record for a different version', () => {
    localStorage.setItem(GROCERIES_KEY, JSON.stringify({ v: 3, seed: 1, checked: ['x'] }));
    expect(readGroceries(1).checked).toEqual([]);
  });
});
