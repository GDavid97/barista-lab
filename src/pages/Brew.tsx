import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/schema';
import { brewSteps } from '../domain/brewSteps';
import { simulateShot, type MilkType, type Process } from '../engine';
import { useI18n } from '../i18n';
import { Card, Select, Slider, Toggle } from '../ui/fields';
import { LESSON_FOR_DIAGNOSIS } from '../data/lessons';
import { MilkTexture, SyrupFields } from '../ui/additionFields';
import { DialInPanel } from '../ui/DialIn';
import { useDiagText } from '../ui/diagText';
import { useTextureText } from '../ui/GrindGuide';
import { DrinkPicker, GrinderFields, useGrindLabel } from '../ui/setupFields';
import { FreshnessBadge, roastKey } from './Beans';
import { BrewRunner } from './BrewRunner';
import { applyMachine, useBrewSetup, type BrewSetup } from './useBrewSetup';

const STEP_KEY = 'baristaLab.wizard.step';
const STEPS = ['drink', 'bean', 'gear', 'recipe', 'brew'] as const;
export const WIZARD_RECIPE_STEP = 3;
const PROCESSES: Process[] = ['washed', 'natural', 'honey', 'anaerobic', 'wetHulled'];
const MILK_TYPES: MilkType[] = ['whole', 'semi', 'skim', 'oat', 'almond', 'soy'];

function loadStep(): number {
  try {
    const v = Number(localStorage.getItem(STEP_KEY));
    return Number.isInteger(v) && v >= 0 && v < STEPS.length ? v : 0;
  } catch {
    return 0;
  }
}

/** Jump into the wizard at a given step (used by the simulator's "Brew this" button). */
export function openWizardAt(step: number): void {
  try {
    localStorage.setItem(STEP_KEY, String(step));
  } catch {
    /* ignore */
  }
  window.location.hash = '#/brew';
}

export function Brew() {
  const { t } = useI18n();
  const setup = useBrewSetup();
  const [step, setStep] = useState(loadStep);

  useEffect(() => {
    try {
      localStorage.setItem(STEP_KEY, String(step));
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  }, [step]);

  const grindLabel = useGrindLabel(setup);
  const shot = useMemo(() => simulateShot(setup.input), [setup.input]);
  const steps = useMemo(
    () => brewSteps(setup.input, { timeS: setup.result.timeS, grindLabel, shot }),
    [setup.input, setup.result.timeS, grindLabel, shot],
  );

  return (
    <div className="page wizard">
      <ol className="stepper" aria-label="steps">
        {STEPS.map((k, i) => (
          <li key={k} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="stepper__num">{i < step ? '✓' : i + 1}</span>
              <span className="stepper__label">{t(`wizard.steps.${k}`)}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card title={t('sections.drink')}>
          <DrinkPicker setup={setup} />
        </Card>
      )}
      {step === 1 && <BeanStep setup={setup} />}
      {step === 2 && <GearStep setup={setup} />}
      {step === 3 && <RecipeStep setup={setup} grindLabel={grindLabel} />}
      {step === 4 && <BrewRunner setup={setup} steps={steps} shot={shot} grindLabel={grindLabel} onNewBrew={() => setStep(0)} onEditRecipe={() => setStep(3)} />}

      {step < 4 && (
        <div className="wizard__nav">
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            ← {t('wizard.back')}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setStep((s) => s + 1)}>
            {step === 3 ? `${t('wizard.toBrew')} →` : `${t('wizard.next')} →`}
          </button>
        </div>
      )}
    </div>
  );
}

function BeanStep({ setup }: { setup: BrewSetup }) {
  const { t, fmt } = useI18n();
  const { s, activeBeans, selectedBean, pickBean, setBean } = setup;
  const dose = s.brew.doseG;

  return (
    <Card title={t('sections.bean')}>
      {activeBeans.length === 0 && <p className="help">{t('wizard.noShelf')}</p>}
      <div className="pick-list" role="radiogroup">
        {activeBeans.map((b) => {
          const on = selectedBean?.id === b.id;
          return (
            <button key={b.id} type="button" role="radio" aria-checked={on} className={`pick${on ? ' is-active' : ''}`} onClick={() => pickBean(b.id)}>
              <span className="pick__title">{b.name}</span>
              <span className="pick__meta">
                {t(roastKey(b.roast))} · {t(`processes.${b.process}`)} · {fmt(b.stockG)} g
              </span>
              <FreshnessBadge roastDate={b.roastDate} />
              {b.stockG < dose && <span className="badge badge--bad">{t('wizard.lowStock', { left: fmt(b.stockG), dose })}</span>}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!selectedBean}
          className={`pick${!selectedBean ? ' is-active' : ''}`}
          onClick={() => pickBean('')}
        >
          <span className="pick__title">{t('wizard.manualBeanTitle')}</span>
          <span className="pick__meta">
            {t(roastKey(s.bean.roast))} · {t(`processes.${s.bean.process}`)}
          </span>
        </button>
      </div>
      {!selectedBean && (
        <div className="subform">
          <Slider
            label={t('fields.roast')}
            value={s.bean.roast}
            min={0}
            max={1}
            step={0.05}
            display={t(roastKey(s.bean.roast))}
            onChange={(v) => setBean({ roast: v })}
          />
          <Select
            label={t('fields.process')}
            value={s.bean.process}
            options={PROCESSES.map((p) => ({ value: p, label: t(`processes.${p}`) }))}
            onChange={(v) => setBean({ process: v })}
          />
          <Slider
            label={t('fields.robusta')}
            value={Math.round(s.bean.robustaShare * 100)}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => setBean({ robustaShare: v / 100 })}
          />
          <Slider
            label={t('fields.daysOffRoast')}
            value={s.bean.daysOffRoast ?? 14}
            min={0}
            max={120}
            step={1}
            unit={t('units.days')}
            onChange={(v) => setBean({ daysOffRoast: v })}
          />
        </div>
      )}
    </Card>
  );
}

function GearStep({ setup }: { setup: BrewSetup }) {
  const { t } = useI18n();
  const { s, setS, methodMachines } = setup;
  return (
    <>
      <Card title={t('sections.grinder')}>
        <GrinderFields setup={setup} />
      </Card>
      {methodMachines.length > 0 && (
        <Card title={t('simExtra.machine')}>
          <Select
            label={t('simExtra.machine')}
            value={s.machineId && methodMachines.some((m) => m.id === s.machineId) ? s.machineId : ''}
            options={[{ value: '', label: t('simExtra.noMachine') }, ...methodMachines.map((m) => ({ value: m.id, label: m.name }))]}
            onChange={(id) => setS((p) => applyMachine(p, methodMachines.find((m) => m.id === id)))}
          />
        </Card>
      )}
    </>
  );
}

function RecipeStep({ setup, grindLabel }: { setup: BrewSetup; grindLabel: string }) {
  const { t, tDyn, fmt, lang } = useI18n();
  const diagText = useDiagText();
  const textureText = useTextureText();
  // Most recent rated brew of this drink with these beans: base the next step on it.
  const lastRated = useLiveQuery(
    () =>
      db.brews
        .orderBy('createdAt')
        .reverse()
        .filter((b) => b.drinkId === setup.s.drinkId && b.beanId === setup.s.beanId && !!b.rating)
        .first(),
    [setup.s.drinkId, setup.s.beanId],
  );
  const { s, setS, setBrew, setAdd, result, method, selectedBean, suggestion, set } = setup;
  const isEspresso = method === 'espresso';
  const espressoLike = isEspresso || method === 'moka';
  const ratio = s.brew.waterG / s.brew.doseG;
  const canAutoTime = method === 'espresso' || method === 'pourover';
  const topDiag = result.diagnoses[0];

  return (
    <>
      <Card title={`${t('wizard.steps.recipe')} · ${tDyn(`drinks.${s.drinkId}`)}`}>
        <p className="help">
          {t('fields.setting')}: <strong>{grindLabel}</strong>
        </p>
        {selectedBean && selectedBean.stockG < s.brew.doseG && (
          <p className="field__error">{t('wizard.lowStock', { left: fmt(selectedBean.stockG), dose: s.brew.doseG })}</p>
        )}
        <Slider
          label={t('fields.dose')}
          value={s.brew.doseG}
          min={method === 'coldbrew' ? 30 : 6}
          max={method === 'coldbrew' ? 250 : method === 'immersion' || method === 'pourover' ? 60 : 30}
          step={0.5}
          unit="g"
          onChange={(v) => setBrew({ doseG: v })}
        />
        <Slider
          label={isEspresso ? t('fields.yield') : t('fields.water')}
          value={s.brew.waterG}
          min={isEspresso ? 10 : 60}
          max={isEspresso ? 90 : method === 'coldbrew' ? 2000 : 1000}
          step={1}
          unit="g"
          hint={`${t('fields.ratio')} 1 : ${fmt(ratio, 1)}`}
          onChange={(v) => setBrew({ waterG: v })}
        />
        {method !== 'moka' && (
          <Slider
            label={t('fields.temp')}
            value={s.brew.tempC}
            min={method === 'coldbrew' ? 2 : 75}
            max={method === 'coldbrew' ? 30 : 100}
            step={0.5}
            temp
            onChange={(v) => setBrew({ tempC: v })}
          />
        )}
        {method === 'coldbrew' ? (
          <Slider
            label={t('fields.time')}
            value={(s.brew.timeS ?? 14 * 3600) / 3600}
            min={1}
            max={24}
            step={0.5}
            unit={t('units.hours')}
            onChange={(h) => setBrew({ timeS: h * 3600 })}
          />
        ) : method !== 'moka' ? (
          <>
            {canAutoTime && (
              <Toggle
                label={t('fields.timeAuto')}
                hint={t('fields.timeAutoHint')}
                checked={s.autoTime}
                onChange={(v) => setS((p) => ({ ...p, autoTime: v, brew: { ...p.brew, timeS: Math.round(result.timeS) } }))}
              />
            )}
            <Slider
              label={t('fields.time')}
              value={Math.round(s.autoTime && canAutoTime ? result.timeS : (s.brew.timeS ?? result.timeS))}
              min={isEspresso ? 8 : 30}
              max={isEspresso ? 70 : 600}
              step={1}
              unit={t('units.seconds')}
              disabled={s.autoTime && canAutoTime}
              onChange={(v) => setBrew({ timeS: v })}
            />
          </>
        ) : null}
        {espressoLike && (
          <>
            <Slider label={t('fields.milk')} value={s.additions.milkMl ?? 0} min={0} max={350} step={5} unit="ml" onChange={(v) => setAdd({ milkMl: v })} />
            {(s.additions.milkMl ?? 0) > 0 && (
              <Select
                label={t('fields.milkType')}
                value={s.additions.milkType ?? 'whole'}
                options={MILK_TYPES.map((m) => ({ value: m, label: t(`milks.${m}`) }))}
                onChange={(v) => setAdd({ milkType: v })}
              />
            )}
            {(s.additions.milkMl ?? 0) > 0 && <MilkTexture setup={setup} />}
            <SyrupFields setup={setup} />
          </>
        )}
      </Card>

      {lastRated && (
        <Card title={t('dialIn.title')}>
          <DialInPanel
            brew={lastRated}
            intro={t('dialIn.lastBrew', {
              when: new Date(lastRated.createdAt).toLocaleString(lang === 'hu' ? 'hu-HU' : 'en-GB', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
            onApply={(next) => setup.setS(next)}
          />
        </Card>
      )}

      <Card title={t('wizard.estimate')}>
        <div className="badges">
          <span className={`badge badge--${result.extraction}`}>{t(`results.extraction.${result.extraction}`)}</span>
          <span className={`badge badge--${result.strength === 'ideal' ? 'ideal' : 'warn'}`}>{t(`results.strength.${result.strength}`)}</span>
          <span className="badge badge--neutral">{t(`results.balanceLabels.${result.balance}`)}</span>
        </div>
        <div className="metrics">
          <div className="metric">
            <div className="metric__label">{t('results.ey')}</div>
            <div className="metric__value">{fmt(result.ey, 1)} %</div>
          </div>
          <div className="metric">
            <div className="metric__label">{t('results.tds')}</div>
            <div className="metric__value">{fmt(result.tds, isEspresso ? 1 : 2)} %</div>
          </div>
          {method !== 'moka' && (
            <div className="metric">
              <div className="metric__label">{t('results.time')}</div>
              <div className="metric__value">
                {method === 'coldbrew' ? `${fmt(result.timeS / 3600, 1)} ${t('units.hours')}` : `${fmt(result.timeS)} ${t('units.seconds')}`}
              </div>
              {result.timePredicted && <div className="metric__sub">{t('results.predicted')}</div>}
            </div>
          )}
        </div>
        {topDiag && (
          <ul className="diag">
            <li className={`diag__item diag__item--${topDiag.severity}`}>
              {diagText(topDiag)}
              {LESSON_FOR_DIAGNOSIS[topDiag.key] && (
                <a className="diag__why" href={`#/learn/${LESSON_FOR_DIAGNOSIS[topDiag.key]}`}>
                  {t('learn.why')} →
                </a>
              )}
            </li>
          </ul>
        )}
        {suggestion?.kind === 'grind' && (
          <div className="suggest">
            <strong>{t('diag.suggestGrind', { texture: textureText(suggestion.um) })}</strong>
            <button type="button" className="link-btn" onClick={() => set('particleUm', suggestion.um)}>
              {t('app.apply')}
            </button>
          </div>
        )}
        {suggestion?.kind === 'dose' && (
          <div className="suggest">
            <strong>{t('diag.suggestDose', { dose: fmt(suggestion.dose, 1) })}</strong>
            <button type="button" className="link-btn" onClick={() => setBrew({ doseG: Math.round(suggestion.dose * 2) / 2 })}>
              {t('app.apply')}
            </button>
          </div>
        )}
        <a className="link-btn" href="#/simulator">
          {t('wizard.openSimulator')} →
        </a>
      </Card>
    </>
  );
}

