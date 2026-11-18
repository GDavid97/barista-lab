/** Brewing method families the physics model distinguishes. */
export type BrewMethod =
  | 'espresso'
  | 'pourover'
  | 'immersion'
  | 'aeropress'
  | 'moka'
  | 'coldbrew'
  /** Cezve / ibrik: very fine, near-boiling, unfiltered. */
  | 'turkish'
  /** Vacuum pot: short, stirred, hot immersion. */
  | 'siphon'
  /** Clever-style dripper: steep, then drain through paper. */
  | 'clever';

export type Process = 'washed' | 'natural' | 'honey' | 'anaerobic' | 'wetHulled';
/** 'none' = unfiltered (Turkish coffee). */
export type FilterType = 'paper' | 'metal' | 'cloth' | 'none';
export type BurrType = 'conical' | 'flat';
export type MilkType = 'whole' | 'semi' | 'skim' | 'oat' | 'almond' | 'soy';
/**
 * Espresso pressure profile:
 * flat 9 bar · low-pressure pre-infusion · "blooming" (soak, pause, full pressure) ·
 * declining towards the end · spring lever.
 */
export type PressureProfile = 'flat' | 'preinfusion' | 'blooming' | 'declining' | 'lever';
export type FoamType = 'none' | 'silky' | 'airy';
export type SyrupType = 'vanilla' | 'caramel' | 'hazelnut' | 'chocolate';

export interface BeanInput {
  /** Share of robusta in the blend, 0..1 (rest is arabica). */
  robustaShare: number;
  /** Roast degree 0 (very light) .. 1 (very dark). See `roastFromAgtron`. */
  roast: number;
  process: Process;
  /** Growing altitude in metres (affects density / acidity). */
  altitudeM?: number;
  /** Days since roast date. */
  daysOffRoast?: number;
}

export interface GrindInput {
  /** Estimated median particle size in micrometres. */
  particleUm: number;
  burr: BurrType;
  /** Mass fraction of fines (<~100 µm). Defaults from burr type. */
  finesFraction?: number;
}

export interface BrewInput {
  method: BrewMethod;
  doseG: number;
  /**
   * Espresso / moka: beverage yield in the cup (g).
   * All other methods: total brew water (g).
   */
  waterG: number;
  tempC: number;
  /**
   * Contact / shot time in seconds. For espresso and pour-over it is predicted
   * from grind and dose when omitted; for immersion methods it is required (defaults apply).
   */
  timeS?: number;
  /** Peak pump pressure (bar). */
  pressureBar?: number;
  preinfusionS?: number;
  /** Espresso only. Undefined = classic closed-form flat-pressure estimate. */
  profile?: PressureProfile;
  basketDiameterMm?: number;
  filter: FilterType;
}

export interface WaterInput {
  /** General hardness as ppm CaCO3. */
  ghPpm?: number;
  /** Carbonate hardness / alkalinity as ppm CaCO3. */
  khPpm?: number;
}

export interface Additions {
  milkMl?: number;
  milkType?: MilkType;
  /** Steamed texture: silky microfoam (latte, flat white) or airy foam (cappuccino). */
  foam?: FoamType;
  /** Steamed milk temperature (°C); sweetness peaks around 55–65 °C. */
  milkTempC?: number;
  /** Hot water added after brewing (americano, long black). */
  waterMl?: number;
  sugarG?: number;
  syrup?: { type: SyrupType; ml: number };
}

/** Per-drink override of the method's target windows (e.g. ristretto, lungo). */
export interface TargetOverride {
  ey?: Range;
  tds?: Range;
  time?: Range;
}

/** Personal calibration learned from the user's own measurements. */
export interface CalibrationInput {
  /** Multiplies the extractable solubles (learned from refractometer readings). */
  extractionScale?: number;
  /** Multiplies the reported EY uncertainty (narrower once calibrated). */
  uncertaintyScale?: number;
}

export interface SimulationInput {
  target?: TargetOverride;
  calibration?: CalibrationInput;
  bean: BeanInput;
  grind: GrindInput;
  brew: BrewInput;
  water?: WaterInput;
  additions?: Additions;
}

/** Soluble compound groups tracked by the model. */
export type CompoundClass = 'acids' | 'sweet' | 'bitter' | 'astringent';

export type Range = readonly [number, number];

export type ExtractionLevel = 'under' | 'ideal' | 'over';
export type StrengthLevel = 'weak' | 'ideal' | 'strong';
export type BalanceLabel = 'sour' | 'bright' | 'balanced' | 'sweet' | 'bitter' | 'harsh';

export interface SensoryProfile {
  /** All 0..10. */
  acidity: number;
  sweetness: number;
  bitterness: number;
  body: number;
  astringency: number;
  aftertaste: number;
  aroma: number;
}

export type DiagnosisSeverity = 'info' | 'warn' | 'bad';

export interface Diagnosis {
  /** i18n key under `diag.*`. */
  key: string;
  severity: DiagnosisSeverity;
  params?: Record<string, string | number>;
}

export interface SimulationResult {
  method: BrewMethod;
  /** Extraction yield, % of dose. */
  ey: number;
  /** ± uncertainty of EY in percentage points. */
  eyUncertainty: number;
  /** Total dissolved solids of the brewed coffee (before milk / water), %. */
  tds: number;
  /** Coffee strength in the final drink after additions, %. */
  finalTds: number;
  beverageG: number;
  finalVolumeMl: number;
  /** Contact / shot time actually used by the model (s). */
  timeS: number;
  /** True when timeS came from the flow model rather than the input. */
  timePredicted: boolean;
  extraction: ExtractionLevel;
  strength: StrengthLevel;
  balance: BalanceLabel;
  /** Per-class share of the class content that was extracted, 0..1. */
  classExtraction: Record<CompoundClass, number>;
  sensory: SensoryProfile;
  caffeineMg: number;
  kcal: number;
  idealEy: Range;
  idealTds: Range;
  idealTimeS?: Range;
  /** i18n keys under `notes.*` describing the expected cup. */
  flavorNotes: string[];
  diagnoses: Diagnosis[];
}
