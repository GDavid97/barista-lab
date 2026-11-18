import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import {
  simulate,
  suggestDoseG,
  suggestGrindUm,
  type Additions,
  type BeanInput,
  type BrewInput,
  type BurrType,
  type GrindScale,
  type WaterInput,
} from '../engine';
import { drinkById, type DrinkType } from '../data/drinks';
import { grinderById } from '../data/grinders';
import { db, type UserBean, type UserGrinder, type UserMachine } from '../db/schema';
import { buildInput } from '../domain/calibration';
import { useCalibration } from './useCalibration';
import { daysSince } from '../domain/freshness';

/*
 * Shared brew setup used by the simulator and the brew wizard. Both read and
 * write the same persisted state, so a recipe tuned in one shows up in the other.
 */

export const CUSTOM = 'custom';
const STORAGE_KEY = 'baristaLab.simulator.v1';

export interface SimState {
  drinkId: string;
  bean: BeanInput;
  /** Bean from the shelf whose values were copied into `bean`. */
  beanId?: string;
  /** '' = use the default grinder; 'user:<id>' = saved grinder; preset id; or 'custom'. */
  grinderId: string;
  machineId?: string;
  /** Source of truth for the grind: median particle size (µm). */
  particleUm: number;
  customBurr: BurrType;
  brew: BrewInput;
  autoTime: boolean;
  additions: Additions;
  waterKnown: boolean;
  water: WaterInput;
  /** @deprecated moved to app settings; kept so older saved states still parse. */
  advanced?: boolean;
}

const autoTimeFor = (d: DrinkType) => d.brew.method === 'espresso' || d.brew.method === 'pourover';

export function stateForDrink(d: DrinkType, prev?: SimState): SimState {
  return {
    drinkId: d.id,
    bean: prev?.bean ?? { robustaShare: 0, roast: 0.45, process: 'washed', altitudeM: 1500, daysOffRoast: 14 },
    beanId: prev?.beanId,
    grinderId: prev?.grinderId ?? '',
    particleUm: d.grindUm,
    customBurr: prev?.customBurr ?? 'conical',
    brew: { ...d.brew },
    autoTime: autoTimeFor(d),
    additions: { ...d.additions, sugarG: prev?.additions.sugarG ?? 0 },
    waterKnown: prev?.waterKnown ?? false,
    water: prev?.water ?? { ghPpm: 70, khPpm: 40 },
  };
}

function loadState(): SimState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as SimState;
      if (drinkById(s.drinkId)) return s;
    }
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return stateForDrink(drinkById('espresso')!);
}

const FALLBACK_GRINDER = 'comandante-c40';
export const USER_PREFIX = 'user:';

export interface ResolvedGrinder {
  id: string;
  name?: string;
  burr?: BurrType;
  scale?: GrindScale;
  approximate: boolean;
}

export function resolveGrinder(id: string, saved: UserGrinder[]): ResolvedGrinder {
  if (id === CUSTOM) return { id, approximate: false };
  if (id.startsWith(USER_PREFIX)) {
    const g = saved.find((x) => x.id === id.slice(USER_PREFIX.length));
    if (g) return { id, name: g.name, burr: g.burr, scale: g.scale, approximate: g.scaleSource === 'preset' };
  }
  const preset = grinderById(id);
  if (preset) return { id, name: preset.name, burr: preset.burr, scale: preset.scale, approximate: preset.approximate };
  // '' (auto) or a deleted saved grinder: default saved grinder, else the fallback preset.
  const def = saved.find((g) => g.isDefault);
  if (def)
    return { id: USER_PREFIX + def.id, name: def.name, burr: def.burr, scale: def.scale, approximate: def.scaleSource === 'preset' };
  return resolveGrinder(FALLBACK_GRINDER, saved);
}

function beanValues(b: UserBean, prev: BeanInput): BeanInput {
  return {
    roast: b.roast,
    process: b.process,
    robustaShare: b.robustaShare,
    altitudeM: b.altitudeM ?? prev.altitudeM,
    daysOffRoast: daysSince(b.roastDate) ?? prev.daysOffRoast,
  };
}

export function applyMachine(s: SimState, m: UserMachine | undefined): SimState {
  if (!m) return { ...s, machineId: undefined };
  const brew = { ...s.brew };
  if (m.kind === 'espresso') {
    brew.pressureBar = m.pressureBar ?? brew.pressureBar;
    brew.basketDiameterMm = m.basketDiameterMm ?? brew.basketDiameterMm;
    brew.preinfusionS = m.preinfusionS ?? brew.preinfusionS;
    brew.profile = m.profile ?? brew.profile;
    if (!m.hasPid && m.tempC) brew.tempC = m.tempC;
  }
  return { ...s, machineId: m.id, brew };
}

/** Replace the shared setup (e.g. re-brewing a journal entry). Takes effect on the next mount. */
export function storeSetup(state: SimState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function useBrewSetup() {
  const [s, setS] = useState<SimState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable */
    }
  }, [s]);

  const savedGrinders = useLiveQuery(() => db.grinders.orderBy('createdAt').toArray(), []);
  const savedBeans = useLiveQuery(() => db.beans.toArray(), []);
  const savedMachines = useLiveQuery(() => db.machines.orderBy('createdAt').toArray(), []);

  const drink = drinkById(s.drinkId)!;
  const method = s.brew.method;
  const grinder = resolveGrinder(s.grinderId, savedGrinders ?? []);
  const burr = grinder.burr ?? s.customBurr;
  const activeBeans = (savedBeans ?? []).filter((b) => !b.archived || b.id === s.beanId);
  const selectedBean = savedBeans?.find((b) => b.id === s.beanId);
  const methodMachines = (savedMachines ?? []).filter((m) => m.kind === method);

  // Days off roast move on with the calendar; keep a shelf bean's value current.
  const shelfDays = daysSince(selectedBean?.roastDate);
  useEffect(() => {
    if (shelfDays !== undefined && shelfDays !== s.bean.daysOffRoast)
      setS((p) => ({ ...p, bean: { ...p.bean, daysOffRoast: shelfDays } }));
  }, [shelfDays, s.bean.daysOffRoast]);

  const pickDrink = (d: DrinkType) =>
    setS((p) => {
      const next = stateForDrink(d, p);
      const def = (savedMachines ?? []).find((m) => m.kind === d.brew.method && m.isDefault);
      return applyMachine(next, def);
    });
  const pickBean = (id: string) =>
    setS((p) => {
      const b = savedBeans?.find((x) => x.id === id);
      return b ? { ...p, beanId: b.id, bean: beanValues(b, p.bean) } : { ...p, beanId: undefined };
    });

  // Personal calibration for the current grinder, learned from the journal.
  const calibration = useCalibration(grinder.id);

  const input = useMemo(() => buildInput(s, burr, calibration), [s, burr, calibration]);
  const result = useMemo(() => simulate(input), [input]);

  const suggestion = useMemo(() => {
    const keys = result.diagnoses.map((d) => d.key);
    if (keys.includes('underExtracted') || keys.includes('overExtracted')) {
      // The engine works on the calibrated (real) size; the dial shows the nominal one.
      const um = suggestGrindUm(input);
      return um === undefined ? undefined : { kind: 'grind' as const, um: um / calibration.grindFactor };
    }
    if (keys.includes('weak') || keys.includes('strong')) {
      const dose = suggestDoseG(input);
      return dose === undefined ? undefined : { kind: 'dose' as const, dose };
    }
    return undefined;
  }, [input, result.diagnoses, calibration.grindFactor]);

  const set = <K extends keyof SimState>(k: K, v: SimState[K]) => setS((p) => ({ ...p, [k]: v }));
  const setBean = (patch: Partial<BeanInput>) => setS((p) => ({ ...p, bean: { ...p.bean, ...patch } }));
  const setBrew = (patch: Partial<BrewInput>) => setS((p) => ({ ...p, brew: { ...p.brew, ...patch } }));
  const setAdd = (patch: Partial<Additions>) => setS((p) => ({ ...p, additions: { ...p.additions, ...patch } }));

  return {
    s,
    setS,
    set,
    setBean,
    setBrew,
    setAdd,
    drink,
    method,
    grinder,
    burr,
    savedGrinders,
    savedBeans,
    savedMachines,
    activeBeans,
    selectedBean,
    methodMachines,
    pickDrink,
    pickBean,
    input,
    result,
    suggestion,
    calibration,
  };
}

export type BrewSetup = ReturnType<typeof useBrewSetup>;
