export * from './types';
export { FOAMS, IDEALS, MILKS, MODEL, SYRUPS } from './constants';
export { idealsFor, simulate, suggestGrindUm, suggestDoseG } from './simulate';
export * from './grind';
export { defaultFines } from './physics';
export { simulateShot, weightAt, DEFAULT_PREINFUSION_S, type ShotCurve, type ShotPoint, type ShotPhase } from './shot';

/** Map an Agtron (gourmet scale) reading to the model's 0..1 roast degree. */
export function roastFromAgtron(agtron: number): number {
  // ~95 very light → 0, ~25 very dark → 1
  return Math.min(1, Math.max(0, (95 - agtron) / 70));
}
