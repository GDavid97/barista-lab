import type { BrewMethod, CompoundClass, FoamType, MilkType, Range, SyrupType } from './types';

/**
 * All tunable model constants live here. Values were calibrated against
 * reference brews (see __tests__/reference.test.ts) and literature ranges
 * (SCA brewing control chart, double-porosity espresso models).
 */
export const MODEL = {
  /** Thickness of the broken-cell surface layer ≈ one cell (µm). */
  cellSizeUm: 22,
  /** Typical size of the fines peak (µm). */
  finesUm: 40,
  finesFraction: { conical: 0.17, flat: 0.11 } as const,

  /** Effective intra-particle diffusivity at 93 °C, medium roast (m²/s). */
  diffusivityRef: 4e-11,
  /** Activation energy for the diffusivity (J/mol). */
  activationEnergy: 38_000,
  refTempC: 93,

  /** Time constant of the broken-cell washout at the reference temperature (s). */
  tauFastS: 3,
  /** Percolation: water-to-dose ratio scale for fast-fraction washout. */
  washoutRatio: 0.6,
  /** Percolation: driving force ratio/(ratio + k) for intact-cell diffusion. */
  drivingForceK: 0.4,
  /** Immersion: equilibrium limit 1 / (1 + k·dose/water). */
  immersionEquilibriumK: 0.2,

  /** Total extractable solubles as share of dose. */
  solubles: { base: 0.28, perRoast: 0.04, perRobusta: 0.02 },

  /** Water retained in the spent bed per gram of dose (g/g). */
  retention: {
    espresso: 0,
    pourover: 2.0,
    immersion: 2.0,
    aeropress: 1.4,
    moka: 1.3,
    coldbrew: 2.2,
    // Grounds settle in the cup; only the sludge at the bottom is left.
    turkish: 1.2,
    siphon: 2.0,
    clever: 2.0,
  } satisfies Record<BrewMethod, number>,
  /** Moka pot: share of the boiler water that never leaves the base. */
  mokaBoilerResidue: 0.12,

  /** Effective brew temperature for moka (water reaches near-boiling under pressure). */
  mokaEffectiveTempC: 98,
  /** Effective contact-time multiplier for the stirred siphon slurry. */
  siphonAgitation: 1.5,
  /** Effective contact time for moka (s) when not given. */
  mokaContactS: 60,
} as const;

/** Relative diffusivity of each compound class (small acids fast, astringent polymers slow). */
export const CLASS_DIFFUSIVITY: Record<CompoundClass, number> = {
  acids: 3.5,
  sweet: 1.2,
  bitter: 0.5,
  astringent: 0.15,
};

/** Caffeine is small and very soluble. */
export const CAFFEINE_DIFFUSIVITY = 2.3;
/** Caffeine content of roasted beans, mass fraction. */
export const CAFFEINE_CONTENT = { arabica: 0.012, robusta: 0.022 } as const;

/** Espresso flow model reference (Darcy / Kozeny–Carman, calibrated). */
export const FLOW = {
  /** Mean flow at the reference conditions (g/s). */
  refFlowGs: 1.65,
  refEffectiveUm: 142,
  refPressureBar: 9,
  refDoseG: 18,
  refBasketMm: 58,
  refTempC: 93,
  /** Seconds before the first drops at full pressure (headspace fill, puck wetting). */
  wettingS: 3,
  /** Water absorbed by the puck per gram of dose (g/g). */
  absorbedPerG: 1.1,
  /** Pour-over: reference total brew time (s) for 15 g at the reference effective size. */
  pouroverRefTimeS: 180,
  pouroverRefEffectiveUm: 236,
  pouroverRefDoseG: 15,
} as const;

/** Target windows per method. EY in %, TDS in %, time in s. */
export const IDEALS: Record<BrewMethod, { ey: Range; tds: Range; time?: Range }> = {
  espresso: { ey: [18, 22], tds: [8, 12], time: [24, 33] },
  pourover: { ey: [18, 22], tds: [1.15, 1.45], time: [150, 240] },
  immersion: { ey: [18, 22], tds: [1.15, 1.45] },
  aeropress: { ey: [18, 22], tds: [1.2, 1.6] },
  moka: { ey: [18, 22], tds: [2.5, 5] },
  coldbrew: { ey: [15, 20], tds: [1.2, 2.0] },
  // Powder-fine, boiled and unfiltered: near-complete extraction is the style.
  turkish: { ey: [24, 30], tds: [2.2, 3.4] },
  siphon: { ey: [18, 22], tds: [1.15, 1.45] },
  clever: { ey: [18, 22], tds: [1.15, 1.45] },
};

export interface MilkProfile {
  kcalPer100ml: number;
  /** Perceived sweetness contribution, 0..1. */
  sweetness: number;
  /** Body / mouthfeel contribution, 0..1. */
  body: number;
  /** How strongly fat/protein masks bitterness and acidity, 0..1. */
  masking: number;
}

export interface FoamProfile {
  /** Volume of steamed milk relative to the cold milk poured in. */
  volume: number;
  /** Mouthfeel added per unit milk share. */
  body: number;
}

export const FOAMS: Record<FoamType, FoamProfile> = {
  none: { volume: 1, body: 0 },
  silky: { volume: 1.15, body: 1 },
  airy: { volume: 1.6, body: 0.5 },
};

export interface SyrupProfile {
  kcalPerMl: number;
  /** Sugar equivalent (g per ml). */
  sugarPerMl: number;
  /** Extra body per unit share of the drink. */
  body: number;
  /** i18n key under notes.* */
  note: string;
}

/** Typical café syrups (~100 kcal / 30 ml) and chocolate sauce. */
export const SYRUPS: Record<SyrupType, SyrupProfile> = {
  vanilla: { kcalPerMl: 3.3, sugarPerMl: 0.83, body: 0, note: 'vanilla' },
  caramel: { kcalPerMl: 3.3, sugarPerMl: 0.83, body: 0.5, note: 'caramelSyrup' },
  hazelnut: { kcalPerMl: 3.3, sugarPerMl: 0.83, body: 0, note: 'hazelnut' },
  chocolate: { kcalPerMl: 3.6, sugarPerMl: 0.7, body: 3, note: 'chocolateSauce' },
};

export const MILKS: Record<MilkType, MilkProfile> = {
  whole: { kcalPer100ml: 64, sweetness: 0.55, body: 0.8, masking: 0.8 },
  semi: { kcalPer100ml: 46, sweetness: 0.5, body: 0.55, masking: 0.6 },
  skim: { kcalPer100ml: 35, sweetness: 0.45, body: 0.3, masking: 0.4 },
  oat: { kcalPer100ml: 59, sweetness: 0.75, body: 0.7, masking: 0.65 },
  almond: { kcalPer100ml: 24, sweetness: 0.3, body: 0.3, masking: 0.35 },
  soy: { kcalPer100ml: 42, sweetness: 0.35, body: 0.6, masking: 0.55 },
};
