import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adjustStock, newId, saveBrew } from '../db/repo';
import { db } from '../db/schema';
import { activeBrewStep, plannedDurationS, type BrewStep } from '../domain/brewSteps';
import { makeBrewRecord } from '../domain/journal';
import { DialInPanel } from '../ui/DialIn';
import { TastingForm } from '../ui/TastingForm';
import { ShotChart } from '../ui/charts';
import { weightAt, type ShotCurve } from '../engine';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { formatClock, stepCue, useWakeLock } from '../ui/brewEffects';
import type { BrewSetup } from './useBrewSetup';

const SESSION_KEY = 'baristaLab.brewSession.v1';

interface Session {
  /** Identifies the recipe the session belongs to; a changed recipe starts over. */
  signature: string;
  phase: 'prep' | 'brew' | 'finish' | 'done';
  checked: string[];
  startedAt?: number;
  pausedAt?: number;
  pausedTotalMs: number;
  /** Brew steps before this index were confirmed or skipped by the user. */
  manualDone: number;
  endedElapsedS?: number;
  /** Steps frozen when the timer starts, so recipe drift cannot disturb a running brew. */
  steps?: BrewStep[];
  stock?: { beanId: string; doseG: number; left?: number; undone?: boolean };
  /** Journal entry created when the brew was completed. */
  brewId?: string;
}

const isInProgress = (s: Session) => s.phase === 'brew' || s.phase === 'finish';

const fresh = (signature: string): Session => ({ signature, phase: 'prep', checked: [], pausedTotalMs: 0, manualDone: 0 });

function loadSession(signature: string): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Session;
      // A brew in progress always resumes (e.g. after a reload); otherwise follow the current recipe.
      // A finished brew is already in the journal, so it never needs restoring.
      if (isInProgress(s) || (s.signature === signature && s.phase === 'prep')) return s;
    }
  } catch {
    /* ignore */
  }
  return fresh(signature);
}

export function clearBrewSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

interface Props {
  setup: BrewSetup;
  steps: BrewStep[];
  grindLabel: string;
  /** Espresso: predicted shot curve, shown live while brewing. */
  shot?: ShotCurve;
  onNewBrew: () => void;
  /** Jump back to the recipe step (after applying a dial-in suggestion). */
  onEditRecipe: () => void;
}

export function BrewRunner({ setup, steps: liveSteps, grindLabel, shot, onNewBrew, onEditRecipe }: Props) {
  const { t, tDyn, fmt, lang } = useI18n();
  const { fmtTemp } = useSettings();
  const signature = useMemo(
    () => JSON.stringify([setup.s.drinkId, setup.s.beanId ?? null, liveSteps.map((s) => [s.key, s.endS ?? null, s.targetG ?? null])]),
    [setup.s.drinkId, setup.s.beanId, liveSteps],
  );
  const [session, setSession] = useState<Session>(() => loadSession(signature));
  const steps = session.phase === 'prep' ? liveSteps : (session.steps ?? liveSteps);
  const [now, setNow] = useState(() => Date.now());

  // Recipe changed while not brewing (still preparing, or a finished brew on screen): follow it.
  useEffect(() => {
    setSession((s) => (s.signature === signature || isInProgress(s) ? s : fresh(signature)));
  }, [signature]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }, [session]);

  const running = session.phase === 'brew' && session.pausedAt === undefined;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  useWakeLock(session.phase === 'brew' || session.phase === 'finish');

  const prep = steps.filter((s) => s.phase === 'prep');
  const brew = steps.filter((s) => s.phase === 'brew');
  const finish = steps.filter((s) => s.phase === 'finish');
  const planned = plannedDurationS(steps);

  const elapsedS =
    session.startedAt === undefined
      ? 0
      : ((session.pausedAt ?? now) - session.startedAt - session.pausedTotalMs) / 1000;
  const activeIdx = session.phase === 'brew' ? activeBrewStep(brew, elapsedS, session.manualDone) : -1;

  // Step change cues and automatic hand-over to the finish phase.
  const prevIdx = useRef(activeIdx);
  useEffect(() => {
    if (session.phase !== 'brew') {
      prevIdx.current = activeIdx;
      return;
    }
    if (activeIdx !== prevIdx.current && prevIdx.current >= 0) stepCue(activeIdx >= brew.length);
    prevIdx.current = activeIdx;
    if (activeIdx >= brew.length) {
      setSession((s) => ({ ...s, phase: 'finish', endedElapsedS: elapsedS }));
    }
  }, [activeIdx, brew.length, session.phase, elapsedS]);

  const text = (s: BrewStep) => {
    const params: Record<string, string | number> = { ...s.params, milkTemp: `${fmtTemp(55)}–${fmtTemp(65)}` };
    if (typeof params.temp === 'number') params.temp = fmtTemp(params.temp, 1);
    for (const [k, v] of Object.entries(s.paramKeys ?? {})) params[k] = tDyn(v);
    return tDyn(`steps.${s.key}`, params);
  };

  const toggleCheck = (id: string) =>
    setSession((s) => ({ ...s, checked: s.checked.includes(id) ? s.checked.filter((x) => x !== id) : [...s.checked, id] }));

  const start = () => {
    const t0 = Date.now();
    setNow(t0);
    setSession((s) => ({ ...s, phase: 'brew', steps: liveSteps, startedAt: t0, pausedAt: undefined, pausedTotalMs: 0, manualDone: 0 }));
  };
  const pause = () => setSession((s) => ({ ...s, pausedAt: Date.now() }));
  const resume = () =>
    setSession((s) => ({ ...s, pausedTotalMs: s.pausedTotalMs + (Date.now() - (s.pausedAt ?? Date.now())), pausedAt: undefined }));
  const next = () => setSession((s) => ({ ...s, manualDone: Math.max(s.manualDone, activeIdx + 1) }));
  const abort = () => {
    if (confirm(t('brewMode.confirmStop'))) setSession(fresh(signature));
  };

  const complete = async () => {
    const beanId = setup.s.beanId;
    const doseG = setup.s.brew.doseG;
    let stock: Session['stock'];
    if (beanId) {
      const left = await adjustStock(db, beanId, -doseG);
      if (left !== undefined) stock = { beanId, doseG, left };
    }
    const brewId = newId();
    await saveBrew(
      db,
      makeBrewRecord({
        id: brewId,
        now: Date.now(),
        setup: setup.s,
        result: setup.result,
        grindLabel,
        grinderName: setup.grinder.name,
        grinderKey: setup.grinder.id,
        burr: setup.burr,
        beanName: setup.selectedBean?.name,
        brewTimeS: session.endedElapsedS,
        plannedS: plannedDurationS(steps),
      }),
    );
    setSession((s) => ({ ...s, phase: 'done', stock, brewId }));
    stepCue(true);
  };

  const loggedBrew = useLiveQuery(() => (session.brewId ? db.brews.get(session.brewId) : undefined), [session.brewId]);

  const undoStock = async () => {
    const st = session.stock;
    if (!st || st.undone) return;
    await adjustStock(db, st.beanId, st.doseG);
    setSession((s) => ({ ...s, stock: s.stock && { ...s.stock, undone: true } }));
  };

  /* ---------- Prep ---------- */
  if (session.phase === 'prep') {
    return (
      <div className="runner">
        <div className="runner__head">
          <h2>{t('brewMode.prep')}</h2>
          {planned !== undefined && <span className="muted">{t('brewMode.planned', { t: formatClock(planned) })}</span>}
        </div>
        <p className="help">{t('brewMode.prepHint')}</p>
        <Checklist steps={prep} checked={session.checked} text={text} onToggle={toggleCheck} />
        <button type="button" className="btn btn--primary btn--big" onClick={start}>
          ▶ {t('brewMode.start')}
        </button>
        <p className="help">{t('brewMode.wakeLock')}</p>
      </div>
    );
  }

  /* ---------- Brew ---------- */
  if (session.phase === 'brew') {
    const step = brew[Math.min(activeIdx, brew.length - 1)];
    const upcoming = brew[activeIdx + 1];
    const timed = step?.endS !== undefined;
    const stepStart = step?.startS ?? 0;
    const stepLen = timed ? step!.endS! - stepStart : 0;
    const stepProgress = timed && stepLen > 0 ? Math.min(1, Math.max(0, (elapsedS - stepStart) / stepLen)) : 0;
    const stepLeft = timed ? Math.max(0, step!.endS! - elapsedS) : 0;
    const longBrew = (planned ?? 0) >= 3600;
    const endsAt =
      longBrew && session.startedAt !== undefined && planned !== undefined && session.pausedAt === undefined
        ? new Date(session.startedAt + session.pausedTotalMs + planned * 1000).toLocaleTimeString(lang === 'hu' ? 'hu-HU' : 'en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : undefined;
    const totalProgress = planned ? Math.min(1, elapsedS / planned) : undefined;

    return (
      <div className="runner">
        <div className="runner__clock" aria-live="off">
          <div className="runner__time">{formatClock(elapsedS)}</div>
          {planned !== undefined && <div className="muted">/ {formatClock(planned)}</div>}
          {session.pausedAt !== undefined && <span className="badge badge--warn">{t('brewMode.paused')}</span>}
        </div>
        {totalProgress !== undefined && (
          <div className="progress">
            <span style={{ width: `${totalProgress * 100}%` }} />
          </div>
        )}
        {endsAt && <p className="help">{t('brewMode.endsAt', { time: endsAt })}</p>}

        {step && (
          <div className="step-now" aria-live="polite">
            <div className="step-now__count">
              {activeIdx + 1} / {brew.length}
            </div>
            <div className="step-now__text">{text(step)}</div>
            {step.targetG !== undefined && <div className="step-now__target">{t('brewMode.target', { g: fmt(step.targetG) })}</div>}
            {timed ? (
              <>
                <div className="progress progress--step">
                  <span style={{ width: `${stepProgress * 100}%` }} />
                </div>
                <div className="muted">{t('brewMode.stepLeft', { s: formatClock(stepLeft) })}</div>
              </>
            ) : (
              <div className="muted">{t('brewMode.manualStep')}</div>
            )}
          </div>
        )}
        {shot && (
          <div className="shot-live">
            {elapsedS >= shot.firstDropS && elapsedS <= shot.timeS + 2 && (
              <div className="expected-now" aria-live="off">
                {t('shot.expectedNow', { g: fmt(weightAt(shot, elapsedS)) })}
              </div>
            )}
            <ShotChart
              curve={shot}
              cursorS={elapsedS}
              labels={{ weight: t('shot.weight'), pressure: t('shot.pressure'), flow: t('shot.flow'), seconds: t('shot.seconds') }}
            />
          </div>
        )}
        {upcoming && (
          <div className="step-next">
            <span className="muted">{t('brewMode.upNext')}:</span> {text(upcoming)}
          </div>
        )}

        <div className="runner__controls">
          {session.pausedAt === undefined ? (
            <button type="button" className="btn" onClick={pause}>
              ❚❚ {t('brewMode.pause')}
            </button>
          ) : (
            <button type="button" className="btn" onClick={resume}>
              ▶ {t('brewMode.resume')}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={next}>
            {t('brewMode.next')} →
          </button>
        </div>
        <button type="button" className="link-btn link-btn--danger" onClick={abort}>
          {t('brewMode.stop')}
        </button>
      </div>
    );
  }

  /* ---------- Finish ---------- */
  if (session.phase === 'finish') {
    return (
      <div className="runner">
        <div className="runner__head">
          <h2>{t('brewMode.finishTitle')}</h2>
          <span className="muted">
            {t('brewMode.brewTime')}: {formatClock(session.endedElapsedS ?? elapsedS)}
          </span>
        </div>
        <p className="help">{t('brewMode.finishHint')}</p>
        <Checklist steps={finish} checked={session.checked} text={text} onToggle={toggleCheck} />
        <button type="button" className="btn btn--primary btn--big" onClick={() => void complete()}>
          ✓ {t('brewMode.done')}
        </button>
      </div>
    );
  }

  /* ---------- Done ---------- */
  const r = setup.result;
  const bean = setup.selectedBean;
  return (
    <div className="runner runner--done">
      <div className="runner__head">
        <h2>☕ {t('brewMode.complete')}</h2>
      </div>
      <div className="metrics">
        <div className="metric">
          <div className="metric__label">{t('brewMode.brewTime')}</div>
          <div className="metric__value">{formatClock(session.endedElapsedS ?? 0)}</div>
        </div>
        <div className="metric">
          <div className="metric__label">{t('results.ey')}</div>
          <div className="metric__value">{fmt(r.ey, 1)} %</div>
        </div>
        <div className="metric">
          <div className="metric__label">{t('results.tds')}</div>
          <div className="metric__value">{fmt(r.tds, r.method === 'espresso' ? 1 : 2)} %</div>
        </div>
      </div>
      {session.stock ? (
        <div className="suggest">
          {session.stock.undone ? (
            <span>{t('brewMode.undone')}</span>
          ) : (
            <>
              <span>
                {t('brewMode.stockDeducted', {
                  dose: fmt(session.stock.doseG, session.stock.doseG % 1 ? 1 : 0),
                  name: bean?.name ?? '—',
                  left: fmt(session.stock.left ?? 0),
                })}
              </span>
              <button type="button" className="link-btn" onClick={() => void undoStock()}>
                {t('brewMode.undo')}
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="help">{t('brewMode.noBeanStock')}</p>
      )}
      {loggedBrew && (
        <div className="subform">
          <h3 className="card__title">{t('journal.rateNow')}</h3>
          <TastingForm brew={loggedBrew} />
          <h3 className="card__title">{t('dialIn.title')}</h3>
          <DialInPanel
            brew={loggedBrew}
            onApply={(next) => {
              setup.setS(next);
              onEditRecipe();
            }}
          />
          <a className="link-btn" href={`#/journal/${loggedBrew.id}`}>
            {t('journal.openEntry')} →
          </a>
        </div>
      )}
      <div className="runner__controls">
        <button type="button" className="btn" onClick={() => setSession(fresh(signature))}>
          ↻ {t('brewMode.brewAgain')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            clearBrewSession();
            onNewBrew();
          }}
        >
          {t('brewMode.newBrew')}
        </button>
      </div>
    </div>
  );
}

function Checklist({
  steps,
  checked,
  text,
  onToggle,
}: {
  steps: BrewStep[];
  checked: string[];
  text: (s: BrewStep) => string;
  onToggle: (id: string) => void;
}) {
  return (
    <ol className="checklist">
      {steps.map((s) => {
        const done = checked.includes(s.id);
        return (
          <li key={s.id}>
            <label className={done ? 'is-done' : ''}>
              <input type="checkbox" checked={done} onChange={() => onToggle(s.id)} />
              <span>{text(s)}</span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}
