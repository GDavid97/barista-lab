import type { UserBrew } from '../db/schema';
import { idealsFor, settingToUm, simulate, umToSetting, type GrindScale } from '../engine';
import type { SimState } from '../pages/useBrewSetup';
import { buildInput, NO_CALIBRATION, type Calibration } from './calibration';

export interface DialInPatch {
  particleUm?: number;
  tempC?: number;
  waterG?: number;
  doseG?: number;
}

export interface DialInAction {
  /** i18n key under `dialIn.*`. */
  key: string;
  params: Record<string, string | number>;
  patch: DialInPatch;
}

export interface DialInAdvice {
  verdict: 'unrated' | 'keep' | 'adjust';
  primary?: DialInAction;
  alternatives: DialInAction[];
}

/** EY change (percentage points) asked for by one step on the sour ↔ bitter scale. */
const EY_PER_LEVEL = 1;
const round = (v: number, step: number) => Math.round(v / step) * step;

export function applyPatch(s: SimState, p: DialInPatch): SimState {
  return {
    ...s,
    particleUm: p.particleUm ?? s.particleUm,
    brew: {
      ...s.brew,
      tempC: p.tempC ?? s.brew.tempC,
      waterG: p.waterG ?? s.brew.waterG,
      doseG: p.doseG ?? s.brew.doseG,
    },
  };
}

/**
 * Grind change that moves the predicted EY by `deltaEy`, expressed on the
 * grinder's own dial (at least one step in the right direction).
 */
function grindAction(brew: UserBrew, deltaEy: number, scale: GrindScale | undefined, cal: Calibration): DialInAction | undefined {
  const s = brew.setup;
  const burr = brew.burr ?? 'conical';
  const eyAt = (nominalUm: number) => simulate(buildInput({ ...s, particleUm: nominalUm }, burr, cal)).ey;
  const target = eyAt(s.particleUm) + deltaEy;
  let lo = 60;
  let hi = 2500;
  if (eyAt(lo) < target || eyAt(hi) > target) return undefined;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (eyAt(mid) > target) lo = mid;
    else hi = mid;
  }
  const wanted = (lo + hi) / 2;
  const finer = deltaEy > 0;

  if (scale) {
    const cur = umToSetting(scale, s.particleUm);
    let next = umToSetting(scale, wanted);
    if (next === cur) next = Math.min(scale.max, Math.max(scale.min, cur + (finer ? -scale.step : scale.step)));
    if (next === cur) return undefined;
    const steps = Math.abs(next - cur);
    const digits = scale.step < 1 ? 2 : 0;
    return {
      key: finer ? 'grindFiner' : 'grindCoarser',
      params: { steps: Number(steps.toFixed(digits)), setting: Number(next.toFixed(digits)) },
      patch: { particleUm: settingToUm(scale, next) },
    };
  }
  let um = round(wanted, 10);
  if (Math.abs(um - s.particleUm) < 10) um = s.particleUm + (finer ? -10 : 10);
  return { key: finer ? 'grindFinerUm' : 'grindCoarserUm', params: { um }, patch: { particleUm: um } };
}

/**
 * Next-step advice from a rated brew. Taste (sour ↔ bitter) is fixed by the
 * extraction – primarily grind, then temperature / ratio; strength (weak ↔ strong)
 * by the coffee-to-water ratio.
 */
export function dialInAdvice(brew: UserBrew, scale: GrindScale | undefined, cal: Calibration = NO_CALIBRATION): DialInAdvice {
  const r = brew.rating;
  if (!r || (r.stars === 0 && r.sourBitter === 0 && r.weakStrong === 0)) return { verdict: 'unrated', alternatives: [] };
  const sb = r.sourBitter;
  const ws = r.weakStrong;
  if (sb === 0 && ws === 0) return { verdict: 'keep', alternatives: [] };

  const s = brew.setup.brew;
  const espresso = s.method === 'espresso';
  const heated = s.method !== 'coldbrew' && s.method !== 'moka';
  const taste: DialInAction[] = [];
  const strength: DialInAction[] = [];

  if (sb !== 0) {
    const g = grindAction(brew, -sb * EY_PER_LEVEL, scale, cal);
    if (g) taste.push(g);
    const deg = Math.abs(sb);
    if (heated && sb < 0 && s.tempC < 96) {
      const temp = Math.min(96, s.tempC + deg);
      taste.push({ key: 'tempUp', params: { deg: temp - s.tempC, temp }, patch: { tempC: temp } });
    }
    if (heated && sb > 0 && s.tempC > 86) {
      const temp = Math.max(86, s.tempC - deg);
      taste.push({ key: 'tempDown', params: { deg: s.tempC - temp, temp }, patch: { tempC: temp } });
    }
    if (espresso) {
      const g2 = Math.round(s.waterG + (sb < 0 ? 3 : -3) * deg);
      taste.push({ key: sb < 0 ? 'longerRatio' : 'shorterRatio', params: { g: g2 }, patch: { waterG: g2 } });
    }
  }

  if (ws !== 0) {
    const lvl = Math.abs(ws);
    if (espresso) {
      const g = Math.round(s.waterG + (ws < 0 ? -4 : 4) * lvl);
      strength.push({ key: ws < 0 ? 'lessYield' : 'moreYield', params: { g }, patch: { waterG: g } });
    } else if (ws < 0) {
      const g = round(s.doseG * (1 + 0.07 * lvl), 0.5);
      strength.push({ key: 'moreDose', params: { g }, patch: { doseG: g } });
    } else {
      const g = round(s.waterG * (1 + 0.07 * lvl), 5);
      strength.push({ key: 'moreWater', params: { g }, patch: { waterG: g } });
    }
  }

  // Espresso: a grind change that would push the shot outside its time window is a poor
  // first move (e.g. sour but already slow → longer ratio / hotter water instead).
  if (espresso && taste[0]?.patch.particleUm !== undefined) {
    const next = buildInput(applyPatch(brew.setup, taste[0].patch), brew.burr ?? 'conical', cal);
    const window = idealsFor(next).time!;
    const t = simulate(next).timeS;
    if (t > window[1] || t < window[0]) taste.push(taste.shift()!);
  }

  const all = [...taste, ...strength];
  return { verdict: 'adjust', primary: all[0], alternatives: all.slice(1) };
}
