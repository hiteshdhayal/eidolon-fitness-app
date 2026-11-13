import { describe, expect, it } from 'vitest';
import { FOODS } from '../../src/data/foods/index';
import { buildContext, checkFood } from '../../src/lib/engine/filter';
import { AnswersSchema } from '../../src/lib/engine/schema';
import { make } from './personas';

const allowed = (o: Parameters<typeof make>[0]) =>
  buildContext(AnswersSchema.parse(make(o)), FOODS).allowed;

describe('diet filters', () => {
  it('Jain: no onion, garlic or root veg unless the cook can leave it out (with a note)', () => {
    const a = AnswersSchema.parse(make({ dietType: 'jain' }));
    for (const f of buildContext(a, FOODS).allowed) {
      expect(f.diet.veg).toBe(true);
      if (f.contains.onionGarlic) expect(f.canSkip).toContain('onionGarlic');
      if (f.contains.rootVeg) expect(f.canSkip).toContain('rootVeg');
      if (f.contains.onionGarlic)
        expect(checkFood(f, a)).toContain('Jain-style: leave out onion and garlic.');
    }
    const ids = buildContext(a, FOODS).allowed.map((f) => f.id);
    expect(ids).not.toContain('aloo-gobhi'); // potato can't be left out of aloo gobhi
    expect(ids).not.toContain('sabudana-khichdi');
    expect(ids).not.toContain('undhiyu');
  });
  it('lactose intolerant: no milk, but curd stays with a note', () => {
    const a = AnswersSchema.parse(make({ restrictions: ['lactose'] }));
    const ids = buildContext(a, FOODS).allowed.map((f) => f.id);
    expect(ids).not.toContain('milk');
    expect(ids).not.toContain('overnight-oats');
    expect(ids).toContain('curd');
    expect(
      checkFood(
        FOODS.find((f) => f.id === 'curd')!,
        a,
      )?.join(' '),
    ).toMatch(/usually fine/);
  });
  it('no dairy at all: no curd, paneer, ghee dishes', () => {
    for (const f of allowed({ restrictions: ['noDairy'] })) expect(f.contains.dairy).toBe(false);
  });
  it('vegan: no dairy, eggs or honey', () => {
    for (const f of allowed({ dietType: 'vegan' })) {
      expect(f.contains.dairy || f.contains.egg || f.contains.honey).toBe(false);
    }
  });
  it('non-veg: only the meats picked', () => {
    const list = allowed({ dietType: 'nonveg', meats: ['fish'] });
    expect(list.some((f) => f.contains.fish)).toBe(true);
    for (const f of list) {
      expect(
        f.contains.chicken ||
          f.contains.mutton ||
          f.contains.pork ||
          f.contains.beef ||
          f.contains.egg,
      ).toBe(false);
    }
  });
  it('eggetarian: eggs yes, meat and fish no', () => {
    const list = allowed({ dietType: 'eggetarian' });
    expect(list.some((f) => f.contains.egg)).toBe(true);
    for (const f of list)
      expect(f.contains.chicken || f.contains.fish || f.contains.mutton).toBe(false);
  });
  it('allergies: gluten, peanut, tree nut and soy are removed', () => {
    for (const f of allowed({ restrictions: ['glutenFree', 'peanut', 'treeNut', 'soy'] })) {
      expect(f.contains.gluten || f.contains.peanut || f.contains.treeNut || f.contains.soy).toBe(
        false,
      );
    }
  });
  it('high uric acid: no red meat or shellfish', () => {
    for (const f of allowed({
      dietType: 'nonveg',
      meats: ['chicken', 'fish', 'mutton', 'pork'],
      conditions: ['uricAcid'],
    })) {
      expect(f.contains.mutton || f.contains.pork || f.contains.shellfish).toBe(false);
    }
  });
  it('cheap budget: nothing at budget level 3', () => {
    for (const f of allowed({ budget: 'cheap' })) expect(f.budget).toBeLessThanOrEqual(2);
  });
});
