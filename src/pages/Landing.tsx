import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DRINKS, drinkById } from '../data/drinks';
import { simulate } from '../engine';
import { textureOf } from '../domain/grindGuide';
import { useI18n } from '../i18n';
import './landing.css';

/* ---------- small animation helpers ---------- */

/** True once the element has scrolled into view (stays true). */
function useInView<T extends Element>(threshold = 0.2): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`reveal${seen ? ' is-visible' : ''} ${className}`} style={{ '--delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.5);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) {
      setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Safety net: land on the final number even if frames are throttled (background tab).
    const done = setTimeout(() => setV(to), dur + 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [seen, to]);
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  );
}

/* ---------- hero illustration ---------- */

function HeroCup() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art__glow" />
      <svg viewBox="0 0 400 400" className="hero-cup">
        <defs>
          <clipPath id="cupClip">
            <path d="M92 168h196v58a98 98 0 0 1-196 0z" />
          </clipPath>
          <linearGradient id="coffeeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8854f" />
            <stop offset="0.25" stopColor="#7a4424" />
            <stop offset="1" stopColor="#3b2418" />
          </linearGradient>
          <linearGradient id="cupGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#f4ece4" />
            <stop offset="1" stopColor="#e2d4c6" />
          </linearGradient>
        </defs>

        {/* saucer */}
        <ellipse cx="190" cy="332" rx="150" ry="22" className="hero-cup__shadow" />
        <ellipse cx="190" cy="322" rx="140" ry="20" fill="#efe5db" />
        <ellipse cx="190" cy="318" rx="104" ry="12" fill="#e2d4c6" />

        {/* cup */}
        <path d="M288 190h18a40 40 0 0 1 0 80h-26" fill="none" stroke="#efe5db" strokeWidth="18" strokeLinecap="round" />
        <path d="M80 156h220v70a110 110 0 0 1-220 0z" fill="url(#cupGrad)" />

        {/* coffee with a moving surface */}
        <g clipPath="url(#cupClip)">
          <rect x="80" y="176" width="220" height="160" fill="url(#coffeeGrad)" />
          <g className="hero-cup__wave">
            <path
              d="M0 178 q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V200 H0z"
              fill="#a8673b"
              opacity="0.9"
            />
          </g>
          <ellipse cx="160" cy="186" rx="34" ry="5" fill="#e8c9a6" opacity="0.35" className="hero-cup__crema" />
        </g>
        <path d="M80 156h220" stroke="#e2d4c6" strokeWidth="6" strokeLinecap="round" />

        {/* steam */}
        <g className="hero-cup__steam" fill="none" strokeLinecap="round" strokeWidth="9">
          <path d="M150 140c-16-22 16-36 0-60" style={{ animationDelay: '0s' }} />
          <path d="M190 132c-16-22 16-36 0-60" style={{ animationDelay: '1.1s' }} />
          <path d="M230 140c-16-22 16-36 0-60" style={{ animationDelay: '2.2s' }} />
        </g>
      </svg>

      {/* floating beans */}
      {[
        { x: '6%', y: '12%', r: -20, d: 0, s: 1 },
        { x: '82%', y: '8%', r: 35, d: 1.2, s: 0.8 },
        { x: '88%', y: '62%', r: 110, d: 0.6, s: 1.1 },
        { x: '2%', y: '68%', r: 70, d: 1.8, s: 0.9 },
      ].map((b, i) => (
        <svg
          key={i}
          viewBox="0 0 40 56"
          className="bean"
          style={{ left: b.x, top: b.y, '--r': `${b.r}deg`, '--s': b.s, animationDelay: `${b.d}s` } as CSSProperties}
        >
          <ellipse cx="20" cy="28" rx="17" ry="25" fill="#5a3320" />
          <path d="M20 5c-9 12 9 34 0 46" stroke="#2c180f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </svg>
      ))}

      {/* data chips */}
      <div className="chip-float chip-float--a">
        <span>EY</span> 20,1 %
      </div>
      <div className="chip-float chip-float--b">
        <span>TDS</span> 9,8 %
      </div>
      <div className="chip-float chip-float--c">
        <span>⏱</span> 28 s
      </div>
    </div>
  );
}

/* ---------- live demo with the real engine ---------- */

function LiveDemo() {
  const { t, tDyn, fmt } = useI18n();
  const [um, setUm] = useState(330);
  const espresso = drinkById('espresso')!;
  const r = useMemo(
    () =>
      simulate({
        bean: { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 },
        grind: { particleUm: um, burr: 'conical' },
        brew: espresso.brew,
      }),
    [um, espresso.brew],
  );

  // Mini control chart: EY 14–26 on x, TDS 6–14 on y.
  const W = 300;
  const H = 200;
  const x = (ey: number) => 20 + ((Math.min(26, Math.max(14, ey)) - 14) / 12) * (W - 40);
  const y = (tds: number) => H - 20 - ((Math.min(14, Math.max(6, tds)) - 6) / 8) * (H - 40);

  return (
    <div className="demo">
      <div className="demo__controls">
        <label className="demo__label" htmlFor="demo-grind">
          {t('landing.demoGrind')}: <strong>{tDyn(`grindTextures.${textureOf(um)}`)}</strong>
        </label>
        <input
          id="demo-grind"
          type="range"
          min={220}
          max={440}
          step={5}
          value={um}
          onChange={(e) => setUm(Number(e.target.value))}
        />
        <div className="demo__scale">
          <span>← {t('landing.demoFiner')}</span>
          <span>{t('landing.demoCoarser')} →</span>
        </div>
        <div className="demo__stats">
          <div>
            <span>EY</span>
            <strong>{fmt(r.ey, 1)} %</strong>
          </div>
          <div>
            <span>TDS</span>
            <strong>{fmt(r.tds, 1)} %</strong>
          </div>
          <div>
            <span>{t('landing.demoTime')}</span>
            <strong>{fmt(r.timeS)} s</strong>
          </div>
        </div>
        <div className={`demo__verdict demo__verdict--${r.extraction}`}>
          {t(`results.extraction.${r.extraction}`)} · {t(`results.balanceLabels.${r.balance}`)}
          {r.flavorNotes[0] && <> · {tDyn(`notes.${r.flavorNotes[0]}`)}</>}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="demo__chart" role="img" aria-label={`EY ${fmt(r.ey, 1)} %, TDS ${fmt(r.tds, 1)} %`}>
        {[16, 18, 20, 22, 24].map((v) => (
          <line key={v} x1={x(v)} x2={x(v)} y1={20} y2={H - 20} className="demo__grid" />
        ))}
        {[8, 10, 12].map((v) => (
          <line key={v} x1={20} x2={W - 20} y1={y(v)} y2={y(v)} className="demo__grid" />
        ))}
        <rect x={x(18)} y={y(12)} width={x(22) - x(18)} height={y(8) - y(12)} className="demo__ideal" rx="6" />
        <circle cx={x(r.ey)} cy={y(r.tds)} r="16" className="demo__pulse" />
        <circle cx={x(r.ey)} cy={y(r.tds)} r="8" className="demo__dot" />
        <text x={W / 2} y={H - 4} textAnchor="middle" className="demo__axis">
          EY %
        </text>
        <text x={8} y={H / 2} textAnchor="middle" transform={`rotate(-90 8 ${H / 2})`} className="demo__axis">
          TDS %
        </text>
      </svg>
    </div>
  );
}

/* ---------- page ---------- */

const FEATURES = [
  { icon: '⚗️', k: 'f1' },
  { icon: '🎯', k: 'f2' },
  { icon: '⏱️', k: 'f3' },
  { icon: '📓', k: 'f4' },
  { icon: '📈', k: 'f5' },
  { icon: '📖', k: 'f6' },
] as const;

export function Landing() {
  const { t, tDyn } = useI18n();
  const [howRef, howSeen] = useInView<HTMLOListElement>(0.3);

  return (
    <div className="landing">
      {/* HERO */}
      <section className="hero">
        <div className="hero__bg" aria-hidden="true">
          <span className="blob blob--1" />
          <span className="blob blob--2" />
          <span className="blob blob--3" />
        </div>
        <div className="hero__text">
          <span className="hero__eyebrow">☕ {t('landing.eyebrow')}</span>
          <h1 className="hero__title">
            {t('landing.titleA')} <span className="hero__highlight">{t('landing.titleHighlight')}</span> {t('landing.titleB')}
          </h1>
          <p className="hero__lead">{t('landing.lead')}</p>
          <div className="hero__ctas">
            <a href="#/simulator" className="cta cta--primary">
              {t('landing.ctaPrimary')} <span aria-hidden>→</span>
            </a>
            <a href="#/brew" className="cta cta--ghost">
              {t('landing.ctaSecondary')}
            </a>
          </div>
          <p className="hero__note">{t('landing.offlineNote')}</p>
        </div>
        <HeroCup />
      </section>

      {/* STATS */}
      <section className="stats">
        {[
          { n: DRINKS.length, label: t('landing.statDrinks') },
          { n: 9, label: t('landing.statMethods') },
          { n: 7, label: t('landing.statDims') },
          { n: 100, suffix: '%', label: t('landing.statOffline') },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className="stat">
            <div className="stat__num">
              <CountUp to={s.n} suffix={s.suffix} />
            </div>
            <div className="stat__label">{s.label}</div>
          </Reveal>
        ))}
      </section>

      {/* DEMO */}
      <section className="section">
        <Reveal>
          <h2 className="section__title">{t('landing.demoTitle')}</h2>
          <p className="section__lead">{t('landing.demoLead')}</p>
        </Reveal>
        <Reveal delay={120}>
          <LiveDemo />
        </Reveal>
      </section>

      {/* FEATURES */}
      <section className="section">
        <Reveal>
          <h2 className="section__title">{t('landing.featuresTitle')}</h2>
        </Reveal>
        <div className="features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.k} delay={i * 80} className="feature">
              <div className="feature__icon" aria-hidden>
                {f.icon}
              </div>
              <h3>{tDyn(`landing.${f.k}Title`)}</h3>
              <p>{tDyn(`landing.${f.k}Text`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="section">
        <Reveal>
          <h2 className="section__title">{t('landing.howTitle')}</h2>
        </Reveal>
        <ol ref={howRef} className={`how${howSeen ? ' is-visible' : ''}`}>
          {(['how1', 'how2', 'how3'] as const).map((k, i) => (
            <li key={k} style={{ '--delay': `${i * 250}ms` } as CSSProperties}>
              <span className="how__num">{i + 1}</span>
              <div>
                <h3>{tDyn(`landing.${k}Title`)}</h3>
                <p>{tDyn(`landing.${k}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* FINAL CTA */}
      <Reveal>
        <section className="final">
          <h2>{t('landing.finalTitle')}</h2>
          <p>{t('landing.finalText')}</p>
          <a href="#/simulator" className="cta cta--light">
            {t('landing.ctaPrimary')} <span aria-hidden>→</span>
          </a>
        </section>
      </Reveal>
    </div>
  );
}
