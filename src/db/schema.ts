import Dexie, { type EntityTable } from 'dexie';
import type {
  BalanceLabel,
  BrewMethod,
  BurrType,
  ExtractionLevel,
  GrindScale,
  PressureProfile,
  Process,
  SensoryProfile,
  StrengthLevel,
} from '../engine';
import type { SimState } from '../pages/useBrewSetup';

export interface UserGrinder {
  id: string;
  name: string;
  /** Preset from the grinder database it was created from, if any. */
  presetId?: string;
  burr: BurrType;
  kind: 'manual' | 'electric';
  scale: GrindScale;
  /** 'preset' = database estimate, 'twoPoint' = user calibrated, 'manual' = µm/step entered. */
  scaleSource: 'preset' | 'twoPoint' | 'manual';
  /** The two-point calibration inputs, kept so the form can be edited later. */
  calibration?: { espressoSetting: number; pouroverSetting: number };
  isDefault: boolean;
  createdAt: number;
}

export type MachineKind = BrewMethod;

export interface UserMachine {
  id: string;
  name: string;
  kind: MachineKind;
  /** Espresso only. */
  pressureBar?: number;
  basketDiameterMm?: number;
  preinfusionS?: number;
  /** Espresso: the machine's natural pressure profile. */
  profile?: PressureProfile;
  /** Espresso: machine has PID temperature control. */
  hasPid?: boolean;
  /** Espresso: fixed brew temperature for machines without PID. */
  tempC?: number;
  isDefault: boolean;
  createdAt: number;
}

export interface UserBean {
  id: string;
  name: string;
  roaster?: string;
  origin?: string;
  process: Process;
  /** 0 (very light) .. 1 (very dark). */
  roast: number;
  robustaShare: number;
  altitudeM?: number;
  /** ISO date YYYY-MM-DD. */
  roastDate?: string;
  flavorNotes: string[];
  /** Remaining coffee in grams. */
  stockG: number;
  /** Bag size when added, for the progress bar. */
  bagG: number;
  archived: boolean;
  createdAt: number;
}

export interface BrewRating {
  /** 0 = not rated, 1..5 stars. */
  stars: number;
  /** -2 sour … 0 balanced … +2 bitter. */
  sourBitter: number;
  /** -2 weak … 0 right … +2 too strong. */
  weakStrong: number;
  notes: string;
}

export interface BrewPrediction {
  ey: number;
  tds: number;
  timeS: number;
  beverageG: number;
  finalVolumeMl: number;
  caffeineMg: number;
  extraction: ExtractionLevel;
  strength: StrengthLevel;
  balance: BalanceLabel;
  sensory: SensoryProfile;
}

export interface UserBrew {
  id: string;
  createdAt: number;
  drinkId: string;
  method: BrewMethod;
  beanId?: string;
  /** Snapshot of the bean name, kept even if the bean is deleted later. */
  beanName?: string;
  grinderName?: string;
  /** Resolved grinder id ('user:<id>', preset id or 'custom'); keys the personal calibration. */
  grinderKey?: string;
  burr?: BurrType;
  /** Dial instruction at brew time, e.g. "10 (≈ 300 µm)". */
  grindLabel: string;
  /** Full setup snapshot – loading it back re-brews the exact recipe. */
  setup: SimState;
  predicted: BrewPrediction;
  /** Wall-clock time spent in the timed brew phase (s). */
  brewTimeS?: number;
  measured: { timeS?: number; beverageG?: number; tds?: number };
  rating?: BrewRating;
}

export class BaristaDb extends Dexie {
  grinders!: EntityTable<UserGrinder, 'id'>;
  machines!: EntityTable<UserMachine, 'id'>;
  beans!: EntityTable<UserBean, 'id'>;
  brews!: EntityTable<UserBrew, 'id'>;

  constructor(name = 'baristaLab') {
    super(name);
    // Booleans are not valid IndexedDB keys, so flags like isDefault/archived are filtered in memory.
    this.version(1).stores({
      grinders: 'id, createdAt',
      machines: 'id, kind, createdAt',
      beans: 'id, roastDate, createdAt',
    });
    this.version(2).stores({
      brews: 'id, createdAt, drinkId, beanId',
    });
  }
}

export const db = new BaristaDb();

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
