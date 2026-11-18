import type { Diagnosis } from '../engine';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';

/** Temperature windows referenced by diagnosis texts (°C). */
const RANGES: Record<string, [number, number]> = {
  darkRoastHot: [88, 91],
  lightRoastCool: [94, 96],
};

/** Translate an engine diagnosis, filling unit-dependent values. */
export function useDiagText(): (d: Diagnosis) => string {
  const { tDyn } = useI18n();
  const { toTemp, tempSymbol, fmtTemp } = useSettings();
  return (d) => {
    const r = RANGES[d.key];
    const range = r ? `${Math.round(toTemp(r[0]))}–${Math.round(toTemp(r[1]))} ${tempSymbol}` : undefined;
    return tDyn(`diag.${d.key}`, { ...d.params, ...(range ? { range } : {}), temp: fmtTemp(70) });
  };
}
