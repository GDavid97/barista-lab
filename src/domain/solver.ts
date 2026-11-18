import { idealsFor, settingToUm, simulate, umToSetting, type BurrType, type GrindScale, type SimulationResult } from '../engine';
import type { SimState } from '../pages/useBrewSetup';
import { buildInput, NO_CALIBRATION, type Calibration } from './calibration';

/**
 * Recipe solver ("inverse design"): given target EY and TDS and a fixed dose,
 * find grind, water / yield and temperature.
 *
 * TDS is driven mostly by the ratio and EY mostly by the grind, so the two are
 * solved alternately by bisection until they agree. For espresso the shot-time
 * window is a hard preference: temperature is then varied so a grind that hits
 * the EY target also lands inside the window.
 */

export type TasteGoal = 'balanced' | 'sweeter' | 'brighter' | 'fuller' | 'lighter' | 'intense';
export const TASTE_GOALS: TasteGoal[] = ['balanced', 'sweeter', 'brighter', 'fuller', 'lighter', 'intense'];

export interface SolveTarget {
  ey: number;
  tds: number;
}

/** Map a taste goal onto the drink's own EY/TDS windows. */
export function goalTarget(goal: TasteGoal, s: SimState, burr: BurrType): SolveTarget {
  const ideal = idealsFor(buildInput(s, burr));
  const [eLo, eHi] = ideal.ey;
  const [tLo, tHi] = ideal.tds;
  const eMid = (eLo + eHi) / 2;
  const tMid = (tLo + tHi) / 2;
  const tSpan = tHi - tLo;
  switch (goal) {
    case 'balanced':
      return { ey: eMid, tds: tMid };
    // Sweetness peaks mid-window; a touch higher EY trims the sharp acids.
    case 'sweeter':
      return { ey: eMid + 0.7, tds: tMid };
    case 'brighter':
      return { ey: eLo + 0.6, tds: tMid };
    case 'fuller':
      return { ey: eMid, tds: tHi - tSpan * 0.1 };
    case 'lighter':
      return { ey: eMid, tds: tLo + tSpan * 0.1 };
    case 'intense':
      return { ey: eHi - 0.6, tds: tHi - tSpan * 0.1 };
  }
}

export interface SolveOptions {
  burr: BurrType;
  cal?: Calibration;
  /** Dial scale of the grinder; the grind is snapped to a real setting. */
  scale?: GrindScale;
  /** Keep the current temperature instead of choosing one. */
  lockTemp?: boolean;
}

export type SolveNote = 'grindLimit' | 'ratioLimit' | 'timeWindow' | 'snapped';

export interface SolveResult {
  state: SimState;
  result: SimulationResult;
  target: SolveTarget;
  /** Hit both targets (and, for espresso, the time window). */
  feasible: boolean;
  notes: SolveNote[];
}

const TEMP_RANGE: Record<string, [number, number]> = {
  espresso: [88, 96],
  coldbrew: [2, 25],
  moka: [90, 90],
};

/** Starting temperature: hotter for light roasts, cooler for dark ones. */
function roastTemp(s: SimState): number {
  if (s.brew.method === 'coldbrew' || s.brew.method === 'moka') return s.brew.tempC;
  if (s.brew.method === 'turkish') return 96;
  return Math.round((96.5 - 6 * s.bean.roast) * 2) / 2;
}

function bisect(f: (x: number) => number, target: number, lo: number, hi: number, decreasing: boolean) {
  const fl = f(lo);
  const fh = f(hi);
  const [fmin, fmax] = decreasing ? [fh, fl] : [fl, fh];
  if (target <= fmin) return { x: decreasing ? hi : lo, clamped: target < fmin - 1e-9 };
  if (target >= fmax) return { x: decreasing ? lo : hi, clamped: target > fmax + 1e-9 };
  let a = lo;
  let b = hi;
  for (let i = 0; i < 36; i++) {
    const m = (a + b) / 2;
    const above = f(m) > target;
    if (above === decreasing) a = m;
    else b = m;
  }
  return { x: (a + b) / 2, clamped: false };
}

function solveAt(s0: SimState, target: SolveTarget, tempC: number, o: Required<Pick<SolveOptions, 'burr'>> & SolveOptions) {
  const cal = o.cal ?? NO_CALIBRATION;
  const espresso = s0.brew.method === 'espresso';
  const dose = s0.brew.doseG;
  const ratioRange: [number, number] = espresso ? [1, 4] : s0.brew.method === 'turkish' ? [6, 16] : [4, 25];
  let s: SimState = { ...s0, brew: { ...s0.brew, tempC } };
  const sim = (st: SimState) => simulate(buildInput(st, o.burr, cal));
  let grindClamped = false;
  let ratioClamped = false;

  for (let i = 0; i < 5; i++) {
    // Ratio → TDS (TDS falls as water grows).
    const w = bisect((water) => sim({ ...s, brew: { ...s.brew, waterG: water } }).tds, target.tds, dose * ratioRange[0], dose * ratioRange[1], true);
    ratioClamped = w.clamped;
    s = { ...s, brew: { ...s.brew, waterG: w.x } };
    // Grind → EY (EY falls as particles grow). Nominal µm; calibration applies inside.
    const g = bisect((um) => sim({ ...s, particleUm: um }).ey, target.ey, 80, 2200, true);
    grindClamped = g.clamped;
    s = { ...s, particleUm: g.x };
  }
  return { s, grindClamped, ratioClamped };
}

export function solveRecipe(current: SimState, target: SolveTarget, o: SolveOptions): SolveResult {
  const method = current.brew.method;
  const espresso = method === 'espresso';
  // The solver owns time for methods where it is predicted from the grind.
  const s0: SimState = { ...current, autoTime: espresso || method === 'pourover' ? true : current.autoTime };
  const cal = o.cal ?? NO_CALIBRATION;
  const sim = (st: SimState) => simulate(buildInput(st, o.burr, cal));
  const notes: SolveNote[] = [];

  const start = o.lockTemp ? current.brew.tempC : roastTemp(current);
  const [tMin, tMax] = TEMP_RANGE[method] ?? [86, 97];
  // Candidate temperatures: preferred first, then outwards in 1 °C steps.
  const temps = o.lockTemp ? [start] : [start, ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((d) => [start + d, start - d])].filter((x) => x >= tMin && x <= tMax);

  let best: { s: SimState; grindClamped: boolean; ratioClamped: boolean; miss: number } | undefined;
  for (const temp of temps) {
    const r = solveAt(s0, target, temp, { ...o, burr: o.burr });
    const res = sim(r.s);
    const window = idealsFor(buildInput(r.s, o.burr, cal)).time;
    const miss = espresso && window ? Math.max(0, window[0] - res.timeS, res.timeS - window[1]) : 0;
    if (!best || miss < best.miss) best = { ...r, miss };
    if (miss === 0) break;
  }
  let s = best!.s;
  if (best!.grindClamped) notes.push('grindLimit');
  if (best!.ratioClamped) notes.push('ratioLimit');
  if (best!.miss > 0) notes.push('timeWindow');

  // Snap to something you can actually set: dial step, whole grams, half degrees.
  if (o.scale) {
    const setting = umToSetting(o.scale, s.particleUm);
    const snapped = settingToUm(o.scale, setting);
    if (Math.abs(snapped - s.particleUm) > 1) notes.push('snapped');
    s = { ...s, particleUm: snapped };
  } else {
    s = { ...s, particleUm: Math.round(s.particleUm / 5) * 5 };
  }
  s = {
    ...s,
    brew: { ...s.brew, waterG: Math.round(s.brew.waterG), tempC: Math.round(s.brew.tempC * 2) / 2 },
  };

  const result = sim(s);
  const tdsTol = Math.max(0.03, target.tds * 0.05);
  const feasible =
    !notes.includes('grindLimit') &&
    !notes.includes('ratioLimit') &&
    !notes.includes('timeWindow') &&
    // A coarse dial can only get so close; allow the error of one step.
    Math.abs(result.ey - target.ey) < (o.scale ? 1 : 0.4) &&
    Math.abs(result.tds - target.tds) < tdsTol * (o.scale ? 2 : 1);
  return { state: s, result, target, feasible, notes };
}
