import { umToSetting, type GrindScale } from '../engine';

/**
 * Beginner-friendly language for grind size. The model works in microns, but a
 * home barista thinks in "my grinder's setting" and "it should look like sugar".
 */

export type GuideId = 'turkish' | 'espresso' | 'moka' | 'aeropress' | 'pourover' | 'chemex' | 'frenchPress' | 'coldBrew';

/** Typical median-size windows (µm) per brew style. They overlap on purpose. */
export const GRIND_RANGES: Record<GuideId, [number, number]> = {
  turkish: [80, 200],
  espresso: [220, 380],
  moka: [380, 520],
  aeropress: [450, 650],
  pourover: [550, 780],
  chemex: [700, 950],
  frenchPress: [850, 1200],
  coldBrew: [950, 1350],
};

/** Non-overlapping bands for the visual scale (µm upper edges). */
export const GUIDE_BANDS: { id: GuideId; to: number }[] = [
  { id: 'turkish', to: 200 },
  { id: 'espresso', to: 380 },
  { id: 'moka', to: 500 },
  { id: 'aeropress', to: 600 },
  { id: 'pourover', to: 780 },
  { id: 'chemex', to: 950 },
  { id: 'frenchPress', to: 1200 },
  { id: 'coldBrew', to: 1400 },
];
export const SCALE_MIN_UM = 80;
export const SCALE_MAX_UM = 1400;

const DRINK_GUIDE: Record<string, GuideId> = {
  ristretto: 'espresso',
  espresso: 'espresso',
  lungo: 'espresso',
  americano: 'espresso',
  cappuccino: 'espresso',
  latte: 'espresso',
  flatWhite: 'espresso',
  cortado: 'espresso',
  macchiato: 'espresso',
  mocha: 'espresso',
  v60: 'pourover',
  clever: 'pourover',
  siphon: 'aeropress',
  chemex: 'chemex',
  frenchPress: 'frenchPress',
  aeropress: 'aeropress',
  moka: 'moka',
  coldBrew: 'coldBrew',
  turkish: 'turkish',
};

export const guideForDrink = (drinkId: string): GuideId => DRINK_GUIDE[drinkId] ?? 'pourover';

/** Everyday texture comparison (i18n key under `grindTextures.*`). */
export type Texture = 'flour' | 'powderedSugar' | 'fineSalt' | 'sugar' | 'coarseSalt' | 'seaSalt';

export function textureOf(um: number): Texture {
  if (um < 200) return 'flour';
  if (um < 400) return 'powderedSugar';
  if (um < 550) return 'fineSalt';
  if (um < 750) return 'sugar';
  if (um < 950) return 'coarseSalt';
  return 'seaSalt';
}

/** Position on the visual scale, 0 … 1 (log scale reads better across 80–1400 µm). */
export function scalePos(um: number): number {
  const lo = Math.log(SCALE_MIN_UM);
  const hi = Math.log(SCALE_MAX_UM);
  return Math.min(1, Math.max(0, (Math.log(Math.max(1, um)) - lo) / (hi - lo)));
}

/**
 * Recommended dial window for a brew style on a given grinder: the typical middle
 * 60 % of the style's window. Undefined when the grinder cannot reach that style.
 */
export function settingRange(scale: GrindScale, id: GuideId): [number, number] | undefined {
  const [lo, hi] = GRIND_RANGES[id];
  const w = hi - lo;
  const tLo = lo + 0.2 * w;
  const tHi = hi - 0.2 * w;
  const center = (lo + hi) / 2;
  const minUm = scale.zeroUm + scale.umPerStep * scale.min;
  const maxUm = scale.zeroUm + scale.umPerStep * scale.max;
  if (center < minUm - 15 || center > maxUm + 15) return undefined;
  const a = umToSetting(scale, tLo);
  const b = umToSetting(scale, tHi);
  return a <= b ? [a, b] : [b, a];
}

/** Where the current grind sits relative to the window for this drink. */
export function fitFor(um: number, id: GuideId): 'tooFine' | 'ok' | 'tooCoarse' {
  const [lo, hi] = GRIND_RANGES[id];
  if (um < lo) return 'tooFine';
  if (um > hi) return 'tooCoarse';
  return 'ok';
}

/** Short dial text, e.g. "8–12" (one decimal for fine-stepped dials); pass a locale formatter for "9,5". */
export function formatRange(
  [a, b]: [number, number],
  step: number,
  format: (n: number, digits: number) => string = (n, d) => Number(n.toFixed(d)).toString(),
): string {
  const d = step < 1 ? 1 : 0;
  const f = (v: number) => (Number.isInteger(Number(v.toFixed(d))) ? format(v, 0) : format(v, d));
  return a === b ? f(a) : `${f(a)}–${f(b)}`;
}
