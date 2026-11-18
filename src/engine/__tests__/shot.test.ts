import { describe, expect, it } from 'vitest';
import { simulate, simulateShot, weightAt, type PressureProfile, type SimulationInput } from '..';

const base = (profile?: PressureProfile, patch: Partial<SimulationInput['brew']> = {}): SimulationInput => ({
  bean: { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 },
  grind: { particleUm: 300, burr: 'conical' },
  brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, pressureBar: 9, filter: 'metal', profile, ...patch },
});

describe('shot curve', () => {
  it('flat 9 bar integrates to the closed-form estimate', () => {
    const closed = simulate(base(undefined)).timeS;
    const curve = simulateShot(base('flat'))!;
    expect(Math.abs(curve.timeS - closed)).toBeLessThan(0.6);
    expect(simulate(base('flat')).timeS).toBeCloseTo(curve.timeS, 5);
  });

  it('weight rises monotonically from the first drop to the target yield', () => {
    const c = simulateShot(base('flat'))!;
    expect(c.firstDropS).toBeGreaterThan(3);
    expect(c.points.at(-1)!.w).toBeCloseTo(36, 0);
    for (let i = 1; i < c.points.length; i++) expect(c.points[i]!.w).toBeGreaterThanOrEqual(c.points[i - 1]!.w);
    expect(weightAt(c, c.firstDropS - 0.5)).toBe(0);
    expect(weightAt(c, c.timeS)).toBeCloseTo(36, 0);
  });

  it('flow builds through the shot as the puck erodes', () => {
    const c = simulateShot(base('flat'))!;
    const flowing = c.points.filter((p) => p.q > 0);
    expect(flowing.at(-1)!.q).toBeGreaterThan(flowing[0]!.q * 1.2);
  });

  it('lower late pressure slows the shot: declining and lever take longer than flat', () => {
    const flat = simulateShot(base('flat'))!.timeS;
    expect(simulateShot(base('declining'))!.timeS).toBeGreaterThan(flat);
    expect(simulateShot(base('lever'))!.timeS).toBeGreaterThan(flat);
  });

  it('pre-infusion and blooming produce their phases and pressures', () => {
    const pi = simulateShot(base('preinfusion'))!;
    expect(pi.phases.map((p) => p.kind)).toEqual(['preinfuse', 'extract']);
    expect(pi.points.find((p) => p.t === 2)!.p).toBe(3);

    const bloom = simulateShot(base('blooming'))!;
    expect(bloom.phases.map((p) => p.kind)).toEqual(['preinfuse', 'bloom', 'extract']);
    const inPause = bloom.points.find((p) => p.t === 10)!;
    expect(inPause.p).toBe(0);
    expect(inPause.q).toBe(0);
  });

  it('a finer grind gives a slower shot on every profile', () => {
    for (const p of ['flat', 'preinfusion', 'blooming', 'declining', 'lever'] as const) {
      const fine = simulateShot({ ...base(p), grind: { particleUm: 260, burr: 'conical' } })!.timeS;
      const coarse = simulateShot({ ...base(p), grind: { particleUm: 340, burr: 'conical' } })!.timeS;
      expect(fine, p).toBeGreaterThan(coarse);
    }
  });

  it('declining pressure softens astringency', () => {
    const s = (p: PressureProfile) => simulate({ ...base(p), brew: { ...base(p).brew, timeS: 30 } }).sensory.astringency;
    expect(s('declining')).toBeLessThan(s('flat'));
  });

  it('non-espresso methods have no shot curve', () => {
    expect(simulateShot({ ...base('flat'), brew: { ...base('flat').brew, method: 'pourover' } })).toBeUndefined();
  });
});

describe('time window per profile', () => {
  it('a normal shot on each profile is not flagged as slow', () => {
    for (const p of ['flat', 'preinfusion', 'blooming', 'declining', 'lever'] as const) {
      const keys = simulate(base(p)).diagnoses.map((d) => d.key);
      expect(keys, p).not.toContain('shotSlowPredicted');
      expect(keys, p).not.toContain('shotFastPredicted');
    }
  });
});
