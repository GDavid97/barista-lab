import { useEffect, useMemo, useRef, useState } from 'react';
import { drinkById } from '../data/drinks';
import {
  DEFAULT_PREINFUSION_S,
  defaultFines,
  simulate,
  simulateShot,
  type PressureProfile,
  type ShotCurve,
  type SimulationInput,
} from '../engine';
import { textureOf } from '../domain/grindGuide';
import { useI18n } from '../i18n';
import type { EspressoScene } from '../lab/espressoScene';
import { frameAt } from '../lab/shotFrame';
import { Slider } from '../ui/fields';
import { stateForDrink, storeSetup, useBrewSetup } from './useBrewSetup';
import './lab.css';

const PROFILES: PressureProfile[] = ['flat', 'preinfusion', 'blooming', 'declining', 'lever'];
const SPEEDS = [1, 2, 4] as const;

interface LabParams {
  grindUm: number;
  doseG: number;
  yieldG: number;
  tempC: number;
  roast: number;
  profile: PressureProfile;
}

/** Interpolated shot state at time t. */
function phaseAt(curve: ShotCurve, t: number): string {
  if (t >= curve.timeS) return 'done';
  const ph = curve.phases.find((p) => t >= p.startS && t < p.endS);
  if (!ph) return 'extract';
  if (ph.kind === 'extract' && t < curve.firstDropS) return 'wetting';
  return ph.kind;
}

function Gauge({ bar, label }: { bar: number; label: string }) {
  // 240° sweep, 0–12 bar.
  const angle = -210 + (Math.min(12, Math.max(0, bar)) / 12) * 240;
  const arc = (from: number, to: number, r: number) => {
    const p = (deg: number) => [60 + r * Math.cos((deg * Math.PI) / 180), 60 + r * Math.sin((deg * Math.PI) / 180)];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    return `M${x1},${y1} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2},${y2}`;
  };
  return (
    <svg viewBox="0 0 120 104" className="gauge" role="img" aria-label={`${label}: ${bar.toFixed(1)} bar`}>
      <path d={arc(-210, 30, 46)} className="gauge__track" />
      <path d={arc(-210 + (8 / 12) * 240, -210 + (10 / 12) * 240, 46)} className="gauge__sweet" />
      <path d={arc(-210, angle, 46)} className="gauge__value" />
      {[0, 3, 6, 9, 12].map((v) => {
        const d = ((-210 + (v / 12) * 240) * Math.PI) / 180;
        return (
          <text key={v} x={60 + 33 * Math.cos(d)} y={62 + 33 * Math.sin(d)} textAnchor="middle" dominantBaseline="middle" className="gauge__tick">
            {v}
          </text>
        );
      })}
      <line
        x1={60}
        y1={60}
        x2={60 + 40 * Math.cos((angle * Math.PI) / 180)}
        y2={60 + 40 * Math.sin((angle * Math.PI) / 180)}
        className="gauge__needle"
      />
      <circle cx={60} cy={60} r={5} className="gauge__hub" />
      <text x={60} y={92} textAnchor="middle" className="gauge__value-text">
        {bar.toFixed(1)} bar
      </text>
    </svg>
  );
}

export default function Lab() {
  const { t, tDyn, fmt } = useI18n();
  const setup = useBrewSetup();
  const espresso = drinkById('espresso')!;

  const [p, setP] = useState<LabParams>(() => {
    const isEsp = setup.s.brew.method === 'espresso';
    return {
      grindUm: isEsp ? setup.s.particleUm : espresso.grindUm,
      doseG: isEsp ? setup.s.brew.doseG : espresso.brew.doseG,
      yieldG: isEsp ? setup.s.brew.waterG : espresso.brew.waterG,
      tempC: isEsp ? setup.s.brew.tempC : espresso.brew.tempC,
      roast: setup.s.bean.roast,
      profile: (isEsp && setup.s.brew.profile) || 'flat',
    };
  });

  const input: SimulationInput = useMemo(
    () => ({
      bean: { ...setup.s.bean, roast: p.roast },
      // The dial value is nominal; the personal calibration gives the real particle size.
      grind: { particleUm: p.grindUm * setup.calibration.grindFactor, burr: setup.burr },
      brew: {
        method: 'espresso',
        doseG: p.doseG,
        waterG: p.yieldG,
        tempC: p.tempC,
        pressureBar: setup.s.brew.method === 'espresso' ? (setup.s.brew.pressureBar ?? 9) : 9,
        filter: 'metal',
        profile: p.profile,
        preinfusionS: DEFAULT_PREINFUSION_S[p.profile],
      },
    }),
    [p, setup.s.bean, setup.s.brew, setup.calibration.grindFactor, setup.burr],
  );
  const curve = useMemo(() => simulateShot(input)!, [input]);
  const result = useMemo(() => simulate(input), [input]);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EspressoScene | null>(null);
  const [glError, setGlError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [section, setSection] = useState(false);
  const [autoRotate, setAutoRotate] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [hudT, setHudT] = useState(0);

  // Mutable loop state, read by requestAnimationFrame without re-creating the scene.
  const loop = useRef({ t: 0, playing: true, speed: 1, curve, tds: result.tds });
  loop.current.curve = curve;
  loop.current.tds = result.tds;
  loop.current.playing = playing;
  loop.current.speed = speed;

  // Create the scene once (three.js is code-split into this page's chunk).
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let lastHud = 0;
    let prev = performance.now();
    void import('../lab/espressoScene')
      .then(({ EspressoScene }) => {
        if (disposed || !stageRef.current) return;
        let scene: EspressoScene;
        try {
          scene = new EspressoScene(stageRef.current);
        } catch {
          setGlError(true);
          setLoading(false);
          return;
        }
        sceneRef.current = scene;
        setLoading(false);
        const tick = (now: number) => {
          // Allow big steps so slow devices stay in real time instead of slow motion.
          const dtReal = Math.min(0.5, (now - prev) / 1000);
          prev = now;
          const L = loop.current;
          const end = L.curve.timeS + 1.5;
          let dtSim = 0;
          if (L.playing) {
            dtSim = dtReal * L.speed;
            L.t = Math.min(end, L.t + dtSim);
            if (L.t >= end) setPlaying(false);
          }
          scene.setFrame({ ...frameAt(L.curve, L.t), tds: L.tds, dt: dtSim });
          scene.render();
          if (now - lastHud > 90) {
            lastHud = now;
            setHudT(L.t);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        setGlError(true);
        setLoading(false);
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Keep the puck in sync with the recipe (and build it once the scene has loaded).
  // Keyed by value, so re-created but identical objects do nothing.
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    sceneRef.current?.setPuck({
      grindUm: input.grind.particleUm,
      fines: defaultFines(input.grind.burr, input.grind.particleUm),
      doseG: p.doseG,
      roast: p.roast,
      yieldG: p.yieldG,
    });
  }, [inputKey, loading]);

  // A changed recipe replays the shot from the start (not on first mount or scene load).
  const lastKey = useRef(inputKey);
  useEffect(() => {
    if (lastKey.current === inputKey) return;
    lastKey.current = inputKey;
    loop.current.t = 0;
    setPlaying(true);
  }, [inputKey]);

  useEffect(() => sceneRef.current?.setSection(section), [section, loading]);
  useEffect(() => sceneRef.current?.setAutoRotate(autoRotate), [autoRotate, loading]);

  const set = <K extends keyof LabParams>(k: K, v: LabParams[K]) => setP((x) => ({ ...x, [k]: v }));
  const f = frameAt(curve, hudT);
  const phase = phaseAt(curve, hudT);

  const applyToSimulator = () => {
    const base = setup.s.brew.method === 'espresso' ? setup.s : stateForDrink(espresso, setup.s);
    storeSetup({
      ...base,
      particleUm: p.grindUm,
      autoTime: true,
      bean: { ...base.bean, roast: p.roast },
      brew: { ...base.brew, doseG: p.doseG, waterG: p.yieldG, tempC: p.tempC, profile: p.profile, preinfusionS: DEFAULT_PREINFUSION_S[p.profile] },
    });
    window.location.hash = '#/simulator';
  };

  return (
    <div className="lab">
      <div className="lab__stage">
        <div ref={stageRef} className="lab__canvas" />
        {loading && <div className="lab__loading">{t('lab.loading')}</div>}
        {glError && <div className="lab__loading">{t('lab.webglError')}</div>}

        <header className="lab__title glass">
          <span className="lab__badge">3D</span>
          <div>
            <h2>{t('lab.title')}</h2>
            <p>{t('lab.hint')}</p>
          </div>
        </header>

        <aside className="lab__panel glass">
          <h3>{t('lab.controls')}</h3>
          <Slider
            label={t('fields.particle')}
            value={p.grindUm}
            min={180}
            max={480}
            step={5}
            display={tDyn(`grindTextures.${textureOf(p.grindUm)}`)}
            onChange={(v) => set('grindUm', v)}
          />
          <Slider label={t('fields.dose')} value={p.doseG} min={14} max={22} step={0.5} unit="g" onChange={(v) => set('doseG', v)} />
          <Slider label={t('fields.yield')} value={p.yieldG} min={18} max={60} step={1} unit="g" onChange={(v) => set('yieldG', v)} />
          <Slider label={t('fields.temp')} value={p.tempC} min={86} max={97} step={0.5} temp onChange={(v) => set('tempC', v)} />
          <Slider label={t('fields.roast')} value={p.roast} min={0} max={1} step={0.05} display={`${Math.round(p.roast * 100)}%`} onChange={(v) => set('roast', v)} />
          <div className="field">
            <div className="field__head">
              <span>{t('fields.profile')}</span>
            </div>
            <div className="lab__profiles" role="radiogroup">
              {PROFILES.map((pr) => (
                <button key={pr} type="button" role="radio" aria-checked={p.profile === pr} className={p.profile === pr ? 'is-active' : ''} onClick={() => set('profile', pr)}>
                  {t(`profiles.${pr}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="lab__toggles">
            <label>
              <input type="checkbox" checked={section} onChange={(e) => setSection(e.target.checked)} /> {t('lab.section')}
            </label>
            <label>
              <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> {t('lab.autoRotate')}
            </label>
          </div>
        </aside>

        <aside className="lab__hud glass">
          <Gauge bar={f.pressure} label={t('shot.pressure')} />
          <div className={`lab__phase lab__phase--${phase}`}>{tDyn(`lab.phases.${phase}`)}</div>
          <dl className="lab__stats">
            <div>
              <dt>{t('results.time')}</dt>
              <dd>{fmt(hudT, 1)} s</dd>
            </div>
            <div>
              <dt>{t('shot.weight')}</dt>
              <dd>
                {fmt(f.weight, 1)} / {fmt(p.yieldG)} g
              </dd>
            </div>
            <div>
              <dt>{t('shot.flow')}</dt>
              <dd>{fmt(f.flow, 2)} g/s</dd>
            </div>
          </dl>
          <div className="lab__result">
            <div>
              <span>EY</span>
              <strong>{fmt(result.ey, 1)}%</strong>
            </div>
            <div>
              <span>TDS</span>
              <strong>{fmt(result.tds, 1)}%</strong>
            </div>
            <div>
              <span>⏱</span>
              <strong>{fmt(curve.timeS)} s</strong>
            </div>
          </div>
          <div className={`lab__verdict lab__verdict--${result.extraction}`}>
            {t(`results.extraction.${result.extraction}`)} · {t(`results.balanceLabels.${result.balance}`)}
          </div>
          <button type="button" className="lab__apply" onClick={applyToSimulator}>
            {t('lab.apply')} →
          </button>
        </aside>

        <footer className="lab__timeline glass">
          <button
            type="button"
            className="lab__play"
            aria-label={playing ? t('lab.pause') : t('lab.play')}
            onClick={() => {
              if (!playing && loop.current.t >= curve.timeS + 1.4) loop.current.t = 0;
              setPlaying((x) => !x);
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <div className="lab__track">
            <div className="lab__phases" aria-hidden>
              {curve.phases.map((ph) => (
                <span
                  key={ph.kind}
                  className={`lab__seg lab__seg--${ph.kind}`}
                  style={{ left: `${(ph.startS / curve.timeS) * 100}%`, width: `${((ph.endS - ph.startS) / curve.timeS) * 100}%` }}
                />
              ))}
              <span className="lab__drop" style={{ left: `${(curve.firstDropS / curve.timeS) * 100}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={curve.timeS}
              step={0.1}
              value={Math.min(hudT, curve.timeS)}
              aria-label={t('lab.scrub')}
              onChange={(e) => {
                loop.current.t = Number(e.target.value);
                setPlaying(false);
                setHudT(loop.current.t);
              }}
            />
          </div>
          <div className="lab__speeds" role="radiogroup" aria-label={t('lab.speed')}>
            {SPEEDS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={speed === s} className={speed === s ? 'is-active' : ''} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
          <span className="lab__clock">
            {fmt(Math.min(hudT, curve.timeS), 1)} / {fmt(curve.timeS, 1)} s
          </span>
        </footer>
      </div>
      <p className="help lab__note">{t('lab.note')}</p>
    </div>
  );
}
