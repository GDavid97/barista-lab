import { FLOW } from './constants';
import { clamp, effectiveDiameter, waterViscosity } from './physics';
import type { BeanInput, BrewInput } from './types';

/** CO₂ in very fresh coffee resists flow and wetting. */
function freshnessFlowFactor(days: number | undefined): number {
  if (days === undefined) return 1;
  if (days < 7) return 0.82 + 0.0257 * days;
  return 1;
}

/**
 * Espresso shot time from a Darcy-law flow model.
 * Flow ∝ k·A·ΔP / (μ·L), with k ∝ d_eff² (Kozeny–Carman) and L ∝ dose / A.
 */
export function espressoFlowGs(
  brew: BrewInput,
  bean: BeanInput,
  particleUm: number,
  fines: number,
): number {
  const dEff = effectiveDiameter(particleUm, fines);
  const pressure = brew.pressureBar ?? 9;
  const basket = brew.basketDiameterMm ?? FLOW.refBasketMm;
  const area = Math.pow(basket / FLOW.refBasketMm, 2);
  // Darker roasts are more brittle and porous → slightly more permeable puck.
  const roastFactor = 0.92 + 0.16 * bean.roast;
  return (
    FLOW.refFlowGs *
    Math.pow(dEff / FLOW.refEffectiveUm, 2) *
    (pressure / FLOW.refPressureBar) *
    (area * area) * // A in Darcy, and L = V/A
    (FLOW.refDoseG / brew.doseG) *
    (waterViscosity(FLOW.refTempC) / waterViscosity(brew.tempC)) *
    freshnessFlowFactor(bean.daysOffRoast) *
    roastFactor
  );
}

export function predictEspressoTimeS(
  brew: BrewInput,
  bean: BeanInput,
  particleUm: number,
  fines: number,
): number {
  const q = espressoFlowGs(brew, bean, particleUm, fines);
  const absorbed = FLOW.absorbedPerG * brew.doseG;
  const pre = brew.preinfusionS ?? 0;
  // During pre-infusion the puck is saturated at low pressure: wetting is already done.
  const wetting = pre > 0 ? 0 : FLOW.wettingS + absorbed / (q * 4);
  return clamp(pre + wetting + brew.waterG / q, 3, 300);
}

/** Pour-over total brew time: gravity drawdown slows with fines and bed depth. */
export function predictPouroverTimeS(brew: BrewInput, particleUm: number, fines: number): number {
  const dEff = effectiveDiameter(particleUm, fines);
  return clamp(
    FLOW.pouroverRefTimeS *
      Math.pow(FLOW.pouroverRefEffectiveUm / dEff, 1.3) *
      Math.pow(brew.doseG / FLOW.pouroverRefDoseG, 0.4),
    30,
    900,
  );
}
