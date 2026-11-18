import type { BurrType } from './types';

/** Linear map from a grinder's dial to an estimated median particle size. */
export interface GrindScale {
  /** µm at dial position 0. */
  zeroUm: number;
  /** µm per dial unit (click, number, step). */
  umPerStep: number;
  min: number;
  max: number;
  /** Smallest dial increment (1 for clicks, 0.1 for stepless dials, …). */
  step: number;
}

export interface GrinderProfile {
  id: string;
  name: string;
  burr: BurrType;
  kind: 'manual' | 'electric';
  scale: GrindScale;
  /** True for database values that are rough community estimates. */
  approximate: boolean;
}

export const settingToUm = (scale: GrindScale, setting: number) =>
  Math.max(30, scale.zeroUm + scale.umPerStep * setting);

export function umToSetting(scale: GrindScale, um: number): number {
  const raw = (um - scale.zeroUm) / scale.umPerStep;
  const snapped = Math.round(raw / scale.step) * scale.step;
  return Math.min(scale.max, Math.max(scale.min, Number(snapped.toFixed(3))));
}

/**
 * Two-point calibration: the user tells which dial setting gives a good espresso
 * and which a good pour-over; we map those to typical particle sizes.
 */
export const CALIBRATION_ANCHORS = { espressoUm: 300, pouroverUm: 650 } as const;

export function scaleFromTwoPoints(
  espressoSetting: number,
  pouroverSetting: number,
  base: Pick<GrindScale, 'min' | 'max' | 'step'>,
): GrindScale | undefined {
  if (pouroverSetting === espressoSetting) return undefined;
  const umPerStep =
    (CALIBRATION_ANCHORS.pouroverUm - CALIBRATION_ANCHORS.espressoUm) / (pouroverSetting - espressoSetting);
  if (umPerStep <= 0) return undefined;
  return { ...base, umPerStep, zeroUm: CALIBRATION_ANCHORS.espressoUm - umPerStep * espressoSetting };
}

/** Human-friendly grind category for a particle size. */
export function grindCategory(um: number): 'extraFine' | 'fine' | 'mediumFine' | 'medium' | 'mediumCoarse' | 'coarse' {
  if (um < 200) return 'extraFine';
  if (um < 400) return 'fine';
  if (um < 550) return 'mediumFine';
  if (um < 750) return 'medium';
  if (um < 950) return 'mediumCoarse';
  return 'coarse';
}
