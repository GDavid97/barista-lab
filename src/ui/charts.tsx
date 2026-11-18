import { weightAt, type BrewMethod, type Range, type SensoryProfile, type ShotCurve } from '../engine';

const SENSORY_KEYS: (keyof SensoryProfile)[] = [
  'acidity',
  'sweetness',
  'bitterness',
  'astringency',
  'aftertaste',
  'body',
  'aroma',
];

export function RadarChart({
  profile,
  labels,
  compare,
}: {
  profile: SensoryProfile;
  labels: Record<keyof SensoryProfile, string>;
  /** Optional second profile drawn underneath (journal comparison). */
  compare?: SensoryProfile;
}) {
  const size = 300;
  const c = size / 2;
  const R = 100;
  const n = SENSORY_KEYS.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="radar">
      {[2.5, 5, 7.5, 10].map((ring) => (
        <polygon key={ring} points={poly(SENSORY_KEYS.map(() => ring))} className={ring === 5 ? 'radar__ref' : 'radar__grid'} />
      ))}
      {SENSORY_KEYS.map((_, i) => {
        const [x, y] = pt(i, 10);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="radar__grid" />;
      })}
      {compare && <polygon points={poly(SENSORY_KEYS.map((k) => compare[k]))} className="radar__shape radar__shape--b" />}
      <polygon points={poly(SENSORY_KEYS.map((k) => profile[k]))} className="radar__shape" />
      {SENSORY_KEYS.map((k, i) => {
        const [x, y] = pt(i, profile[k]);
        return <circle key={k} cx={x} cy={y} r={3.5} className="radar__dot" />;
      })}
      {SENSORY_KEYS.map((k, i) => {
        const [x, y] = pt(i, 12.6);
        const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
        return (
          <text key={k} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="radar__label">
            <tspan>{labels[k]}</tspan>
            <tspan x={x} dy="1.15em" className="radar__num">
              {profile[k].toFixed(1)}
              {compare && ` / ${compare[k].toFixed(1)}`}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

const TDS_AXIS: Record<BrewMethod, Range> = {
  espresso: [4, 18],
  pourover: [0.8, 2],
  immersion: [0.8, 2],
  aeropress: [0.8, 2.2],
  moka: [1.5, 7],
  coldbrew: [0.8, 2.6],
  turkish: [1, 4],
  siphon: [0.8, 2],
  clever: [0.8, 2],
};

interface ControlChartProps {
  method: BrewMethod;
  ey: number;
  tds: number;
  eyUncertainty: number;
  idealEy: Range;
  idealTds: Range;
  labels: { ey: string; tds: string; weak: string; strong: string; under: string; over: string };
  fmt: (n: number, d?: number) => string;
}

export function ControlChart({ method, ey, tds, eyUncertainty, idealEy, idealTds, labels, fmt }: ControlChartProps) {
  const W = 340;
  const H = 240;
  const m = { l: 44, r: 12, t: 14, b: 38 };
  const [x0, x1] = [12, 28] as const;
  const axisTds = TDS_AXIS[method];
  const y0 = Math.min(axisTds[0], idealTds[0] * 0.7);
  const y1 = Math.max(axisTds[1], idealTds[1] * 1.3);
  const sx = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const clampX = (v: number) => Math.min(x1, Math.max(x0, v));
  const clampY = (v: number) => Math.min(y1, Math.max(y0, v));
  const xTicks = [12, 16, 20, 24, 28];
  const yStep = (y1 - y0) / 4;
  const yTicks = [0, 1, 2, 3, 4].map((i) => y0 + i * yStep);
  const yDigits = y1 - y0 < 3 ? 2 : 0;
  const px = sx(clampX(ey));
  const py = sy(clampY(tds));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="control" role="img" aria-label={`${labels.ey} ${fmt(ey, 1)}, ${labels.tds} ${fmt(tds, 2)}`}>
      {xTicks.map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} className="control__grid" />
          <text x={sx(v)} y={H - m.b + 14} textAnchor="middle" className="control__tick">
            {v}
          </text>
        </g>
      ))}
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} className="control__grid" />
          <text x={m.l - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" className="control__tick">
            {fmt(v, yDigits)}
          </text>
        </g>
      ))}
      <rect
        x={sx(idealEy[0])}
        y={sy(idealTds[1])}
        width={sx(idealEy[1]) - sx(idealEy[0])}
        height={sy(idealTds[0]) - sy(idealTds[1])}
        className="control__ideal"
      />
      <text x={m.l + 4} y={m.t + 10} className="control__corner">{labels.strong}</text>
      <text x={m.l + 4} y={H - m.b - 6} className="control__corner">{labels.weak}</text>
      <text x={sx(14)} y={sy((y0 + y1) / 2)} textAnchor="middle" className="control__corner">{labels.under}</text>
      <text x={sx(26)} y={sy((y0 + y1) / 2)} textAnchor="middle" className="control__corner">{labels.over}</text>
      <line
        x1={sx(clampX(ey - eyUncertainty))}
        x2={sx(clampX(ey + eyUncertainty))}
        y1={py}
        y2={py}
        className="control__err"
      />
      <circle cx={px} cy={py} r={7} className="control__point" />
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" className="control__axis">{labels.ey}</text>
      <text x={12} y={(m.t + H - m.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`} className="control__axis">
        {labels.tds}
      </text>
    </svg>
  );
}

/* ---------------- Shot curve ---------------- */

interface ShotChartProps {
  curve: ShotCurve;
  /** Elapsed seconds during a live brew: draws a cursor. */
  cursorS?: number;
  labels: { weight: string; pressure: string; flow: string; seconds: string };
}

/** Weight (left axis), pressure (right axis) and flow over time for an espresso shot. */
export function ShotChart({ curve, cursorS, labels }: ShotChartProps) {
  const W = 360;
  const H = 220;
  const m = { l: 36, r: 34, t: 14, b: 30 };
  const tMax = Math.max(10, Math.ceil((curve.timeS * 1.06) / 5) * 5);
  const wMax = Math.max(10, Math.ceil((curve.points.at(-1)!.w * 1.12) / 10) * 10);
  const pMax = 12;
  const qMax = Math.max(1, ...curve.points.map((p) => p.q)) * 1.25;
  const sx = (t: number) => m.l + (t / tMax) * (W - m.l - m.r);
  const sw = (w: number) => H - m.b - (w / wMax) * (H - m.t - m.b);
  const sp = (p: number) => H - m.b - (p / pMax) * (H - m.t - m.b);
  const sq = (q: number) => H - m.b - (q / qMax) * (H - m.t - m.b) * 0.6;
  const path = (f: (pt: ShotCurve['points'][number]) => number) =>
    curve.points.map((pt, i) => `${i ? 'L' : 'M'}${sx(pt.t).toFixed(1)},${f(pt).toFixed(1)}`).join('');
  const xTicks = Array.from({ length: Math.floor(tMax / 10) + 1 }, (_, i) => i * 10);
  const wTicks = [0, wMax / 2, wMax];
  const cursorT = cursorS === undefined ? undefined : Math.min(cursorS, tMax);
  const cursorW = cursorT === undefined ? undefined : weightAt(curve, cursorT);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="shot" role="img" aria-label={`${labels.weight} / ${labels.pressure}`}>
      {curve.phases
        .filter((ph) => ph.kind !== 'extract')
        .map((ph) => (
          <rect
            key={ph.kind}
            x={sx(ph.startS)}
            y={m.t}
            width={Math.max(0, sx(ph.endS) - sx(ph.startS))}
            height={H - m.t - m.b}
            className={`shot__phase shot__phase--${ph.kind}`}
          />
        ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} className="control__grid" />
          <text x={sx(t)} y={H - m.b + 13} textAnchor="middle" className="control__tick">
            {t}
          </text>
        </g>
      ))}
      {wTicks.map((w) => (
        <text key={`w${w}`} x={m.l - 5} y={sw(w)} textAnchor="end" dominantBaseline="middle" className="control__tick">
          {Math.round(w)}
        </text>
      ))}
      {[0, 3, 6, 9, 12].map((p) => (
        <text key={`p${p}`} x={W - m.r + 5} y={sp(p)} dominantBaseline="middle" className="control__tick shot__ptick">
          {p}
        </text>
      ))}
      <line x1={sx(curve.firstDropS)} x2={sx(curve.firstDropS)} y1={m.t} y2={H - m.b} className="shot__drop" />
      <path d={path((pt) => sq(pt.q))} className="shot__flow" />
      <path d={path((pt) => sp(pt.p))} className="shot__pressure" />
      <path d={path((pt) => sw(pt.w))} className="shot__weight" />
      {cursorT !== undefined && cursorW !== undefined && (
        <g>
          <line x1={sx(cursorT)} x2={sx(cursorT)} y1={m.t} y2={H - m.b} className="shot__cursor" />
          <circle cx={sx(cursorT)} cy={sw(cursorW)} r={5} className="shot__dot" />
        </g>
      )}
      <text x={(m.l + W - m.r) / 2} y={H - 3} textAnchor="middle" className="control__axis">
        {labels.seconds}
      </text>
      <text x={m.l} y={m.t - 4} className="control__axis shot__lbl-w">
        {labels.weight} (g)
      </text>
      <text x={W - m.r} y={m.t - 4} textAnchor="end" className="control__axis shot__lbl-p">
        {labels.pressure} (bar)
      </text>
    </svg>
  );
}
