import { describe, expect, it } from 'vitest';
import { drinkById } from '../data/drinks';
import { grinderById } from '../data/grinders';
import { stateForDrink, type SimState } from '../pages/useBrewSetup';
import { NO_CALIBRATION } from './calibration';
import { goalTarget, solveRecipe, TASTE_GOALS } from './solver';

const setup = (id: string, patch: Partial<SimState> = {}): SimState => ({ ...stateForDrink(drinkById(id)!), ...patch });
const comandante = grinderById('comandante-c40')!.scale;

describe('solveRecipe', () => {
  it('V60: hits an exact EY/TDS target with the dose fixed', () => {
    const s = setup('v60', { particleUm: 900 });
    const r = solveRecipe(s, { ey: 20.5, tds: 1.35 }, { burr: 'conical' });
    expect(r.state.brew.doseG).toBe(15);
    expect(r.result.ey).toBeCloseTo(20.5, 0);
    expect(Math.abs(r.result.tds - 1.35)).toBeLessThan(0.05);
    expect(r.feasible).toBe(true);
    expect(r.state.particleUm).toBeLessThan(900);
  });

  it('espresso: lands in the shot-time window and snaps to the dial', () => {
    const s = setup('espresso', { particleUm: 420 });
    const r = solveRecipe(s, { ey: 20, tds: 10 }, { burr: 'conical', scale: comandante });
    expect(r.result.timeS).toBeGreaterThanOrEqual(24);
    expect(r.result.timeS).toBeLessThanOrEqual(33);
    expect(r.state.particleUm % 30).toBe(0); // a whole Comandante click
    expect(Math.abs(r.result.ey - 20)).toBeLessThan(1);
    expect(r.feasible).toBe(true);
  });

  it('chooses a cooler temperature for dark roasts and hotter for light ones', () => {
    const dark = solveRecipe(setup('v60', { bean: { ...setup('v60').bean, roast: 0.9 } }), { ey: 20, tds: 1.3 }, { burr: 'conical' });
    const light = solveRecipe(setup('v60', { bean: { ...setup('v60').bean, roast: 0.1 } }), { ey: 20, tds: 1.3 }, { burr: 'conical' });
    expect(light.state.brew.tempC).toBeGreaterThan(dark.state.brew.tempC);
  });

  it('respects a locked temperature', () => {
    const s = setup('v60');
    const r = solveRecipe({ ...s, brew: { ...s.brew, tempC: 90 } }, { ey: 20, tds: 1.3 }, { burr: 'conical', lockTemp: true });
    expect(r.state.brew.tempC).toBe(90);
  });

  it('reports an unreachable target instead of pretending', () => {
    const r = solveRecipe(setup('v60'), { ey: 31, tds: 1.3 }, { burr: 'conical' });
    expect(r.feasible).toBe(false);
    expect(r.notes).toContain('grindLimit');
  });

  it('takes the personal calibration into account (nominal dial value moves)', () => {
    const s = setup('v60');
    const plain = solveRecipe(s, { ey: 20, tds: 1.3 }, { burr: 'conical' });
    const coarseGrinder = solveRecipe(s, { ey: 20, tds: 1.3 }, { burr: 'conical', cal: { ...NO_CALIBRATION, grindFactor: 1.2 } });
    // The grinder really grinds 20 % coarser → set it finer on the dial.
    expect(coarseGrinder.state.particleUm).toBeLessThan(plain.state.particleUm);
  });

  it('every taste goal is solvable for the classic drinks', () => {
    for (const id of ['espresso', 'v60', 'frenchPress', 'aeropress']) {
      const s = setup(id);
      for (const g of TASTE_GOALS) {
        const r = solveRecipe(s, goalTarget(g, s, 'conical'), { burr: 'conical' });
        expect(r.feasible, `${id}/${g} ${JSON.stringify(r.notes)} ey=${r.result.ey.toFixed(2)} tds=${r.result.tds.toFixed(2)} t=${r.result.timeS.toFixed(0)}`).toBe(true);
      }
    }
  });
});
