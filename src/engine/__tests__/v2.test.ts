import { describe, expect, it } from 'vitest';
import { simulate, type Additions, type BeanInput, type SimulationInput, type WaterInput } from '..';
import { drinkById } from '../../data/drinks';
import { WATER_PRESETS } from '../../data/water';

const bean: BeanInput = { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 };
const drink = (id: string, patch: { additions?: Additions; water?: WaterInput } = {}): SimulationInput => {
  const d = drinkById(id)!;
  return {
    bean,
    grind: { particleUm: d.grindUm, burr: 'conical' },
    brew: d.brew,
    target: d.target,
    additions: patch.additions ?? d.additions,
    water: patch.water,
  };
};
const preset = (id: string) => WATER_PRESETS.find((p) => p.id === id)!.water;

describe('new methods', () => {
  it('Turkish coffee: near-complete extraction, very heavy body, grounds in the cup', () => {
    const r = simulate(drink('turkish'));
    expect(r.ey).toBeGreaterThan(24);
    expect(r.sensory.body).toBeGreaterThan(simulate(drink('v60')).sensory.body + 3);
    expect(r.flavorNotes).toContain('sediment');
    expect(r.extraction).toBe('ideal');
  });

  it('siphon stirring extracts faster than a still immersion of the same recipe', () => {
    const siphon = drink('siphon');
    const still: SimulationInput = { ...siphon, brew: { ...siphon.brew, method: 'immersion' } };
    expect(simulate(siphon).ey).toBeGreaterThan(simulate(still).ey);
  });

  it('Clever: longer steep → more extraction', () => {
    const c = drink('clever');
    const short = simulate({ ...c, brew: { ...c.brew, timeS: 90 } }).ey;
    expect(simulate(c).ey).toBeGreaterThan(short);
  });
});

describe('milk texture and syrups', () => {
  const capp = (add: Additions) => simulate(drink('cappuccino', { additions: { milkMl: 120, milkType: 'whole', ...add } }));

  it('foam fills the cup without diluting the coffee', () => {
    const silky = capp({ foam: 'silky' });
    const airy = capp({ foam: 'airy' });
    expect(airy.finalVolumeMl).toBeGreaterThan(silky.finalVolumeMl);
    expect(airy.finalTds).toBeCloseTo(silky.finalTds, 5);
  });

  it('milk is sweetest around 60 °C; scalding flags a diagnosis', () => {
    const ideal = capp({ milkTempC: 60 });
    const hot = capp({ milkTempC: 78 });
    expect(ideal.sensory.sweetness).toBeGreaterThan(hot.sensory.sweetness);
    expect(hot.diagnoses.map((d) => d.key)).toContain('milkTooHot');
    expect(hot.flavorNotes).toContain('scalded');
  });

  it('syrups add sweetness and calories; chocolate also body', () => {
    const plain = capp({});
    const vanilla = capp({ syrup: { type: 'vanilla', ml: 15 } });
    const choc = capp({ syrup: { type: 'chocolate', ml: 15 } });
    expect(vanilla.sensory.sweetness).toBeGreaterThan(plain.sensory.sweetness);
    expect(vanilla.kcal - plain.kcal).toBeCloseTo(15 * 3.3, 0);
    expect(choc.sensory.body).toBeGreaterThanOrEqual(vanilla.sensory.body);
    expect(vanilla.flavorNotes).toContain('vanilla');
  });
});

describe('water chemistry', () => {
  it('distilled water extracts less and tastes thinner than SCA water', () => {
    const sca = simulate(drink('v60', { water: preset('sca') }));
    const dist = simulate(drink('v60', { water: preset('distilled') }));
    expect(dist.ey).toBeLessThan(sca.ey);
    expect(dist.sensory.body).toBeLessThan(sca.sensory.body);
  });

  it('hard, alkaline water mutes acidity, tastes chalky and warns about scale', () => {
    const sca = simulate(drink('espresso', { water: preset('sca') }));
    const hard = simulate(drink('espresso', { water: preset('hardTap') }));
    expect(hard.sensory.acidity).toBeLessThan(sca.sensory.acidity);
    expect(hard.flavorNotes).toContain('chalky');
    expect(hard.diagnoses.map((d) => d.key)).toContain('scaleRisk');
    expect(sca.diagnoses.map((d) => d.key)).not.toContain('scaleRisk');
  });
});
