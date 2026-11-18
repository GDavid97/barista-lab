import { describe, expect, it } from 'vitest';
import {
  scaleFromTwoPoints,
  settingToUm,
  simulate,
  suggestDoseG,
  suggestGrindUm,
  umToSetting,
  type BeanInput,
  type SimulationInput,
} from '..';
import { DRINKS } from '../../data/drinks';
import { sphereRelease } from '../physics';

const medium: BeanInput = { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 };

const espresso = (patch: Partial<SimulationInput['brew']> = {}, um = 300, bean = medium): SimulationInput => ({
  bean,
  grind: { particleUm: um, burr: 'conical' },
  brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, pressureBar: 9, filter: 'metal', ...patch },
});

const v60 = (patch: Partial<SimulationInput['brew']> = {}, um = 650, bean = medium): SimulationInput => ({
  bean,
  grind: { particleUm: um, burr: 'conical' },
  brew: { method: 'pourover', doseG: 15, waterG: 250, tempC: 94, filter: 'paper', ...patch },
});

describe('physics', () => {
  it('sphere release is monotonic, bounded and continuous at the series switch', () => {
    let prev = 0;
    for (const x of [0.001, 0.005, 0.0099, 0.0101, 0.05, 0.2, 1]) {
      const v = sphereRelease(x);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
    expect(Math.abs(sphereRelease(0.0099) - sphereRelease(0.0101))).toBeLessThan(0.01);
  });
});

describe('reference brews', () => {
  it('18 g → 36 g espresso at ~300 µm lands in the classic window', () => {
    const r = simulate(espresso());
    expect(r.timeS).toBeGreaterThan(25);
    expect(r.timeS).toBeLessThan(31);
    expect(r.ey).toBeGreaterThan(19);
    expect(r.ey).toBeLessThan(21);
    expect(r.tds).toBeGreaterThan(9);
    expect(r.tds).toBeLessThan(11);
    expect(r.extraction).toBe('ideal');
  });

  it('15 g / 250 g V60 at ~650 µm is a golden-cup brew', () => {
    const r = simulate(v60());
    expect(r.ey).toBeGreaterThan(19);
    expect(r.ey).toBeLessThan(21);
    expect(r.tds).toBeGreaterThan(1.25);
    expect(r.tds).toBeLessThan(1.45);
  });

  it('every preset drink produces a sane, near-ideal result', () => {
    for (const d of DRINKS) {
      const r = simulate({
        bean: medium,
        grind: { particleUm: d.grindUm, burr: 'conical' },
        brew: d.brew,
        additions: d.additions,
        target: d.target,
      });
      expect(Number.isFinite(r.ey), d.id).toBe(true);
      // Within (or very near) the drink's own ideal window.
      expect(r.ey, d.id).toBeGreaterThan(r.idealEy[0] - 1.5);
      expect(r.ey, d.id).toBeLessThan(r.idealEy[1] + 1.5);
      for (const v of Object.values(r.sensory)) {
        expect(v, d.id).toBeGreaterThanOrEqual(0);
        expect(v, d.id).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('monotonic behaviour', () => {
  it('finer grind extracts more and slows the shot', () => {
    const fine = simulate(espresso({}, 260));
    const coarse = simulate(espresso({}, 340));
    expect(fine.ey).toBeGreaterThan(coarse.ey);
    expect(fine.timeS).toBeGreaterThan(coarse.timeS);
  });

  it('hotter water extracts more', () => {
    expect(simulate(v60({ tempC: 96 })).ey).toBeGreaterThan(simulate(v60({ tempC: 88 })).ey);
  });

  it('longer contact extracts more', () => {
    expect(simulate(v60({ timeS: 240 })).ey).toBeGreaterThan(simulate(v60({ timeS: 150 })).ey);
  });

  it('a longer ratio raises EY but lowers TDS', () => {
    const ristretto = simulate(espresso({ waterG: 22, timeS: 25 }));
    const lungo = simulate(espresso({ waterG: 54, timeS: 25 }));
    expect(lungo.ey).toBeGreaterThan(ristretto.ey);
    expect(lungo.tds).toBeLessThan(ristretto.tds);
  });

  it('higher pressure and fewer grams flow faster', () => {
    expect(simulate(espresso({ pressureBar: 6 })).timeS).toBeGreaterThan(simulate(espresso()).timeS);
    expect(simulate(espresso({ doseG: 20 })).timeS).toBeGreaterThan(simulate(espresso({ doseG: 16 })).timeS);
  });

  it('cold brew extracts slowly', () => {
    const base: SimulationInput = {
      bean: medium,
      grind: { particleUm: 1100, burr: 'conical' },
      brew: { method: 'coldbrew', doseG: 100, waterG: 1000, tempC: 20, timeS: 3600, filter: 'paper' },
    };
    const short = simulate(base);
    const long = simulate({ ...base, brew: { ...base.brew, timeS: 16 * 3600 } });
    expect(short.ey).toBeLessThan(14);
    expect(long.ey).toBeGreaterThan(16);
  });
});

describe('sensory', () => {
  it('under-extraction tastes sour, over-extraction bitter/astringent', () => {
    const under = simulate(espresso({}, 400));
    const ideal = simulate(espresso());
    const over = simulate(espresso({}, 220));
    expect(under.extraction).toBe('under');
    expect(under.sensory.acidity).toBeGreaterThan(ideal.sensory.acidity);
    expect(under.balance).toBe('sour');
    expect(over.extraction).toBe('over');
    expect(over.sensory.bitterness).toBeGreaterThan(ideal.sensory.bitterness);
    expect(over.sensory.astringency).toBeGreaterThan(ideal.sensory.astringency);
    expect(ideal.sensory.sweetness).toBeGreaterThan(under.sensory.sweetness);
    expect(ideal.sensory.sweetness).toBeGreaterThan(over.sensory.sweetness);
  });

  it('light roasts are brighter, dark roasts more bitter and heavier', () => {
    const light = simulate(v60({}, 650, { ...medium, roast: 0.15 }));
    const dark = simulate(v60({}, 650, { ...medium, roast: 0.85 }));
    expect(light.sensory.acidity).toBeGreaterThan(dark.sensory.acidity + 2);
    expect(dark.sensory.bitterness).toBeGreaterThan(light.sensory.bitterness + 2);
    expect(dark.sensory.body).toBeGreaterThan(light.sensory.body);
  });

  it('milk masks acidity and adds sweetness and body versus an americano', () => {
    const base = espresso();
    const americano = simulate({ ...base, additions: { waterMl: 120 } });
    const cappuccino = simulate({ ...base, additions: { milkMl: 120, milkType: 'whole' } });
    expect(cappuccino.sensory.acidity).toBeLessThan(americano.sensory.acidity);
    expect(cappuccino.sensory.body).toBeGreaterThan(americano.sensory.body);
    expect(cappuccino.kcal).toBeGreaterThan(60);
  });

  it('metal filter gives more body than paper', () => {
    expect(simulate(v60({ filter: 'metal' })).sensory.body).toBeGreaterThan(simulate(v60()).sensory.body);
  });
});

describe('caffeine', () => {
  it('a double espresso is in the usual range and robusta adds caffeine', () => {
    const arabica = simulate(espresso()).caffeineMg;
    expect(arabica).toBeGreaterThan(130);
    expect(arabica).toBeLessThan(210);
    const blend = simulate(espresso({}, 300, { ...medium, robustaShare: 0.5 })).caffeineMg;
    expect(blend).toBeGreaterThan(arabica * 1.3);
  });
});

describe('diagnosis and suggestions', () => {
  it('suggests a grind size that hits the EY window centre', () => {
    const input = espresso({}, 420);
    const um = suggestGrindUm(input);
    expect(um).toBeDefined();
    expect(um!).toBeLessThan(420);
    expect(simulate({ ...input, grind: { ...input.grind, particleUm: um! } }).ey).toBeCloseTo(20, 1);
  });

  it('suggests a dose for a weak V60', () => {
    const input = v60({ doseG: 11 });
    expect(simulate(input).diagnoses.map((d) => d.key)).toContain('weak');
    const dose = suggestDoseG(input);
    expect(dose).toBeGreaterThan(11);
  });

  it('flags very fresh beans and an on-target brew', () => {
    expect(simulate(espresso({}, 300, { ...medium, daysOffRoast: 2 })).diagnoses.map((d) => d.key)).toContain(
      'tooFresh',
    );
    expect(simulate(v60()).diagnoses.map((d) => d.key)).toEqual(['onTarget']);
  });
});

describe('grind scales', () => {
  it('converts dial settings both ways', () => {
    const scale = { zeroUm: 0, umPerStep: 30, min: 0, max: 40, step: 1 };
    expect(settingToUm(scale, 10)).toBe(300);
    expect(umToSetting(scale, 312)).toBe(10);
    expect(umToSetting(scale, 5000)).toBe(40);
  });

  it('builds a scale from a two-point calibration', () => {
    const scale = scaleFromTwoPoints(8, 22, { min: 0, max: 40, step: 1 })!;
    expect(settingToUm(scale, 8)).toBeCloseTo(300);
    expect(settingToUm(scale, 22)).toBeCloseTo(650);
    expect(scaleFromTwoPoints(22, 8, { min: 0, max: 40, step: 1 })).toBeUndefined();
  });
});
