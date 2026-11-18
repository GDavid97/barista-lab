import { FOAMS, IDEALS, MILKS, SYRUPS } from './constants';
import { DEFAULT_PREINFUSION_S } from './shot';
import { caffeineMg, extract } from './extraction';
import { balanceLabel, sensoryProfile } from './sensory';
import type {
  PressureProfile,
  Diagnosis,
  ExtractionLevel,
  Range,
  SensoryProfile,
  SimulationInput,
  SimulationResult,
  StrengthLevel,
} from './types';

/** Target windows for this brew: method defaults merged with a per-drink override. */
export function idealsFor(input: SimulationInput): { ey: Range; tds: Range; time?: Range } {
  const base = IDEALS[input.brew.method];
  const merged = { ...base, ...input.target };
  // Low-pressure phases (pre-infusion, bloom pause, slower declining finish) legitimately
  // lengthen the shot: shift the time window by that extra time.
  const profile = input.brew.profile;
  if (merged.time && profile && profile !== 'flat') {
    const pi = input.brew.preinfusionS ?? DEFAULT_PREINFUSION_S[profile];
    const extra = PROFILE_TIME_OFFSET[profile](pi);
    merged.time = [merged.time[0] + extra, merged.time[1] + extra];
  }
  return merged;
}

const PROFILE_TIME_OFFSET: Record<PressureProfile, (pi: number) => number> = {
  flat: () => 0,
  preinfusion: (pi) => Math.round(pi * 0.4),
  blooming: (pi) => Math.round(pi + 6),
  declining: () => 3,
  lever: (pi) => Math.round(pi + 6),
};

const level = (v: number, [lo, hi]: Range) => (v < lo ? -1 : v > hi ? 1 : 0);

function flavorNotes(input: SimulationInput, p: SensoryProfile, ext: ExtractionLevel): string[] {
  const { bean } = input;
  const notes: string[] = [];
  if (ext === 'under') notes.push('sourThin');
  if (ext === 'over') notes.push('dryBitter');

  if (bean.roast < 0.35) notes.push(bean.process === 'natural' || bean.process === 'anaerobic' ? 'berry' : 'citrus');
  else if (bean.roast < 0.6) notes.push(bean.process === 'washed' ? 'stoneFruit' : 'caramel');
  else if (bean.roast < 0.8) notes.push('chocolate');
  else notes.push('smoky');

  if (bean.process === 'anaerobic') notes.push('winey');
  if (bean.process === 'wetHulled') notes.push('earthy');
  if (bean.robustaShare >= 0.3) notes.push('nutty');
  if (p.sweetness >= 5.5 && ext === 'ideal') notes.push('syrupy');
  if (p.body >= 7) notes.push('heavyBody');
  else if (p.body <= 3) notes.push('teaLike');
  const add = input.additions;
  if ((add?.milkMl ?? 0) > 0) {
    notes.push(p.sweetness >= 6 ? 'milkChocolate' : 'creamy');
    if ((add?.milkTempC ?? 60) > 70) notes.push('scalded');
  }
  if (add?.syrup && add.syrup.ml > 0) notes.push(SYRUPS[add.syrup.type].note);
  if (input.brew.filter === 'none') notes.push('sediment');
  if ((input.water?.khPpm ?? 0) > 120) notes.push('chalky');
  return notes;
}

function diagnose(
  input: SimulationInput,
  ey: number,
  tds: number,
  timeS: number,
  timePredicted: boolean,
): Diagnosis[] {
  const { brew, bean, water } = input;
  const ideal = idealsFor(input);
  const out: Diagnosis[] = [];
  const e = level(ey, ideal.ey);
  const s = level(tds, ideal.tds);

  if (e < 0) out.push({ key: 'underExtracted', severity: ey < ideal.ey[0] - 2 ? 'bad' : 'warn' });
  if (e > 0) out.push({ key: 'overExtracted', severity: ey > ideal.ey[1] + 2 ? 'bad' : 'warn' });
  if (e === 0 && s < 0) out.push({ key: 'weak', severity: 'warn' });
  if (e === 0 && s > 0) out.push({ key: 'strong', severity: 'warn' });

  if (ideal.time && brew.method === 'espresso') {
    const t = level(timeS, ideal.time);
    if (t < 0) out.push({ key: timePredicted ? 'shotFastPredicted' : 'shotFast', severity: 'warn', params: { s: Math.round(timeS) } });
    if (t > 0) out.push({ key: timePredicted ? 'shotSlowPredicted' : 'shotSlow', severity: 'warn', params: { s: Math.round(timeS) } });
  }

  if (bean.roast >= 0.7 && brew.tempC > 92 && brew.method !== 'coldbrew')
    out.push({ key: 'darkRoastHot', severity: 'info' });
  if (bean.roast <= 0.3 && brew.tempC < 92 && brew.method !== 'coldbrew')
    out.push({ key: 'lightRoastCool', severity: 'info' });

  const days = bean.daysOffRoast;
  if (days !== undefined) {
    const rest = brew.method === 'espresso' ? 7 : 4;
    if (days < rest) out.push({ key: 'tooFresh', severity: 'info', params: { days: rest } });
    else if (days > 45) out.push({ key: 'stale', severity: 'info' });
  }

  if (water?.ghPpm !== undefined && water.ghPpm < 30) out.push({ key: 'waterSoft', severity: 'info' });
  if (water?.khPpm !== undefined && water.khPpm > 100) out.push({ key: 'waterHard', severity: 'info' });
  // Hard water scales boilers and thermoblocks.
  if (water?.ghPpm !== undefined && water.ghPpm > 150 && (brew.method === 'espresso' || brew.method === 'moka'))
    out.push({ key: 'scaleRisk', severity: 'warn' });
  const milkTemp = input.additions?.milkTempC;
  if ((input.additions?.milkMl ?? 0) > 0 && milkTemp !== undefined && milkTemp > 70)
    out.push({ key: 'milkTooHot', severity: 'info' });

  if (out.length === 0) out.push({ key: 'onTarget', severity: 'info' });
  return out;
}

/** Run the full model on one brew. */
export function simulate(input: SimulationInput): SimulationResult {
  const ideal = idealsFor(input);
  const core = extract(input);
  const extraction: ExtractionLevel = (['under', 'ideal', 'over'] as const)[level(core.ey, ideal.ey) + 1]!;
  const strength: StrengthLevel = (['weak', 'ideal', 'strong'] as const)[level(core.tds, ideal.tds) + 1]!;

  const add = input.additions ?? {};
  const milk = add.milkMl ?? 0;
  const extraWater = add.waterMl ?? 0;
  const syrupMl = add.syrup?.ml ?? 0;
  // Liquid volume sets strength; the foamed volume is what fills the cup.
  const liquidMl = core.beverageG + milk + extraWater + syrupMl;
  const finalTds = (core.dissolvedG / (liquidMl + core.dissolvedG)) * 100;
  const foam = FOAMS[add.foam ?? (milk > 0 ? 'silky' : 'none')];
  const finalVolumeMl = liquidMl + milk * (foam.volume - 1);
  const sensory = sensoryProfile(input, core, finalTds);
  const kcal =
    (milk / 100) * MILKS[add.milkType ?? 'whole'].kcalPer100ml +
    (add.sugarG ?? 0) * 4 +
    (add.syrup ? syrupMl * SYRUPS[add.syrup.type].kcalPerMl : 0) +
    core.dissolvedG * 0.5;

  // Uncertainty: grind→micron mapping dominates; a measured time removes most of the flow error.
  const eyUncertainty =
    (input.brew.method === 'espresso' && core.timePredicted ? 2.5 : 1.5) * (input.calibration?.uncertaintyScale ?? 1);

  return {
    method: input.brew.method,
    ey: core.ey,
    eyUncertainty,
    tds: core.tds,
    finalTds,
    beverageG: core.beverageG,
    finalVolumeMl,
    timeS: core.timeS,
    timePredicted: core.timePredicted,
    extraction,
    strength,
    balance: balanceLabel(sensory, extraction),
    classExtraction: core.classExtraction,
    sensory,
    caffeineMg: caffeineMg(input, core),
    kcal,
    idealEy: ideal.ey,
    idealTds: ideal.tds,
    idealTimeS: ideal.time,
    flavorNotes: flavorNotes(input, sensory, extraction),
    diagnoses: diagnose(input, core.ey, core.tds, core.timeS, core.timePredicted),
  };
}

/**
 * Find the particle size (µm) that lands EY in the middle of the ideal window,
 * keeping everything else fixed. Returns undefined when no size in range works.
 * For espresso with a predicted time, the shot time moves with the grind.
 */
export function suggestGrindUm(input: SimulationInput, lo = 80, hi = 2000): number | undefined {
  const ideal = idealsFor(input);
  const target = (ideal.ey[0] + ideal.ey[1]) / 2;
  const eyAt = (um: number) => extract({ ...input, grind: { ...input.grind, particleUm: um } }).ey;
  let a = lo;
  let b = hi;
  // EY decreases with particle size.
  if (eyAt(a) < target || eyAt(b) > target) return undefined;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    if (eyAt(mid) > target) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/** Dose that brings TDS to the middle of the ideal window (water fixed), by bisection. */
export function suggestDoseG(input: SimulationInput): number | undefined {
  const ideal = idealsFor(input);
  const target = (ideal.tds[0] + ideal.tds[1]) / 2;
  const tdsAt = (dose: number) => extract({ ...input, brew: { ...input.brew, doseG: dose } }).tds;
  let a = input.brew.waterG / 30;
  let b = input.brew.waterG / 1.2;
  if (tdsAt(a) > target || tdsAt(b) < target) return undefined;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    if (tdsAt(mid) < target) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}
