import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type TempUnit = 'C' | 'F';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  tempUnit: TempUnit;
  /** Show advanced fields (pressure, pre-infusion, water chemistry, altitude) by default. */
  advanced: boolean;
  theme: Theme;
}

export const SETTINGS_KEY = 'baristaLab.settings.v1';
const DEFAULTS: Settings = { tempUnit: 'C', advanced: false, theme: 'system' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

interface SettingsCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** °C → display unit. */
  toTemp: (c: number) => number;
  /** Display unit → °C. */
  fromTemp: (v: number) => number;
  /** Temperature difference (°C) in display unit. */
  tempDelta: (dc: number) => number;
  tempSymbol: string;
  /** "93 °C" / "199 °F". */
  fmtTemp: (c: number, digits?: number) => string;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const value = useMemo<SettingsCtx>(() => {
    const f = settings.tempUnit === 'F';
    const toTemp = (c: number) => (f ? cToF(c) : c);
    const tempSymbol = f ? '°F' : '°C';
    return {
      settings,
      update,
      toTemp,
      fromTemp: (v) => (f ? fToC(v) : v),
      tempDelta: (dc) => (f ? dc * 1.8 : dc),
      tempSymbol,
      fmtTemp: (c, digits = 0) => `${Number(toTemp(c).toFixed(digits))} ${tempSymbol}`,
    };
  }, [settings, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
