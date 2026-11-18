import type { ShotCurve } from '../engine';
import type { ShotFrame } from './espressoScene';

/** Seconds for the first beads to merge into a steady stream. */
export const ONSET_S = 3;
/** Seconds the spouts keep dripping after the pump stops. */
export const TAIL_S = 1.5;

/** Interpolated shot state at time t (plus what the spouts visibly do). */
export function frameAt(curve: ShotCurve, t: number): Omit<ShotFrame, 'tds' | 'dt'> {
  const pts = curve.points;
  let a = pts[0]!;
  let b = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i]!.t >= t) {
      a = pts[i - 1]!;
      b = pts[i]!;
      break;
    }
  }
  const k = t >= b.t ? 1 : Math.max(0, (t - a.t) / Math.max(1e-6, b.t - a.t));
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const done = t >= curve.timeS;
  const weight = done ? pts[pts.length - 1]!.w : lerp(a.w, b.w);
  const target = pts[pts.length - 1]!.w || 1;
  // Wetting counts for the first 15 % of the visual extraction front.
  const progress = t < curve.firstDropS ? 0.15 * (t / Math.max(0.1, curve.firstDropS)) : 0.15 + 0.85 * (weight / target);
  const flow = done ? 0 : lerp(a.q, b.q);
  // What you see at the spouts: beads that merge into a stream, and a dripping tail.
  const lastQ = pts[pts.length - 1]!.q || pts[pts.length - 2]?.q || 0;
  const visualFlow = done
    ? Math.max(0, lastQ * 0.35 * (1 - (t - curve.timeS) / TAIL_S))
    : t < curve.firstDropS
      ? 0
      : flow * Math.min(1, (t - curve.firstDropS) / ONSET_S);
  return { pressure: done ? 0 : lerp(a.p, b.p), flow, visualFlow, weight, progress: Math.min(1, progress) };
}

