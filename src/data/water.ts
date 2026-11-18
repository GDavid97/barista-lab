import type { WaterInput } from '../engine';

export interface WaterPreset {
  /** Also the i18n key under `waterPresets.*`. */
  id: string;
  water: Required<WaterInput>;
}

/**
 * Typical water profiles (ppm as CaCO₃). Generic categories, not specific brands
 * or cities – check your own water report or test strips for real numbers.
 */
export const WATER_PRESETS: WaterPreset[] = [
  { id: 'sca', water: { ghPpm: 68, khPpm: 40 } },
  { id: 'softBottled', water: { ghPpm: 30, khPpm: 25 } },
  { id: 'filteredTap', water: { ghPpm: 120, khPpm: 60 } },
  { id: 'mediumTap', water: { ghPpm: 180, khPpm: 150 } },
  { id: 'hardTap', water: { ghPpm: 300, khPpm: 250 } },
  { id: 'distilled', water: { ghPpm: 0, khPpm: 0 } },
];

export function matchPreset(w: WaterInput): string {
  return WATER_PRESETS.find((p) => p.water.ghPpm === w.ghPpm && p.water.khPpm === w.khPpm)?.id ?? 'custom';
}
