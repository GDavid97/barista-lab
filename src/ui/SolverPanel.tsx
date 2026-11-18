import { useEffect, useState } from 'react';
import { goalTarget, solveRecipe, TASTE_GOALS, type SolveResult, type TasteGoal } from '../domain/solver';
import { idealsFor, umToSetting } from '../engine';
import { useI18n } from '../i18n';
import type { BrewSetup, SimState } from '../pages/useBrewSetup';
import { useSettings } from '../settings';
import { Slider, Toggle } from './fields';
import { useTextureText } from './GrindGuide';

type Mode = TasteGoal | 'custom';

export function SolverPanel({ setup }: { setup: BrewSetup }) {
  const { t, tDyn, fmt } = useI18n();
  const { fmtTemp } = useSettings();
  const textureText = useTextureText();
  const { s, setS, burr, grinder, calibration, input, result: current } = setup;
  const [mode, setMode] = useState<Mode>('balanced');
  const [lockTemp, setLockTemp] = useState(false);
  const ideal = idealsFor(input);
  const espresso = s.brew.method === 'espresso';
  const tdsDigits = espresso ? 1 : 2;
  const [custom, setCustom] = useState(() => goalTarget('balanced', s, burr));
  const [solved, setSolved] = useState<SolveResult | null>(null);
  const [applied, setApplied] = useState(false);

  // A different drink means different windows: start fresh.
  useEffect(() => {
    setSolved(null);
    setApplied(false);
    setCustom(goalTarget('balanced', s, burr));
  }, [s.drinkId]);

  const target = mode === 'custom' ? custom : goalTarget(mode, s, burr);

  const solve = () => {
    setSolved(solveRecipe(s, target, { burr, cal: calibration, scale: grinder.scale, lockTemp }));
    setApplied(false);
  };

  const grindText = (st: SimState) =>
    grinder.scale
      ? `${fmt(umToSetting(grinder.scale, st.particleUm), grinder.scale.step < 1 ? 1 : 0)} – ${textureText(st.particleUm)}`
      : textureText(st.particleUm);
  const timeText = (sec: number) =>
    s.brew.method === 'coldbrew' ? `${fmt(sec / 3600, 1)} ${t('units.hours')}` : `${fmt(sec)} ${t('units.seconds')}`;

  const rows: [string, string, string | undefined][] = solved
    ? [
        [t('fields.setting'), grindText(s), grindText(solved.state)],
        [espresso ? t('fields.yield') : t('fields.water'), `${fmt(s.brew.waterG)} g`, `${fmt(solved.state.brew.waterG)} g`],
        [t('fields.ratio'), `1 : ${fmt(s.brew.waterG / s.brew.doseG, 1)}`, `1 : ${fmt(solved.state.brew.waterG / solved.state.brew.doseG, 1)}`],
        [t('fields.temp'), fmtTemp(s.brew.tempC, 1), fmtTemp(solved.state.brew.tempC, 1)],
        [t('results.time'), timeText(current.timeS), timeText(solved.result.timeS)],
        [t('results.ey'), `${fmt(current.ey, 1)} %`, `${fmt(solved.result.ey, 1)} %`],
        [t('results.tds'), `${fmt(current.tds, tdsDigits)} %`, `${fmt(solved.result.tds, tdsDigits)} %`],
      ]
    : [];

  return (
    <div className="solver">
      <p className="help">{t('solver.lead', { dose: fmt(s.brew.doseG, 1) })}</p>
      <div className="chips solver__goals" role="radiogroup" aria-label={t('solver.title')}>
        {[...TASTE_GOALS, 'custom' as const].map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={mode === g}
            className={`chip${mode === g ? ' is-active' : ''}`}
            onClick={() => setMode(g)}
          >
            {g === 'custom' ? t('solver.custom') : tDyn(`solver.goals.${g}`)}
          </button>
        ))}
      </div>
      {mode === 'custom' && (
        <>
          <Slider
            label={t('solver.targetEy')}
            value={custom.ey}
            min={ideal.ey[0] - 3}
            max={ideal.ey[1] + 3}
            step={0.1}
            unit="%"
            onChange={(ey) => setCustom((c) => ({ ...c, ey }))}
          />
          <Slider
            label={t('solver.targetTds')}
            value={custom.tds}
            min={Number((ideal.tds[0] * 0.6).toFixed(2))}
            max={Number((ideal.tds[1] * 1.4).toFixed(2))}
            step={espresso ? 0.1 : 0.01}
            unit="%"
            onChange={(tds) => setCustom((c) => ({ ...c, tds }))}
          />
        </>
      )}
      <p className="help">
        {t('solver.target')}: EY {fmt(target.ey, 1)} % · TDS {fmt(target.tds, tdsDigits)} %
      </p>
      {s.brew.method !== 'coldbrew' && s.brew.method !== 'moka' && (
        <Toggle label={t('solver.lockTemp')} checked={lockTemp} onChange={setLockTemp} />
      )}
      <button type="button" className="btn btn--primary btn--block" onClick={solve}>
        🎯 {t('solver.solve')}
      </button>

      {solved && (
        <div className="subform">
          <p className={`solver__status ${solved.feasible ? 'is-ok' : 'is-warn'}`}>
            {solved.feasible ? t('solver.feasible') : t('solver.infeasible')}
          </p>
          <table className="kv-table solver__table">
            <thead>
              <tr>
                <th />
                <th>{t('solver.current')}</th>
                <th>{t('solver.proposed')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{a}</td>
                  <td className={a !== b ? 'is-changed' : ''}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {solved.notes.map((n) => (
            <p key={n} className="help">
              • {tDyn(`solver.notes.${n}`)}
            </p>
          ))}
          {applied ? (
            <p className="good">✓ {t('solver.applied')}</p>
          ) : (
            <button
              type="button"
              className="btn btn--block"
              onClick={() => {
                setS(solved.state);
                setApplied(true);
              }}
            >
              {t('solver.apply')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
