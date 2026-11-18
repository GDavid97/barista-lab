import { describe, expect, it } from 'vitest';
import { drinkById } from '../data/drinks';
import { grinderById } from '../data/grinders';
import type { BrewRating } from '../db/schema';
import { simulate } from '../engine';
import { stateForDrink } from '../pages/useBrewSetup';
import { buildInput } from './calibration';
import { applyPatch, dialInAdvice } from './dialIn';
import { makeBrewRecord } from './journal';

const comandante = grinderById('comandante-c40')!.scale; // 30 µm / click

function rated(drink: string, rating: Partial<BrewRating>) {
  const setup = stateForDrink(drinkById(drink)!);
  const b = makeBrewRecord({ id: 'x', now: 1, setup, result: simulate(buildInput(setup, 'conical')), grindLabel: '', burr: 'conical' });
  return { ...b, rating: { stars: 3, sourBitter: 0, weakStrong: 0, notes: '', ...rating } };
}

describe('dialInAdvice', () => {
  it('asks for a rating first', () => {
    const b = rated('espresso', {});
    expect(dialInAdvice({ ...b, rating: undefined }, comandante).verdict).toBe('unrated');
  });

  it('keeps a balanced, right-strength recipe', () => {
    expect(dialInAdvice(rated('espresso', { stars: 5 }), comandante).verdict).toBe('keep');
  });

  it('sour espresso → grind finer on the dial, warmer, longer ratio', () => {
    const b = rated('espresso', { sourBitter: -1 });
    const a = dialInAdvice(b, comandante);
    expect(a.primary?.key).toBe('grindFiner');
    expect(Number(a.primary!.params.steps)).toBeGreaterThanOrEqual(1);
    expect(a.primary!.patch.particleUm!).toBeLessThan(b.setup.particleUm);
    const keys = a.alternatives.map((x) => x.key);
    expect(keys).toContain('tempUp');
    expect(keys).toContain('longerRatio');
    // Applying the grind change really raises the predicted EY by about one point.
    const before = simulate(buildInput(b.setup, 'conical')).ey;
    const after = simulate(buildInput(applyPatch(b.setup, a.primary!.patch), 'conical')).ey;
    expect(after - before).toBeGreaterThan(0.4);
    expect(after - before).toBeLessThan(2);
  });

  it('very bitter → more clicks coarser than a bit bitter', () => {
    const grindOf = (sb: number) => {
      const a = dialInAdvice(rated('espresso', { sourBitter: sb }), comandante);
      return [a.primary!, ...a.alternatives].find((x) => x.key === 'grindCoarser')!;
    };
    expect(dialInAdvice(rated('espresso', { sourBitter: 1 }), comandante).primary?.key).toBe('grindCoarser');
    expect(Number(grindOf(2).params.steps)).toBeGreaterThanOrEqual(Number(grindOf(1).params.steps));
  });

  it('weak V60 → more coffee; strong espresso → more yield', () => {
    expect(dialInAdvice(rated('v60', { weakStrong: -1 }), comandante).primary).toMatchObject({ key: 'moreDose' });
    expect(dialInAdvice(rated('espresso', { weakStrong: 1 }), comandante).primary).toMatchObject({ key: 'moreYield' });
  });

  it('sour but an already slow shot → do not grind finer first', () => {
    const b = rated('espresso', { sourBitter: -1 });
    const slow = { ...b, setup: { ...b.setup, particleUm: 255 } }; // ~33 s predicted
    const a = dialInAdvice(slow, comandante);
    expect(a.primary?.key).not.toBe('grindFiner');
    expect(a.alternatives.map((x) => x.key)).toContain('grindFiner');
  });

  it('without a dial scale it speaks in microns', () => {
    const a = dialInAdvice(rated('v60', { sourBitter: -2 }), undefined);
    expect(a.primary?.key).toBe('grindFinerUm');
    expect(Number(a.primary!.params.um)).toBeLessThan(650);
  });
});
