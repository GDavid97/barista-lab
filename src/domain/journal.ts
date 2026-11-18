import type { BurrType, SimulationResult } from '../engine';
import type { UserBrew } from '../db/schema';
import type { SimState } from '../pages/useBrewSetup';

export interface BrewRecordArgs {
  id: string;
  now: number;
  setup: SimState;
  result: SimulationResult;
  grindLabel: string;
  grinderName?: string;
  grinderKey?: string;
  burr?: BurrType;
  beanName?: string;
  brewTimeS?: number;
  /** Planned brew-phase duration; used to decide whether the timer reflects reality. */
  plannedS?: number;
}

/** Methods whose timer duration is a meaningful "measured time". */
const TIMED_METHODS = new Set(['espresso', 'pourover', 'aeropress', 'immersion']);

export function makeBrewRecord(a: BrewRecordArgs): UserBrew {
  const { setup, result } = a;
  // Only trust the timer if the user actually followed it (not skipped through the steps).
  const trustTimer =
    a.brewTimeS !== undefined &&
    TIMED_METHODS.has(setup.brew.method) &&
    (a.plannedS === undefined || a.brewTimeS >= a.plannedS * 0.5);
  return {
    id: a.id,
    createdAt: a.now,
    drinkId: setup.drinkId,
    method: setup.brew.method,
    beanId: setup.beanId,
    beanName: a.beanName,
    grinderName: a.grinderName,
    grinderKey: a.grinderKey,
    burr: a.burr,
    grindLabel: a.grindLabel,
    setup: structuredClone(setup),
    predicted: {
      ey: result.ey,
      tds: result.tds,
      timeS: result.timeS,
      beverageG: result.beverageG,
      finalVolumeMl: result.finalVolumeMl,
      caffeineMg: result.caffeineMg,
      extraction: result.extraction,
      strength: result.strength,
      balance: result.balance,
      sensory: { ...result.sensory },
    },
    brewTimeS: a.brewTimeS,
    measured: { timeS: trustTimer ? Math.round(a.brewTimeS!) : undefined },
  };
}

/** EY from a refractometer reading: TDS% × beverage mass / dose. */
export function measuredEy(b: UserBrew): number | undefined {
  const tds = b.measured.tds;
  if (tds === undefined || tds <= 0) return undefined;
  const beverage = b.measured.beverageG ?? b.predicted.beverageG;
  return (tds * beverage) / b.setup.brew.doseG;
}

export interface JournalFilter {
  drinkId?: string;
  beanId?: string;
}

export function filterBrews(brews: UserBrew[], f: JournalFilter): UserBrew[] {
  return brews
    .filter((b) => (!f.drinkId || b.drinkId === f.drinkId) && (!f.beanId || b.beanId === f.beanId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Groups (already sorted) brews by local calendar day, keeping order. */
export function groupByDay(brews: UserBrew[]): { day: string; brews: UserBrew[] }[] {
  const out: { day: string; brews: UserBrew[] }[] = [];
  for (const b of brews) {
    const d = new Date(b.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const last = out[out.length - 1];
    if (last && last.day === key) last.brews.push(b);
    else out.push({ day: key, brews: [b] });
  }
  return out;
}
