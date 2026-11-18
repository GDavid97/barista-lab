import { FOAMS, IDEALS, MILKS, SYRUPS } from './constants';
import { COMPOUND_CLASSES, classContents, extract } from './extraction';
import { clamp } from './physics';
import type {
  BalanceLabel,
  BeanInput,
  BrewMethod,
  CompoundClass,
  SensoryProfile,
  SimulationInput,
} from './types';
import type { ExtractionCore } from './extraction';

/** Sensitivity of perceived taste to shifts in the extracted compound mix. */
const GAMMA = 1.8;

const REFERENCE_BEAN: BeanInput = { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 };

/** A well-made, medium-roast reference brew per method (the "5/10" baseline). */
const REFERENCE_INPUTS: Record<BrewMethod, SimulationInput> = {
  espresso: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 300, burr: 'conical' },
    brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, timeS: 28, filter: 'metal' },
  },
  pourover: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 650, burr: 'conical' },
    brew: { method: 'pourover', doseG: 15, waterG: 250, tempC: 94, timeS: 180, filter: 'paper' },
  },
  immersion: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 900, burr: 'conical' },
    brew: { method: 'immersion', doseG: 30, waterG: 500, tempC: 95, timeS: 240, filter: 'metal' },
  },
  aeropress: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 500, burr: 'conical' },
    brew: { method: 'aeropress', doseG: 15, waterG: 220, tempC: 88, timeS: 110, filter: 'paper' },
  },
  moka: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 400, burr: 'conical' },
    brew: { method: 'moka', doseG: 15, waterG: 150, tempC: 90, filter: 'metal' },
  },
  coldbrew: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 1100, burr: 'conical' },
    brew: { method: 'coldbrew', doseG: 100, waterG: 1000, tempC: 20, timeS: 14 * 3600, filter: 'paper' },
  },
  turkish: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 120, burr: 'conical' },
    brew: { method: 'turkish', doseG: 7, waterG: 70, tempC: 96, timeS: 150, filter: 'none' },
  },
  siphon: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 600, burr: 'conical' },
    brew: { method: 'siphon', doseG: 20, waterG: 300, tempC: 92, timeS: 75, filter: 'cloth' },
  },
  clever: {
    bean: REFERENCE_BEAN,
    grind: { particleUm: 700, burr: 'conical' },
    brew: { method: 'clever', doseG: 20, waterG: 300, tempC: 94, timeS: 180, filter: 'paper' },
  },
};

function extractedShares(bean: BeanInput, core: ExtractionCore): Record<CompoundClass, number> {
  const contents = classContents(bean);
  const raw = COMPOUND_CLASSES.map((k) => contents[k] * core.classExtraction[k]);
  const total = raw.reduce((a, b) => a + b, 0);
  const out = {} as Record<CompoundClass, number>;
  COMPOUND_CLASSES.forEach((k, i) => (out[k] = raw[i]! / total));
  return out;
}

const referenceCache = new Map<BrewMethod, Record<CompoundClass, number>>();
function referenceShares(method: BrewMethod): Record<CompoundClass, number> {
  let ref = referenceCache.get(method);
  if (!ref) {
    const input = REFERENCE_INPUTS[method];
    ref = extractedShares(input.bean, extract(input));
    referenceCache.set(method, ref);
  }
  return ref;
}

const score = (v: number) => clamp(v, 0, 10);

/** Aroma: freshness curve, roast development, and fermentation-driven processes. */
function aromaScore(bean: BeanInput): number {
  const d = bean.daysOffRoast;
  let fresh = 1;
  if (d !== undefined) {
    if (d < 3) fresh = 0.9;
    else if (d <= 30) fresh = 1;
    else fresh = clamp(1 - (d - 30) / 120, 0.45, 1);
  }
  // Aromatics peak around medium-light; very dark roasts turn smoky and flat.
  const roast = 1 - Math.pow((bean.roast - 0.4) / 0.9, 2);
  const process = bean.process === 'anaerobic' ? 1.2 : bean.process === 'natural' ? 1.1 : 1;
  return score(6.5 * fresh * roast * process);
}

/** Perceptual reference for a diluted espresso drink (≈ a strong filter cup). */
const CUP_REFERENCE_TDS = 1.3;

/**
 * Sensory profile of the final drink.
 * - Compound mix relative to a well-made reference brew sets the character
 *   (roast, process, species shift the mix);
 * - deviation from the ideal EY window adds the classic sour ↔ bitter axis;
 * - concentration scales overall intensity (sub-linear, Stevens-like);
 * - milk masks acids and bitterness, adds sweetness and body.
 */
export function sensoryProfile(
  input: SimulationInput,
  core: ExtractionCore,
  finalTds: number,
): SensoryProfile {
  const { bean, brew, water } = input;
  const ideal = IDEALS[brew.method];
  const shares = extractedShares(bean, core);
  const ref = referenceShares(brew.method);
  const rel = (k: CompoundClass) => Math.pow(shares[k] / ref[k], GAMMA);

  const add = input.additions ?? {};
  const milk = add.milkMl ?? 0;
  const syrup = add.syrup && add.syrup.ml > 0 ? add.syrup : undefined;
  const syrupMl = syrup?.ml ?? 0;
  const sugar = (add.sugarG ?? 0) + (syrup ? syrupMl * SYRUPS[syrup.type].sugarPerMl : 0);
  const diluted = milk + (add.waterMl ?? 0) > 0;
  const tdsMid = (ideal.tds[0] + ideal.tds[1]) / 2;
  // A diluted drink is judged against a blend of the method's and a filter cup's
  // reference strength, so a splash of milk barely moves it but an americano reads like a cup.
  const f2 = Math.pow(core.beverageG / (core.beverageG + milk + (add.waterMl ?? 0)), 2);
  const refTds = diluted ? tdsMid * f2 + CUP_REFERENCE_TDS * (1 - f2) : tdsMid;
  const strength = Math.pow((diluted ? finalTds : core.tds) / refTds, 0.35);

  // Distance from the ideal EY window centre, in units of 2 EY points.
  const eyMid = (ideal.ey[0] + ideal.ey[1]) / 2;
  const dev = (core.ey - eyMid) / 2;

  // Alkalinity buffers acids; ~40 ppm is neutral.
  const kh = water?.khPpm;
  const buffer = kh === undefined ? 1 : clamp(1 - (kh - 40) / 200, 0.5, 1.1);

  const total = core.beverageG + milk + (add.waterMl ?? 0) + syrupMl;
  const m = milk / total;
  const mp = MILKS[add.milkType ?? 'whole'];
  // Lactose tastes sweetest steamed to ~55–65 °C; scalded milk turns flat and cooked.
  const milkTemp = add.milkTempC ?? 60;
  const milkSweet = clamp(1 - Math.pow((milkTemp - 60) / 18, 2), 0.35, 1);
  const foam = FOAMS[add.foam ?? (milk > 0 ? 'silky' : 'none')];
  const sugarSweet = sugar > 0 ? Math.min(4, (sugar / total) * 100 * 0.8) : 0;

  const acidity = 5 * rel('acids') * Math.exp(-0.2 * dev) * strength * buffer * (1 - mp.masking * m * 0.9);
  const bitterness =
    5 * rel('bitter') * Math.exp(0.16 * dev) * strength * (1 + 0.25 * bean.robustaShare) * (1 - mp.masking * m * 0.75) -
    sugarSweet * 0.3 +
    // High alkalinity leaves a chalky, dull bitterness.
    (kh !== undefined && kh > 120 ? 0.3 : 0);
  // Easing off the pressure late in the shot limits channeling through the eroded puck.
  const gentleEnd = brew.profile === 'declining' || brew.profile === 'lever' ? 0.9 : 1;
  const astringency = 5 * rel('astringent') * Math.exp(0.15 * dev) * strength * (1 - mp.masking * m * 0.75) * gentleEnd;
  // Sweetness peaks inside the window and is masked when sourness or bitterness dominate.
  const sweetRaw = 5 * rel('sweet') * Math.exp(-0.12 * dev * dev) * Math.pow(strength, 0.6);
  const sweetBlack = sweetRaw / (1 + 0.12 * Math.max(0, bitterness - 6) + 0.1 * Math.max(0, acidity - 7));
  const sweetness = sweetBlack * (1 - m * 0.5) + mp.sweetness * m * 4.5 * milkSweet + sugarSweet;

  const filterBody =
    brew.method === 'espresso'
      ? 0.6
      : brew.filter === 'none'
        ? 2.5
        : brew.filter === 'metal'
          ? 1.5
          : brew.filter === 'cloth'
            ? 0.5
            : 0;
  // Very soft water extracts flat and thin.
  const waterBody = water?.ghPpm !== undefined && water.ghPpm < 30 ? -0.4 : 0;
  const body =
    1.4 +
    1.8 * Math.log2(Math.max(0.2, diluted ? finalTds : core.tds) / 0.8) +
    filterBody +
    0.9 * bean.robustaShare +
    0.6 * bean.roast +
    (bean.process === 'natural' || bean.process === 'honey' ? 0.3 : 0) +
    mp.body * m * 7 +
    (milk > 0 ? foam.body * Math.min(1, m * 2.5) : 0) +
    (syrup ? SYRUPS[syrup.type].body * (syrupMl / total) * 6 : 0) +
    waterBody;

  const aftertaste =
    0.35 * score(body) + 0.3 * score(sweetness) + 0.35 * score(bitterness) - 0.15 * score(astringency);

  return {
    acidity: score(acidity),
    sweetness: score(sweetness),
    bitterness: score(bitterness),
    astringency: score(astringency),
    body: score(body),
    aftertaste: score(aftertaste),
    aroma: score(aromaScore(bean) * Math.pow(core.beverageG / total, 0.25)),
  };
}

export function balanceLabel(p: SensoryProfile, eyLevel: 'under' | 'ideal' | 'over'): BalanceLabel {
  if (p.bitterness >= 7.5 || p.astringency >= 7.5) return 'harsh';
  if (p.acidity - p.sweetness > 1.5 && eyLevel === 'under') return 'sour';
  if (p.bitterness - p.sweetness > 1.5) return 'bitter';
  if (p.acidity >= 6 && p.sweetness >= 4.5) return 'bright';
  if (p.sweetness >= 5.5 && p.bitterness < 5.5) return 'sweet';
  return 'balanced';
}
