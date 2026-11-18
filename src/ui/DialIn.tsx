import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, type UserBrew } from '../db/schema';
import { resetCalibration, type Calibration } from '../domain/calibration';
import { applyPatch, dialInAdvice, type DialInAction } from '../domain/dialIn';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { useTextureText } from './GrindGuide';
import { useCalibration } from '../pages/useCalibration';
import { resolveGrinder, type SimState } from '../pages/useBrewSetup';

const SCALE_KEY: Record<number, string> = { [-2]: 'm2', [-1]: 'm1', 0: 'z', 1: 'p1', 2: 'p2' };

export function CalibrationInfo({ grinderKey, cal }: { grinderKey: string; cal: Calibration }) {
  const { t, fmt } = useI18n();
  if (cal.nTime + cal.nTds === 0)
    return (
      <p className="help">
        {t('calib.none')}{' '}
        <a className="diag__why" href="#/learn/calibration">
          {t('learn.why')} →
        </a>
      </p>
    );
  const pct = Math.round(Math.abs(cal.grindFactor - 1) * 100);
  const sPct = (cal.extractionScale - 1) * 100;
  return (
    <div className="calib">
      {cal.nTime > 0 && (
        <p>
          {pct === 0
            ? t('calib.grindSame', { n: cal.nTime })
            : t('calib.grind', { n: cal.nTime, pct, dir: cal.grindFactor > 1 ? t('calib.coarser') : t('calib.finer') })}
        </p>
      )}
      {cal.nTds > 0 && (
        <p>{t('calib.tds', { n: cal.nTds, sign: sPct >= 0 ? '+' : '−', pct: fmt(Math.abs(sPct), 1) })}</p>
      )}
      <div className="calib__foot">
        <span className="calib__meter" aria-label={t('calib.confidence', { pct: Math.round(cal.confidence * 100) })}>
          <span style={{ width: `${cal.confidence * 100}%` }} />
        </span>
        <span className="muted">{t('calib.confidence', { pct: Math.round(cal.confidence * 100) })}</span>
        <button
          type="button"
          className="link-btn link-btn--danger"
          onClick={() => {
            if (confirm(t('calib.confirmReset'))) resetCalibration(grinderKey);
          }}
        >
          {t('calib.reset')}
        </button>
      </div>
    </div>
  );
}

interface DialInProps {
  brew: UserBrew;
  onApply: (next: SimState) => void;
  applyLabel?: string;
  /** Extra line above the advice (e.g. which brew it is based on). */
  intro?: string;
}

export function DialInPanel({ brew, onApply, applyLabel, intro }: DialInProps) {
  const { t, tDyn } = useI18n();
  const grinders = useLiveQuery(() => db.grinders.toArray(), []);
  const grinder = resolveGrinder(brew.grinderKey ?? brew.setup.grinderId, grinders ?? []);
  const cal = useCalibration(grinder.id);
  const advice = useMemo(() => dialInAdvice(brew, grinder.scale, cal), [brew, grinder.scale, cal]);
  const [applied, setApplied] = useState<string | null>(null);

  const { fmtTemp, tempDelta, tempSymbol } = useSettings();
  const textureText = useTextureText();
  const actionText = (a: DialInAction) => {
    const p = { ...a.params };
    if (typeof p.temp === 'number') p.temp = fmtTemp(p.temp, 1);
    if (typeof p.deg === 'number') p.deg = `${Number(tempDelta(p.deg).toFixed(1))} ${tempSymbol}`;
    if (typeof p.um === 'number') p.texture = textureText(p.um);
    return tDyn(`dialIn.${a.key}`, p);
  };
  const apply = (a: DialInAction) => {
    onApply(applyPatch(brew.setup, a.patch));
    setApplied(a.key);
  };
  const label = applyLabel ?? t('dialIn.apply');
  const r = brew.rating;

  return (
    <div className="dialin">
      {intro && <p className="help">{intro}</p>}
      {r && advice.verdict !== 'unrated' && (
        <p className="help">
          {t('dialIn.basedOn', {
            taste: tDyn(`journal.sb.${SCALE_KEY[r.sourBitter]}`),
            strength: tDyn(`journal.ws.${SCALE_KEY[r.weakStrong]}`),
          })}
        </p>
      )}
      {advice.verdict === 'unrated' && <p className="help">{t('dialIn.unrated')}</p>}
      {advice.verdict === 'keep' && <p className="dialin__keep">{t('dialIn.keep')}</p>}
      {advice.primary && (
        <div className="dialin__primary">
          <span className="dialin__tag">{t('dialIn.recommended')}</span>
          <strong>{actionText(advice.primary)}</strong>
          <button type="button" className="btn btn--primary" onClick={() => apply(advice.primary!)}>
            {label}
          </button>
        </div>
      )}
      {advice.alternatives.length > 0 && (
        <>
          <div className="dialin__or">{t('dialIn.or')}:</div>
          <ul className="dialin__alts">
            {advice.alternatives.map((a) => (
              <li key={a.key}>
                <span>{actionText(a)}</span>
                <button type="button" className="link-btn" onClick={() => apply(a)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {applied && <p className="good">✓ {t('dialIn.applied')}</p>}
    </div>
  );
}
