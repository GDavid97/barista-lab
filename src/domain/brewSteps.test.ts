import { describe, expect, it } from 'vitest';
import { DRINKS } from '../data/drinks';
import { simulate, simulateShot, type SimulationInput } from '../engine';
import { activeBrewStep, brewSteps, plannedDurationS } from './brewSteps';

const bean = { robustaShare: 0, roast: 0.45, process: 'washed' as const, daysOffRoast: 14 };
const inputFor = (id: string): SimulationInput => {
  const d = DRINKS.find((x) => x.id === id)!;
  return { bean, grind: { particleUm: d.grindUm, burr: 'conical' }, brew: d.brew, additions: d.additions, target: d.target };
};
const plan = (input: SimulationInput) => brewSteps(input, { timeS: simulate(input).timeS, grindLabel: 'x' });

describe('brewSteps', () => {
  it('every drink has prep, brew and a final serve step with unique ids', () => {
    for (const d of DRINKS) {
      const steps = plan(inputFor(d.id));
      expect(steps.some((s) => s.phase === 'prep'), d.id).toBe(true);
      expect(steps.some((s) => s.phase === 'brew'), d.id).toBe(true);
      expect(steps.at(-1)!.key, d.id).toBe('serve');
      expect(new Set(steps.map((s) => s.id)).size, d.id).toBe(steps.length);
    }
  });

  it('timed brew steps are contiguous and increasing', () => {
    for (const d of DRINKS) {
      const timed = plan(inputFor(d.id)).filter((s) => s.phase === 'brew' && s.endS !== undefined);
      for (let i = 0; i < timed.length; i++) {
        const s = timed[i]!;
        expect(s.endS!, d.id).toBeGreaterThan(s.startS!);
        if (i > 0) expect(s.startS, d.id).toBe(timed[i - 1]!.endS);
      }
    }
  });

  it('pour-over targets rise to the full water weight', () => {
    const steps = plan(inputFor('v60')).filter((s) => s.targetG !== undefined);
    const targets = steps.map((s) => s.targetG!);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(targets.at(-1)).toBe(250);
    expect(steps[0]!.key).toBe('bloom');
  });

  it('espresso ends at the yield and the planned shot time; milk drinks add milk steps', () => {
    const input = inputFor('cappuccino');
    const steps = plan(input);
    const extract = steps.find((s) => s.key === 'extract')!;
    expect(extract.targetG).toBe(36);
    expect(extract.endS).toBe(Math.round(simulate(input).timeS));
    expect(steps.map((s) => s.key)).toContain('steamMilk');
  });

  it('pre-infusion becomes its own step', () => {
    const input = inputFor('espresso');
    const steps = brewSteps({ ...input, brew: { ...input.brew, preinfusionS: 6 } }, { timeS: 32, grindLabel: 'x' });
    const brew = steps.filter((s) => s.phase === 'brew');
    expect(brew.map((s) => s.key)).toEqual(['preinfuse', 'extract']);
    expect(brew[1]!.startS).toBe(6);
  });

  it('moka is manual; others have a planned duration', () => {
    expect(plannedDurationS(plan(inputFor('moka')))).toBeUndefined();
    expect(plannedDurationS(plan(inputFor('frenchPress')))).toBe(240);
  });
});

describe('activeBrewStep', () => {
  const steps = plan(inputFor('v60')).filter((s) => s.phase === 'brew');

  it('follows the clock and reports completion', () => {
    expect(activeBrewStep(steps, 0, 0)).toBe(0);
    expect(activeBrewStep(steps, 50, 0)).toBe(1);
    expect(activeBrewStep(steps, 10_000, 0)).toBe(steps.length);
  });

  it('skipping marks earlier steps done', () => {
    expect(activeBrewStep(steps, 5, 2)).toBe(2);
  });

  it('manual steps hold until confirmed', () => {
    const moka = plan(inputFor('moka')).filter((s) => s.phase === 'brew');
    expect(activeBrewStep(moka, 999, 0)).toBe(0);
    expect(activeBrewStep(moka, 999, 1)).toBe(1);
    expect(activeBrewStep(moka, 999, 2)).toBe(2);
  });
});

describe('espresso steps from the shot curve', () => {
  it('blooming and lever profiles become matching timed steps ending at the shot time', () => {
    for (const [profile, keys] of [
      ['blooming', ['preinfuse', 'bloomPause', 'extract']],
      ['lever', ['preinfuse', 'leverPull']],
      ['declining', ['extractDeclining']],
    ] as const) {
      const base = inputFor('espresso');
      const input = { ...base, brew: { ...base.brew, profile } };
      const shot = simulateShot(input)!;
      const brew = brewSteps(input, { timeS: shot.timeS, grindLabel: 'x', shot }).filter((s) => s.phase === 'brew');
      expect(brew.map((s) => s.key), profile).toEqual(keys);
      expect(brew.at(-1)!.endS, profile).toBe(Math.round(shot.timeS));
      expect(brew.at(-1)!.targetG, profile).toBe(36);
    }
  });
});
