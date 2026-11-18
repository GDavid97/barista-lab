import { FLOW } from './constants';
import { espressoFlowGs } from './flow';
import { defaultFines } from './physics';
import type { PressureProfile, SimulationInput } from './types';

/**
 * Time-resolved espresso shot.
 *
 * Phases:
 *  1. headspace – the pump fills the group (no flow into the cup);
 *  2. wetting   – water soaks into the puck (absorbed ≈ 1.1 × dose) before the first drops;
 *  3. extraction – beverage flows; Darcy flow ∝ pressure, rising slightly as the puck erodes.
 *
 * For the flat 9-bar profile this integrates to exactly the closed-form
 * `predictEspressoTimeS`, so calibration and tests built on it still hold.
 */

export interface ShotPoint {
  t: number;
  /** Pressure at the puck (bar). */
  p: number;
  /** Flow into the cup (g/s). */
  q: number;
  /** Beverage weight in the cup (g). */
  w: number;
}

export type ShotPhaseKind = 'preinfuse' | 'bloom' | 'ramp' | 'extract';

export interface ShotPhase {
  kind: ShotPhaseKind;
  startS: number;
  endS: number;
}

export interface ShotCurve {
  profile: PressureProfile;
  points: ShotPoint[];
  timeS: number;
  firstDropS: number;
  peakBar: number;
  phases: ShotPhase[];
}

const DT = 0.05;
const SAMPLE = 0.25;
const MAX_S = 180;
/** Puck erosion: flow runs at 85 % of nominal at the start and 115 % at the end (mean ≈ 1). */
const EROSION = [0.85, 0.3] as const;
/** Spring-lever and declining profiles end at these pressures. */
const DECLINE_END_BAR = { declining: 6, lever: 4 } as const;
const PREINFUSE_BAR = 3;
const LEVER_PREINFUSE_BAR = 1.2;
const BLOOM_PAUSE_S = 10;
const RAMP_S = 2;

export const DEFAULT_PREINFUSION_S: Record<PressureProfile, number> = {
  flat: 0,
  preinfusion: 8,
  blooming: 6,
  declining: 0,
  lever: 6,
};

/** Pressure (bar) at time t, given the beverage fraction already in the cup. */
function pressureAt(profile: PressureProfile, t: number, yieldFrac: number, peak: number, pi: number): number {
  const ramp = (from: number, t0: number) => Math.min(peak, from + ((peak - from) * (t - t0)) / RAMP_S);
  switch (profile) {
    case 'flat':
      return peak;
    case 'preinfusion':
      return t < pi ? PREINFUSE_BAR : ramp(PREINFUSE_BAR, pi);
    case 'blooming':
      if (t < pi) return PREINFUSE_BAR;
      if (t < pi + BLOOM_PAUSE_S) return 0;
      return ramp(0, pi + BLOOM_PAUSE_S);
    case 'declining': {
      const end = Math.min(peak, DECLINE_END_BAR.declining);
      return yieldFrac < 0.35 ? peak : peak - ((peak - end) * (yieldFrac - 0.35)) / 0.65;
    }
    case 'lever': {
      if (t < pi) return LEVER_PREINFUSE_BAR;
      const end = Math.min(peak, DECLINE_END_BAR.lever);
      // The spring releases at full pressure and relaxes as the piston travels.
      return Math.max(end, ramp(LEVER_PREINFUSE_BAR, pi) - (peak - end) * yieldFrac);
    }
  }
}

export function simulateShot(input: SimulationInput): ShotCurve | undefined {
  const { brew, bean, grind } = input;
  if (brew.method !== 'espresso') return undefined;
  const profile = brew.profile ?? 'flat';
  const peak = brew.pressureBar ?? 9;
  const pi = brew.preinfusionS ?? DEFAULT_PREINFUSION_S[profile];
  const fines = grind.finesFraction ?? defaultFines(grind.burr, Math.max(30, grind.particleUm));
  // Nominal flow at the reference 9 bar for this puck.
  const q9 = espressoFlowGs({ ...brew, pressureBar: FLOW.refPressureBar }, bean, grind.particleUm, fines);
  const absorbed = FLOW.absorbedPerG * brew.doseG;
  const target = brew.waterG;
  // Pre-infusing profiles fill the headspace during the low-pressure phase.
  const headspaceS = profile === 'flat' || profile === 'declining' ? FLOW.wettingS : 0;

  const points: ShotPoint[] = [];
  let t = 0;
  let soaked = 0;
  let w = 0;
  let firstDropS = -1;
  let nextSample = 0;
  let p = 0;
  let q = 0;
  while (w < target && t < MAX_S) {
    const yf = w / target;
    p = pressureAt(profile, t, yf, peak, pi);
    const drive = p / FLOW.refPressureBar;
    q = 0;
    if (t >= headspaceS) {
      if (soaked < absorbed) {
        // Wetting flows ~4× faster than extraction (dry, open bed).
        soaked += 4 * q9 * drive * DT;
      } else {
        if (firstDropS < 0) firstDropS = t;
        q = q9 * drive * (EROSION[0] + EROSION[1] * yf);
        w += q * DT;
      }
    }
    if (t >= nextSample) {
      // Display ramp: show the pump building pressure during the headspace fill.
      const shownP = t < headspaceS ? (p * t) / headspaceS : p;
      points.push({ t: round(t), p: round(shownP), q: round(q), w: round(Math.min(w, target)) });
      nextSample += SAMPLE;
    }
    t += DT;
  }
  const timeS = round(t);
  points.push({ t: timeS, p: round(p), q: round(q), w: round(Math.min(w, target)) });
  if (firstDropS < 0) firstDropS = timeS;

  const phases: ShotPhase[] = [];
  if (profile === 'preinfusion' || profile === 'lever') phases.push({ kind: 'preinfuse', startS: 0, endS: Math.min(pi, timeS) });
  if (profile === 'blooming') {
    phases.push({ kind: 'preinfuse', startS: 0, endS: Math.min(pi, timeS) });
    phases.push({ kind: 'bloom', startS: Math.min(pi, timeS), endS: Math.min(pi + BLOOM_PAUSE_S, timeS) });
  }
  const extractStart = phases.length ? phases[phases.length - 1]!.endS : 0;
  phases.push({ kind: 'extract', startS: extractStart, endS: timeS });

  return { profile, points, timeS, firstDropS: round(firstDropS), peakBar: peak, phases };
}

/** Expected beverage weight at time t on a shot curve (linear interpolation). */
export function weightAt(curve: ShotCurve, t: number): number {
  const pts = curve.points;
  if (t <= 0) return 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (t <= b.t) return a.w + ((b.w - a.w) * (t - a.t)) / Math.max(1e-6, b.t - a.t);
  }
  return pts[pts.length - 1]!.w;
}

const round = (v: number) => Math.round(v * 100) / 100;
