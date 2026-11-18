import { drinkById } from '../data/drinks';
import type { UserBrew } from '../db/schema';
import { simulate, type BurrType, type SimulationInput } from '../engine';
import type { SimState } from '../pages/useBrewSetup';
import { measuredEy } from './journal';

/**
 * Personal calibration learned from the journal.
 *
 * - grindFactor: the grinder's real median particle size is `factor × nominal`.
 *   Fitted per brew so the flow model reproduces the measured shot / brew time.
 * - extractionScale: multiplies extractable solubles so predicted EY matches
 *   refractometer readings.
 *
 * Both are recency-weighted geometric means shrunk towards 1 (no correction),
 * so a single odd measurement cannot swing the model.
 */
export interface Calibration {
  grindFactor: number;
  extractionScale: number;
  /** Brews with a measured time / measured TDS that contributed. */
  nTime: number;
  nTds: number;
  /** 0 (no data) … →1 (many consistent measurements). */
  confidence: number;
}

export const NO_CALIBRATION: Calibration = { grindFactor: 1, extractionScale: 1, nTime: 0, nTds: 0, confidence: 0 };

/** Weight of the "no correction" prior, in brews. */
const PRIOR_WEIGHT = 1;
/** Each older brew counts this much less than the next newer one. */
const RECENCY = 0.85;
const K_RANGE = [0.5, 2] as const;
const S_RANGE = [0.8, 1.2] as const;
/** Only methods where time is driven by the grind are used for the grind factor. */
const TIME_METHODS = new Set(['espresso', 'pourover']);

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/** Engine input for a setup, optionally with a calibration applied. */
export function buildInput(s: SimState, burr: BurrType, cal: Calibration = NO_CALIBRATION): SimulationInput {
  return {
    bean: s.bean,
    grind: { particleUm: s.particleUm * cal.grindFactor, burr },
    brew: { ...s.brew, timeS: s.autoTime ? undefined : s.brew.timeS },
    water: s.waterKnown ? s.water : undefined,
    additions: s.additions,
    target: drinkById(s.drinkId)?.target,
    calibration:
      cal === NO_CALIBRATION
        ? undefined
        : { extractionScale: cal.extractionScale, uncertaintyScale: 1 - 0.5 * cal.confidence },
  };
}

/** Model time with the flow model (ignores any time typed into the recipe). */
function modelTimeS(s: SimState, burr: BurrType, factor: number): number {
  const input = buildInput({ ...s, autoTime: true }, burr);
  input.grind.particleUm = s.particleUm * factor;
  return simulate(input).timeS;
}

/** Grind factor that makes the flow model hit `measuredS` for this brew (bisection; time falls as k grows). */
export function fitGrindFactor(s: SimState, burr: BurrType, measuredS: number): number {
  let [lo, hi] = K_RANGE as unknown as [number, number];
  if (modelTimeS(s, burr, lo) <= measuredS) return lo;
  if (modelTimeS(s, burr, hi) >= measuredS) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = Math.sqrt(lo * hi);
    if (modelTimeS(s, burr, mid) > measuredS) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

function shrunkGeoMean(values: number[]): { value: number; weight: number } {
  let num = 0;
  let w = 0;
  values.forEach((v, i) => {
    const wi = Math.pow(RECENCY, i);
    num += wi * Math.log(v);
    w += wi;
  });
  return { value: Math.exp(num / (w + PRIOR_WEIGHT)), weight: w };
}

export interface CalibrationOptions {
  /** Grinder key of a brew (journal entries from before keys were stored need resolving). */
  keyOf: (b: UserBrew) => string;
  /** Ignore brews created before this timestamp (user reset). */
  resetAt?: number;
}

export function calibrationFrom(brews: UserBrew[], grinderKey: string, opts: CalibrationOptions): Calibration {
  const relevant = brews
    .filter((b) => opts.keyOf(b) === grinderKey && b.createdAt > (opts.resetAt ?? 0))
    .sort((a, b) => b.createdAt - a.createdAt)
    // Older entries carry ~nothing after recency weighting; cap the work.
    .slice(0, 30);

  const ks = relevant
    .filter((b) => TIME_METHODS.has(b.method) && (b.measured.timeS ?? 0) > 0)
    .map((b) => fitGrindFactor(b.setup, b.burr ?? 'conical', b.measured.timeS!));
  const grind = shrunkGeoMean(ks);
  const grindFactor = clamp(grind.value, K_RANGE);

  const scales: number[] = [];
  for (const b of relevant) {
    const ey = measuredEy(b);
    if (ey === undefined) continue;
    const predicted = simulate(buildInput(b.setup, b.burr ?? 'conical', { ...NO_CALIBRATION, grindFactor })).ey;
    if (predicted > 0) scales.push(clamp(ey / predicted, S_RANGE));
  }
  const ext = shrunkGeoMean(scales);

  const weight = Math.max(grind.weight, ext.weight);
  return {
    grindFactor,
    extractionScale: clamp(ext.value, S_RANGE),
    nTime: ks.length,
    nTds: scales.length,
    confidence: weight / (weight + PRIOR_WEIGHT),
  };
}

/* ---------- Reset markers (per grinder key, stored locally) ---------- */

const RESET_KEY = 'baristaLab.calibrationReset.v1';

export function loadResets(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RESET_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function resetCalibration(grinderKey: string): void {
  try {
    const all = loadResets();
    all[grinderKey] = Date.now();
    localStorage.setItem(RESET_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event('baristaLab:calibration'));
  } catch {
    /* ignore */
  }
}
