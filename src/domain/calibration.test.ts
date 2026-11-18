import { describe, expect, it } from 'vitest';
import { drinkById } from '../data/drinks';
import type { UserBrew } from '../db/schema';
import { simulate } from '../engine';
import { stateForDrink, type SimState } from '../pages/useBrewSetup';
import { buildInput, calibrationFrom, fitGrindFactor, NO_CALIBRATION } from './calibration';
import { makeBrewRecord } from './journal';

const KEY = 'user:g1';
const espresso = (particleUm: number): SimState => ({ ...stateForDrink(drinkById('espresso')!), particleUm });

/** The "real world": this grinder actually grinds 15 % coarser than its scale says. */
const TRUE_FACTOR = 1.15;
const realTime = (s: SimState) => simulate(buildInput(s, 'conical', { ...NO_CALIBRATION, grindFactor: TRUE_FACTOR })).timeS;

let clock = 1;
function brew(s: SimState, measured: UserBrew['measured']): UserBrew {
  const r = makeBrewRecord({ id: `b${clock}`, now: clock++, setup: s, result: simulate(buildInput(s, 'conical')), grindLabel: '', grinderKey: KEY, burr: 'conical' });
  return { ...r, measured };
}
const opts = { keyOf: (b: UserBrew) => b.grinderKey ?? '' };

describe('fitGrindFactor', () => {
  it('recovers the factor that explains a measured time', () => {
    const s = espresso(300);
    expect(fitGrindFactor(s, 'conical', realTime(s))).toBeCloseTo(TRUE_FACTOR, 2);
  });
});

describe('calibrationFrom', () => {
  it('without data there is no correction', () => {
    const c = calibrationFrom([], KEY, opts);
    expect(c.grindFactor).toBe(1);
    expect(c.extractionScale).toBe(1);
    expect(c.confidence).toBe(0);
  });

  it('a single measurement moves the factor only part of the way', () => {
    const s = espresso(300);
    const c = calibrationFrom([brew(s, { timeS: realTime(s) })], KEY, opts);
    expect(c.grindFactor).toBeGreaterThan(1);
    expect(c.grindFactor).toBeLessThan(TRUE_FACTOR);
    expect(c.nTime).toBe(1);
  });

  it('ignores other grinders, untimed methods and brews before a reset', () => {
    const s = espresso(300);
    const other = { ...brew(s, { timeS: 60 }), grinderKey: 'user:other' };
    const moka = { ...brew({ ...stateForDrink(drinkById('moka')!) }, { timeS: 200 }), method: 'moka' as const };
    const old = brew(s, { timeS: 60 });
    const c = calibrationFrom([other, moka, old], KEY, { ...opts, resetAt: old.createdAt });
    expect(c.nTime).toBe(0);
  });

  it('learns an extraction correction from refractometer readings', () => {
    const s = espresso(300);
    const predicted = simulate(buildInput(s, 'conical')).ey;
    // Measured EY 10 % higher than predicted: TDS × 36 g / 18 g.
    const tds = ((predicted * 1.1) * 18) / 36;
    const brews = [1, 2, 3, 4].map(() => brew(s, { tds, beverageG: 36 }));
    const c = calibrationFrom(brews, KEY, opts);
    expect(c.extractionScale).toBeGreaterThan(1.04);
    expect(c.extractionScale).toBeLessThan(1.1);
  });

  it('phase-7 acceptance: after 3–5 timed brews the predicted shot time gets measurably closer', () => {
    // Different dial settings and doses so the fit is not tied to one recipe.
    const history = [
      espresso(290),
      { ...espresso(320), brew: { ...espresso(320).brew, doseG: 17 } },
      espresso(305),
      { ...espresso(280), brew: { ...espresso(280).brew, waterG: 40 } },
      espresso(310),
    ];
    // Small "measurement noise" of ±1 s.
    const brews = history.map((s, i) => brew(s, { timeS: realTime(s) + (i % 2 ? 1 : -1) }));

    const next = espresso(300);
    const truth = realTime(next);
    const errBefore = Math.abs(simulate(buildInput(next, 'conical')).timeS - truth);

    for (const n of [3, 4, 5]) {
      const cal = calibrationFrom(brews.slice(0, n), KEY, opts);
      const errAfter = Math.abs(simulate(buildInput(next, 'conical', cal)).timeS - truth);
      expect(errAfter, `after ${n} brews`).toBeLessThan(errBefore * 0.5);
    }
    // Confidence grows and narrows the EY band.
    const c3 = calibrationFrom(brews.slice(0, 3), KEY, opts);
    const c5 = calibrationFrom(brews, KEY, opts);
    expect(c5.confidence).toBeGreaterThan(c3.confidence);
    expect(simulate(buildInput(next, 'conical', c5)).eyUncertainty).toBeLessThan(simulate(buildInput(next, 'conical')).eyUncertainty);
  });
});
