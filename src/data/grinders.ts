import type { BurrType, GrinderProfile, GrindScale } from '../engine';

/**
 * Grinder presets.
 *
 * Instead of guessing "µm per click", each scale is derived from two settings
 * that are commonly used on that grinder (a typical espresso and a typical V60
 * or other filter setting), mapped to the median particle sizes the model uses
 * for those brews. Every preset is approximate: units vary between batches and
 * after re-zeroing, so the two-point calibration under "My bar" (or a few logged
 * shot times) will always be more accurate.
 */

export type GrinderCategory = 'manual' | 'electric' | 'builtin';

export interface GrinderPreset extends GrinderProfile {
  category: GrinderCategory;
  /** Filter-only grinder: cannot reach espresso fineness. */
  noEspresso?: boolean;
  /** Espresso-only grinder (e.g. built into a machine): cannot go coarse enough for filter. */
  noFilter?: boolean;
}

/** Linear dial map through two (setting, µm) anchor points. */
function fromAnchors(a: [number, number], b: [number, number], range: Pick<GrindScale, 'min' | 'max' | 'step'>): GrindScale {
  const umPerStep = (b[1] - a[1]) / (b[0] - a[0]);
  return { ...range, umPerStep, zeroUm: a[1] - umPerStep * a[0] };
}

/** Anchor sizes the model uses for a classic espresso, V60 and French press. */
const ESPRESSO = 300;
const V60 = 650;
const FRENCH = 1000;

function preset(
  id: string,
  name: string,
  burr: BurrType,
  category: GrinderCategory,
  scale: GrindScale,
  extra: Partial<GrinderPreset> = {},
): GrinderPreset {
  return { id, name, burr, kind: category === 'manual' ? 'manual' : 'electric', scale, approximate: true, category, ...extra };
}

export const GRINDERS: GrinderPreset[] = [
  /* ---------- Hand grinders ---------- */
  preset('comandante-c40', 'Comandante C40', 'conical', 'manual', { zeroUm: 0, umPerStep: 30, min: 0, max: 40, step: 1 }),
  preset('1zpresso-jx-pro', '1Zpresso JX-Pro', 'conical', 'manual', { zeroUm: 0, umPerStep: 12.5, min: 0, max: 200, step: 1 }),
  preset('1zpresso-j-ultra', '1Zpresso J-Ultra', 'conical', 'manual', fromAnchors([25, ESPRESSO], [75, V60], { min: 0, max: 120, step: 1 })),
  preset('kingrinder-k6', 'Kingrinder K6', 'conical', 'manual', fromAnchors([45, ESPRESSO], [100, V60], { min: 0, max: 240, step: 1 })),
  preset('timemore-c2', 'Timemore C2', 'conical', 'manual', { zeroUm: 60, umPerStep: 36, min: 0, max: 36, step: 1 }),
  preset('timemore-c3', 'Timemore Chestnut C3', 'conical', 'manual', fromAnchors([8, ESPRESSO], [16, V60], { min: 0, max: 36, step: 1 })),
  preset('hario-skerton-pro', 'Hario Skerton Pro', 'conical', 'manual', fromAnchors([3, ESPRESSO], [9, V60], { min: 0, max: 16, step: 1 })),

  /* ---------- Electric grinders ---------- */
  // Turin DF64 / DF54: stepless dial 0–90; espresso usually low teens to ~20 after zeroing.
  preset('df64', 'Turin DF64', 'flat', 'electric', fromAnchors([15, ESPRESSO], [55, V60], { min: 0, max: 90, step: 0.5 })),
  preset('df54', 'Turin DF54', 'flat', 'electric', fromAnchors([20, ESPRESSO], [60, V60], { min: 0, max: 90, step: 0.5 })),
  preset('niche-zero', 'Niche Zero', 'conical', 'electric', { zeroUm: 100, umPerStep: 13, min: 0, max: 50, step: 0.5 }),
  preset('eureka-mignon', 'Eureka Mignon (stepless)', 'flat', 'electric', { zeroUm: 150, umPerStep: 50, min: 0, max: 20, step: 0.25 }),
  preset('baratza-encore', 'Baratza Encore', 'conical', 'electric', { zeroUm: 250, umPerStep: 25, min: 1, max: 40, step: 1 }),
  preset('baratza-encore-esp', 'Baratza Encore ESP', 'conical', 'electric', fromAnchors([10, ESPRESSO], [27, V60], { min: 1, max: 40, step: 1 })),
  preset('fellow-opus', 'Fellow Opus', 'conical', 'electric', fromAnchors([2, ESPRESSO], [6, V60], { min: 1, max: 11, step: 0.333 })),
  // Filter-only: anchored on V60 and French press.
  preset('fellow-ode-2', 'Fellow Ode Gen 2', 'flat', 'electric', fromAnchors([3.5, V60], [9.5, FRENCH], { min: 1, max: 11, step: 0.333 }), {
    noEspresso: true,
  }),
  preset('sage-smart-grinder-pro', 'Sage / Breville Smart Grinder Pro', 'conical', 'electric', fromAnchors([10, ESPRESSO], [38, V60], { min: 1, max: 60, step: 1 })),

  /* ---------- Built into an espresso machine ---------- */
  preset('sage-barista-express', 'Sage / Breville Barista Express', 'conical', 'builtin', fromAnchors([6, ESPRESSO], [16, 480], { min: 1, max: 16, step: 1 }), {
    noFilter: true,
  }),
  preset('delonghi-kg521', "De'Longhi Dedica KG521", 'conical', 'builtin', fromAnchors([3, ESPRESSO], [11, V60], { min: 1, max: 18, step: 1 })),
];

export const grinderById = (id: string) => GRINDERS.find((g) => g.id === id);
