import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { hu, type Dict } from './hu';

export type Lang = 'hu' | 'en';
const DICTS: Record<Lang, Dict> = { hu, en };
const STORAGE_KEY = 'baristaLab.lang';

/** All dotted paths to string leaves, e.g. "results.extraction.under". */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<Dict>;
export type Params = Record<string, string | number>;

function lookup(dict: Dict, path: string): string | undefined {
  let node: unknown = dict;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, params?: Params) => string;
  /** For keys built at runtime (e.g. engine output); falls back to the key. */
  tDyn: (key: string, params?: Params) => string;
  fmt: (n: number, digits?: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'hu' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const dict = DICTS[lang];
    const nf = new Map<number, Intl.NumberFormat>();
    const tDyn = (key: string, params?: Params) => interpolate(lookup(dict, key) ?? key, params);
    return {
      lang,
      setLang,
      t: tDyn,
      tDyn,
      fmt: (n, digits = 0) => {
        let f = nf.get(digits);
        if (!f) {
          f = new Intl.NumberFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          });
          nf.set(digits, f);
        }
        return f.format(n);
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
