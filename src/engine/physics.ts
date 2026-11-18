import { MODEL } from './constants';
import type { BurrType } from './types';

const R = 8.314;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fraction released from a sphere by Fickian diffusion (Crank, eq. 6.20),
 * x = D·t / r². Uses the short-time expansion where the series converges slowly.
 */
export function sphereRelease(x: number): number {
  if (x <= 0) return 0;
  if (x < 0.01) return 6 * Math.sqrt(x / Math.PI) - 3 * x;
  let sum = 0;
  for (let n = 1; n <= 50; n++) {
    const term = Math.exp(-n * n * Math.PI * Math.PI * x) / (n * n);
    sum += term;
    if (term < 1e-12) break;
  }
  return clamp(1 - (6 / (Math.PI * Math.PI)) * sum, 0, 1);
}

/** Arrhenius scaling of a rate relative to the reference temperature. */
export function arrhenius(tempC: number, refC: number = MODEL.refTempC, ea: number = MODEL.activationEnergy): number {
  const t = tempC + 273.15;
  const ref = refC + 273.15;
  return Math.exp((-ea / R) * (1 / t - 1 / ref));
}

/** Water dynamic viscosity (mPa·s), Vogel equation. */
export function waterViscosity(tempC: number): number {
  const t = tempC + 273.15;
  return 0.02414 * Math.pow(10, 247.8 / (t - 140));
}

/** Fraction of a particle's volume made of cells broken open by grinding. */
export function brokenCellFraction(particleUm: number, cellUm: number = MODEL.cellSizeUm): number {
  if (particleUm <= 2 * cellUm) return 1;
  return 1 - Math.pow(1 - (2 * cellUm) / particleUm, 3);
}

/**
 * Default fines fraction: set by the burr geometry at espresso fineness (~300 µm)
 * and shrinking for coarser settings.
 */
export function defaultFines(burr: BurrType, particleUm: number): number {
  return clamp(MODEL.finesFraction[burr] * Math.sqrt(300 / particleUm), 0.04, 0.3);
}

/**
 * Surface-weighted (Sauter-like) mean diameter of the bimodal distribution:
 * fines dominate permeability.
 */
export function effectiveDiameter(particleUm: number, fines: number): number {
  return 1 / (fines / MODEL.finesUm + (1 - fines) / particleUm);
}

/** Relative solubility of the extractable material with temperature (cold extracts less). */
export function solubilityTempFactor(tempC: number): number {
  return clamp(0.72 + (0.28 * (tempC - 20)) / 73, 0.68, 1.05);
}
