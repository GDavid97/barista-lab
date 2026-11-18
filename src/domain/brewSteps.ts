import type { ShotCurve, SimulationInput } from '../engine';

export type StepPhase = 'prep' | 'brew' | 'finish';

export interface BrewStep {
  id: string;
  /** i18n key under `steps.*`. */
  key: string;
  phase: StepPhase;
  /** Interpolation values (numbers / plain strings). */
  params?: Record<string, number | string>;
  /** Interpolation values that are i18n keys and must be translated first. */
  paramKeys?: Record<string, string>;
  /** Brew phase: seconds from the timer start. */
  startS?: number;
  /** Brew phase: when the step ends; undefined = the user advances manually. */
  endS?: number;
  /** Expected scale reading (g) when the step ends. */
  targetG?: number;
}

export interface StepContext {
  /** Brew / shot time to plan for (s). */
  timeS: number;
  /** Human readable grind instruction, e.g. "10 (≈ 300 µm)". */
  grindLabel: string;
  /** Espresso: the simulated shot, whose phases become the timed steps. */
  shot?: ShotCurve;
}

const r5 = (v: number) => Math.round(v / 5) * 5;
const g = (v: number) => Math.round(v);

/** Step-by-step plan for one brew. Pure: depends only on the recipe. */
export function brewSteps(input: SimulationInput, ctx: StepContext): BrewStep[] {
  const { brew, additions } = input;
  const dose = brew.doseG;
  const water = brew.waterG;
  const T = Math.max(1, Math.round(ctx.timeS));
  const steps: BrewStep[] = [];
  const add = (s: Omit<BrewStep, 'id'>) => steps.push({ ...s, id: `${s.phase}-${steps.length}-${s.key}` });

  const weighGrind = () => add({ key: 'weighGrind', phase: 'prep', params: { dose, grind: ctx.grindLabel } });
  const heatWater = () => add({ key: 'heatWater', phase: 'prep', params: { temp: brew.tempC } });

  switch (brew.method) {
    case 'espresso': {
      add({ key: 'heatMachine', phase: 'prep', params: { temp: brew.tempC } });
      weighGrind();
      add({ key: 'distribute', phase: 'prep' });
      add({ key: 'tamp', phase: 'prep' });
      add({ key: 'lockIn', phase: 'prep' });
      if (ctx.shot) {
        const extractKey = brew.profile === 'lever' ? 'leverPull' : brew.profile === 'declining' ? 'extractDeclining' : 'extract';
        for (const ph of ctx.shot.phases) {
          const startS = Math.round(ph.startS);
          const endS = Math.max(startS + 1, Math.round(ph.endS));
          if (ph.kind === 'preinfuse') add({ key: 'preinfuse', phase: 'brew', startS, endS });
          else if (ph.kind === 'bloom') add({ key: 'bloomPause', phase: 'brew', startS, endS });
          else add({ key: extractKey, phase: 'brew', startS, endS, targetG: g(water), params: { yield: g(water), time: endS } });
        }
        break;
      }
      const pre = Math.max(0, Math.round(brew.preinfusionS ?? 0));
      if (pre > 0) add({ key: 'preinfuse', phase: 'brew', startS: 0, endS: Math.min(pre, T - 1) });
      add({
        key: 'extract',
        phase: 'brew',
        startS: pre > 0 ? Math.min(pre, T - 1) : 0,
        endS: T,
        targetG: g(water),
        params: { yield: g(water), time: T },
      });
      break;
    }
    case 'pourover': {
      heatWater();
      if (brew.filter === 'paper') add({ key: 'rinsePaper', phase: 'prep' });
      weighGrind();
      add({ key: 'addGrounds', phase: 'prep' });
      const bloomEnd = T >= 150 ? 45 : 30;
      const pour1End = Math.min(T - 20, r5(bloomEnd + 0.2 * T));
      const pour2End = Math.min(T - 10, Math.max(pour1End + 15, r5(0.6 * T)));
      const bloomG = g(Math.min(water * 0.2, dose * 2.2));
      const pour1G = g(water * 0.6);
      add({ key: 'bloom', phase: 'brew', startS: 0, endS: bloomEnd, targetG: bloomG, params: { g: bloomG } });
      add({ key: 'pour', phase: 'brew', startS: bloomEnd, endS: pour1End, targetG: pour1G, params: { g: pour1G } });
      add({ key: 'pour', phase: 'brew', startS: pour1End, endS: pour2End, targetG: g(water), params: { g: g(water) } });
      add({ key: 'drawdown', phase: 'brew', startS: pour2End, endS: T });
      break;
    }
    case 'immersion': {
      heatWater();
      weighGrind();
      add({ key: 'addGrounds', phase: 'prep' });
      const pourEnd = Math.min(15, T - 1);
      add({ key: 'pourAll', phase: 'brew', startS: 0, endS: pourEnd, targetG: g(water), params: { g: g(water) } });
      add({ key: 'steep', phase: 'brew', startS: pourEnd, endS: T });
      add({ key: 'breakCrust', phase: 'finish' });
      add({ key: 'plunge', phase: 'finish' });
      break;
    }
    case 'aeropress': {
      heatWater();
      if (brew.filter === 'paper') add({ key: 'rinsePaper', phase: 'prep' });
      weighGrind();
      add({ key: 'addGrounds', phase: 'prep' });
      const pourEnd = Math.min(15, T - 2);
      const stirEnd = Math.min(pourEnd + 10, T - 1);
      add({ key: 'pourAll', phase: 'brew', startS: 0, endS: pourEnd, targetG: g(water), params: { g: g(water) } });
      add({ key: 'stir', phase: 'brew', startS: pourEnd, endS: stirEnd });
      if (T > stirEnd) add({ key: 'steep', phase: 'brew', startS: stirEnd, endS: T });
      add({ key: 'press', phase: 'brew', startS: T, endS: T + 25 });
      break;
    }
    case 'moka': {
      add({ key: 'mokaFillBoiler', phase: 'prep', params: { g: g(water) } });
      add({ key: 'mokaFillBasket', phase: 'prep', params: { dose, grind: ctx.grindLabel } });
      add({ key: 'mokaAssemble', phase: 'prep' });
      add({ key: 'mokaHeat', phase: 'brew', startS: 0 });
      add({ key: 'mokaStop', phase: 'brew' });
      break;
    }
    case 'clever': {
      heatWater();
      if (brew.filter === 'paper') add({ key: 'rinsePaper', phase: 'prep' });
      weighGrind();
      add({ key: 'addGrounds', phase: 'prep' });
      const pourEnd = Math.min(15, T - 1);
      add({ key: 'pourAll', phase: 'brew', startS: 0, endS: pourEnd, targetG: g(water), params: { g: g(water) } });
      add({ key: 'steep', phase: 'brew', startS: pourEnd, endS: T });
      add({ key: 'cleverDrain', phase: 'brew', startS: T, endS: T + 60 });
      break;
    }
    case 'siphon': {
      // Waiting for the water to rise is open-ended, so it belongs to the untimed prep.
      add({ key: 'siphonFill', phase: 'prep', params: { g: g(water) } });
      weighGrind();
      add({ key: 'siphonHeat', phase: 'prep', params: { temp: brew.tempC } });
      const stirEnd = Math.min(10, T - 1);
      add({ key: 'siphonAddStir', phase: 'brew', startS: 0, endS: stirEnd, params: { dose } });
      add({ key: 'steep', phase: 'brew', startS: stirEnd, endS: T });
      add({ key: 'siphonDrawdown', phase: 'brew', startS: T, endS: T + 45 });
      break;
    }
    case 'turkish': {
      weighGrind();
      add({ key: 'turkishCombine', phase: 'prep', params: { g: g(water) } });
      const foamAt = Math.max(1, T - 30);
      add({ key: 'turkishHeat', phase: 'brew', startS: 0, endS: foamAt });
      add({ key: 'turkishFoam', phase: 'brew', startS: foamAt, endS: T });
      add({ key: 'turkishSettle', phase: 'finish' });
      break;
    }
    case 'coldbrew': {
      weighGrind();
      add({ key: 'coldCombine', phase: 'prep', params: { g: g(water) } });
      add({ key: 'coldSteep', phase: 'brew', startS: 0, endS: T, params: { hours: Math.round((T / 3600) * 10) / 10 } });
      add({ key: 'coldFilter', phase: 'finish' });
      break;
    }
  }

  const syrup = additions?.syrup;
  if (syrup && syrup.ml > 0)
    add({ key: 'addSyrup', phase: 'finish', params: { ml: g(syrup.ml) }, paramKeys: { syrup: `syrups.${syrup.type}` } });
  const milk = additions?.milkMl ?? 0;
  if (milk > 0) {
    add({
      key: 'steamMilk',
      phase: 'finish',
      params: { ml: g(milk), temp: additions?.milkTempC ?? 60 },
      paramKeys: {
        milk: `milks.${additions?.milkType ?? 'whole'}`,
        foam: `foams.${additions?.foam && additions.foam !== 'none' ? additions.foam : 'silky'}`,
      },
    });
    add({ key: 'pourMilk', phase: 'finish' });
  }
  if ((additions?.waterMl ?? 0) > 0) add({ key: 'addWater', phase: 'finish', params: { ml: g(additions!.waterMl!) } });
  if ((additions?.sugarG ?? 0) > 0) add({ key: 'addSugar', phase: 'finish', params: { g: g(additions!.sugarG!) } });
  add({ key: 'serve', phase: 'finish' });
  return steps;
}

/** Total planned brew-phase duration; undefined if the brew ends manually. */
export function plannedDurationS(steps: BrewStep[]): number | undefined {
  const brewSteps = steps.filter((s) => s.phase === 'brew');
  if (brewSteps.some((s) => s.endS === undefined)) return undefined;
  return Math.max(0, ...brewSteps.map((s) => s.endS ?? 0));
}

/**
 * Index (within brew steps) of the step active at `elapsedS`.
 * Timed steps follow the clock; a manual step holds until `manualDone` passes it.
 */
export function activeBrewStep(brew: BrewStep[], elapsedS: number, manualDone: number): number {
  for (let i = 0; i < brew.length; i++) {
    const s = brew[i]!;
    if (s.endS === undefined) {
      if (i >= manualDone) return i;
      continue;
    }
    if (i < manualDone) continue;
    if (elapsedS < s.endS) return i;
  }
  return brew.length; // all done
}
