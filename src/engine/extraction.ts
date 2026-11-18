import { CAFFEINE_CONTENT, CAFFEINE_DIFFUSIVITY, CLASS_DIFFUSIVITY, MODEL } from './constants';
import { predictEspressoTimeS, predictPouroverTimeS } from './flow';
import { simulateShot } from './shot';
import {
  arrhenius,
  brokenCellFraction,
  clamp,
  defaultFines,
  solubilityTempFactor,
  sphereRelease,
} from './physics';
import type { BeanInput, BrewMethod, CompoundClass, SimulationInput, WaterInput } from './types';

export const COMPOUND_CLASSES: CompoundClass[] = ['acids', 'sweet', 'bitter', 'astringent'];

const PERCOLATION: ReadonlySet<BrewMethod> = new Set(['espresso', 'pourover', 'moka']);
export const isPercolation = (m: BrewMethod) => PERCOLATION.has(m);

/** Default contact times when none is given (s). */
export const DEFAULT_TIME_S: Record<BrewMethod, number> = {
  espresso: 28,
  pourover: 180,
  immersion: 240,
  aeropress: 120,
  moka: MODEL.mokaContactS,
  coldbrew: 16 * 3600,
  turkish: 150,
  siphon: 75,
  clever: 180,
};

/**
 * Share of the extractable solubles belonging to each compound class.
 * Light roasts keep more organic acids; roasting converts sugars and acids
 * into bitter melanoidins and phenylindanes.
 */
export function classContents(bean: BeanInput): Record<CompoundClass, number> {
  const r = clamp(bean.roast, 0, 1);
  const rob = clamp(bean.robustaShare, 0, 1);
  const c: Record<CompoundClass, number> = {
    acids: 0.22 - 0.12 * r,
    sweet: 0.3 - 0.08 * r,
    bitter: 0.28 + 0.16 * r,
    astringent: 0.2 + 0.04 * r,
  };
  switch (bean.process) {
    case 'washed':
      c.acids += 0.02;
      c.sweet -= 0.02;
      break;
    case 'natural':
      c.sweet += 0.03;
      c.acids -= 0.02;
      c.astringent -= 0.01;
      break;
    case 'honey':
      c.sweet += 0.02;
      c.acids -= 0.01;
      c.astringent -= 0.01;
      break;
    case 'anaerobic':
      c.sweet += 0.03;
      c.acids += 0.01;
      c.bitter -= 0.04;
      break;
    case 'wetHulled':
      c.acids -= 0.04;
      c.bitter += 0.03;
      c.astringent += 0.01;
      break;
  }
  c.bitter += 0.12 * rob;
  c.acids -= 0.06 * rob;
  c.sweet -= 0.06 * rob;
  if (bean.altitudeM !== undefined) {
    const a = clamp((bean.altitudeM - 1200) / 1000, -1, 1) * 0.03;
    c.acids += a;
    c.bitter -= a;
  }
  const total = COMPOUND_CLASSES.reduce((s, k) => s + Math.max(0.01, c[k]), 0);
  for (const k of COMPOUND_CLASSES) c[k] = Math.max(0.01, c[k]) / total;
  return c;
}

/** Effective brew temperature the grounds see. */
export function effectiveTempC(method: BrewMethod, tempC: number): number {
  if (method === 'moka') return MODEL.mokaEffectiveTempC;
  // Pour-over slurry sits a few degrees below kettle temperature; immersion cools over time.
  if (method === 'pourover') return tempC - 3;
  if (method === 'immersion' || method === 'aeropress' || method === 'clever') return tempC - 3;
  // Siphon water is held hot by the burner; the cezve is brought to the edge of a boil.
  if (method === 'siphon') return tempC - 1;
  return tempC;
}

/** CO₂ outgassing from very fresh beans repels water and lowers extraction. */
function freshnessExtractionFactor(method: BrewMethod, days: number | undefined): number {
  if (days === undefined) return 1;
  const rest = method === 'espresso' ? 7 : 4;
  return days >= rest ? 1 : 0.94 + (0.06 * days) / rest;
}

/** Very soft water extracts less; moderate hardness (Mg²⁺/Ca²⁺) helps. */
function waterExtractionFactor(water: WaterInput | undefined): number {
  if (water?.ghPpm === undefined) return 1;
  return clamp(0.96 + 0.0008 * water.ghPpm, 0.96, 1.02);
}

export interface ExtractionCore {
  timeS: number;
  timePredicted: boolean;
  fines: number;
  /** Fraction of each class's content that ends up dissolved, 0..1. */
  classExtraction: Record<CompoundClass, number>;
  caffeineFraction: number;
  /** Extractable solubles as share of dose. */
  solubles: number;
  dissolvedG: number;
  ey: number;
  tds: number;
  beverageG: number;
}

export function resolveTime(input: SimulationInput, fines: number): { timeS: number; predicted: boolean } {
  const { brew, bean, grind } = input;
  if (brew.timeS !== undefined && brew.timeS > 0) return { timeS: brew.timeS, predicted: false };
  if (brew.method === 'espresso') {
    if (brew.profile) return { timeS: simulateShot(input)!.timeS, predicted: true };
    return { timeS: predictEspressoTimeS(brew, bean, grind.particleUm, fines), predicted: true };
  }
  if (brew.method === 'pourover')
    return { timeS: predictPouroverTimeS(brew, grind.particleUm, fines), predicted: true };
  return { timeS: DEFAULT_TIME_S[brew.method], predicted: false };
}

export function extract(input: SimulationInput): ExtractionCore {
  const { bean, grind, brew } = input;
  const method = brew.method;
  const d = Math.max(30, grind.particleUm);
  const fines = grind.finesFraction ?? defaultFines(grind.burr, d);
  const { timeS, predicted } = resolveTime(input, fines);

  const temp = effectiveTempC(method, brew.tempC);
  // Vigorous stirring in a siphon renews the boundary layer: more transfer per second.
  const contactS =
    method === 'pourover'
      ? 0.85 * timeS
      : method === 'aeropress'
        ? timeS + 20
        : method === 'siphon'
          ? timeS * MODEL.siphonAgitation
          : timeS;

  const ratio = brew.waterG / brew.doseG;
  const radiusM = (d / 2) * 1e-6;
  const arr = arrhenius(temp);
  // Light roasts are denser and less porous; high-grown beans likewise.
  const roastD = 0.8 + 0.4 * clamp(bean.roast, 0, 1);
  const altD = bean.altitudeM === undefined ? 1 : 1 - 0.08 * clamp((bean.altitudeM - 1200) / 1000, -1, 1);
  const baseD = MODEL.diffusivityRef * arr * roastD * altD;
  const broken = fines + (1 - fines) * brokenCellFraction(d);
  const percolation = isPercolation(method);

  const env =
    freshnessExtractionFactor(method, bean.daysOffRoast) * waterExtractionFactor(input.water);
  const equilibrium = percolation ? 1 : 1 / (1 + (MODEL.immersionEquilibriumK * brew.doseG) / brew.waterG);

  const fractionFor = (mult: number): number => {
    const tauFast = MODEL.tauFastS / (mult * arr);
    let fast = 1 - Math.exp(-contactS / tauFast);
    let slowDrive = 1;
    if (percolation) {
      fast *= 1 - Math.exp(-ratio / MODEL.washoutRatio);
      slowDrive = ratio / (ratio + MODEL.drivingForceK);
    }
    const slow = sphereRelease((baseD * mult * contactS) / (radiusM * radiusM)) * slowDrive;
    return clamp((broken * fast + (1 - broken) * slow) * equilibrium * env, 0, 1);
  };

  const classExtraction = {} as Record<CompoundClass, number>;
  for (const k of COMPOUND_CLASSES) classExtraction[k] = fractionFor(CLASS_DIFFUSIVITY[k]);
  const caffeineFraction = fractionFor(CAFFEINE_DIFFUSIVITY);

  const s = MODEL.solubles;
  const solubles =
    (s.base + s.perRoast * clamp(bean.roast, 0, 1) + s.perRobusta * clamp(bean.robustaShare, 0, 1)) *
    solubilityTempFactor(temp) *
    (input.calibration?.extractionScale ?? 1);

  const contents = classContents(bean);
  const extractedShare = COMPOUND_CLASSES.reduce((sum, k) => sum + contents[k] * classExtraction[k], 0);
  const dissolvedG = brew.doseG * solubles * extractedShare;
  const ey = (dissolvedG / brew.doseG) * 100;

  const retained = MODEL.retention[method] * brew.doseG;
  let beverageG: number;
  let tds: number;
  if (method === 'espresso') {
    beverageG = brew.waterG;
    tds = (dissolvedG / beverageG) * 100;
  } else if (method === 'moka') {
    beverageG = Math.max(1, brew.waterG * (1 - MODEL.mokaBoilerResidue) - retained);
    tds = (dissolvedG / (beverageG + dissolvedG)) * 100;
  } else if (percolation) {
    beverageG = Math.max(1, brew.waterG - retained);
    tds = (dissolvedG / (beverageG + dissolvedG)) * 100;
  } else {
    // Immersion: the liquid is homogeneous; retained liquid has the same strength.
    beverageG = Math.max(1, brew.waterG - retained);
    tds = (dissolvedG / (brew.waterG + dissolvedG)) * 100;
  }

  return {
    timeS,
    timePredicted: predicted,
    fines,
    classExtraction,
    caffeineFraction,
    solubles,
    dissolvedG,
    ey,
    tds,
    beverageG,
  };
}

export function caffeineMg(input: SimulationInput, core: ExtractionCore): number {
  const { bean, brew } = input;
  const rob = clamp(bean.robustaShare, 0, 1);
  const content = CAFFEINE_CONTENT.arabica * (1 - rob) + CAFFEINE_CONTENT.robusta * rob;
  let inCup = core.caffeineFraction;
  if (!isPercolation(brew.method)) inCup *= core.beverageG / brew.waterG;
  return brew.doseG * content * inCup * 1000;
}
