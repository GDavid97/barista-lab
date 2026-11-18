import { useMemo, useState } from 'react';
import {
  umToSetting,
  simulateShot,
  DEFAULT_PREINFUSION_S,
  type PressureProfile,
  type SimulationResult,
  type FilterType,
  type MilkType,
  type Process,
  type SensoryProfile,
} from '../engine';
import { useI18n } from '../i18n';
import { FreshnessBadge, roastKey } from './Beans';
import { applyMachine, useBrewSetup } from './useBrewSetup';
import { openWizardAt, WIZARD_RECIPE_STEP } from './Brew';
import { ControlChart, RadarChart, ShotChart } from '../ui/charts';
import { SolverPanel } from '../ui/SolverPanel';
import { Card, Segmented, Select, Slider, Toggle } from '../ui/fields';
import { CalibrationInfo } from '../ui/DialIn';
import { LESSON_FOR_DIAGNOSIS } from '../data/lessons';
import { WATER_PRESETS, matchPreset } from '../data/water';
import { useDiagText } from '../ui/diagText';
import { useTextureText } from '../ui/GrindGuide';
import { MilkTexture, SyrupFields } from '../ui/additionFields';
import { useSettings } from '../settings';
import { DrinkPicker, GrinderFields } from '../ui/setupFields';

const PROCESSES: Process[] = ['washed', 'natural', 'honey', 'anaerobic', 'wetHulled'];
const FILTERS: FilterType[] = ['paper', 'metal', 'cloth'];
const PROFILES: PressureProfile[] = ['flat', 'preinfusion', 'blooming', 'declining', 'lever'];
const MILK_TYPES: MilkType[] = ['whole', 'semi', 'skim', 'oat', 'almond', 'soy'];

export function Simulator() {
  const { t, tDyn, fmt } = useI18n();
  const diagText = useDiagText();
  const textureText = useTextureText();
  // "What if?": a pinned result to compare the live one against.
  const [pinned, setPinned] = useState<SimulationResult | null>(null);
  const delta = (now: number, before: number | undefined, digits: number) => {
    if (before === undefined) return undefined;
    const d = now - before;
    if (Math.abs(d) < Math.pow(10, -digits) / 2) return '±0';
    return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), digits)}`;
  };
  const { settings, update: updateSettings } = useSettings();
  const setup = useBrewSetup();
  const {
    s,
    setS,
    set,
    setBean,
    setBrew,
    setAdd,
    drink,
    method,
    grinder,
    activeBeans,
    selectedBean,
    methodMachines,
    pickDrink,
    pickBean,
    result,
    suggestion,
    calibration,
  } = setup;

  const isEspressoLike = method === 'espresso' || method === 'moka';
  const yieldLabel = method === 'espresso' ? t('fields.yield') : t('fields.water');
  const ratio = s.brew.waterG / s.brew.doseG;
  const effectiveTime = s.autoTime ? result.timeS : (s.brew.timeS ?? result.timeS);
  const shot = useMemo(() => simulateShot(setup.input), [setup.input]);
  const sensoryLabels = Object.fromEntries(
    (Object.keys(result.sensory) as (keyof SensoryProfile)[]).map((k) => [k, t(`sensory.${k}`)]),
  ) as Record<keyof SensoryProfile, string>;

  const timeField = (() => {
    if (method === 'moka') return null;
    if (method === 'coldbrew') {
      return (
        <Slider
          label={t('fields.time')}
          value={(s.brew.timeS ?? 14 * 3600) / 3600}
          min={1}
          max={24}
          step={0.5}
          unit={t('units.hours')}
          onChange={(h) => setBrew({ timeS: h * 3600 })}
        />
      );
    }
    const range = method === 'espresso' ? [8, 70] : method === 'pourover' ? [60, 480] : [30, 600];
    return (
      <>
        {(method === 'espresso' || method === 'pourover') && (
          <Toggle
            label={t('fields.timeAuto')}
            hint={t('fields.timeAutoHint')}
            checked={s.autoTime}
            onChange={(v) => setS((p) => ({ ...p, autoTime: v, brew: { ...p.brew, timeS: Math.round(result.timeS) } }))}
          />
        )}
        <Slider
          label={t('fields.time')}
          value={Math.round(effectiveTime)}
          min={range[0]!}
          max={range[1]!}
          step={1}
          unit={t('units.seconds')}
          disabled={s.autoTime}
          onChange={(v) => setBrew({ timeS: v })}
        />
      </>
    );
  })();

  const grindScale = grinder.scale;

  return (
    <div className="sim">
      <div className="sim__inputs">
        <Card title={t('sections.drink')}>
          <DrinkPicker setup={setup} />
          <Segmented
            value={settings.advanced ? 'adv' : 'simple'}
            options={[
              { value: 'simple', label: t('app.simple') },
              { value: 'adv', label: t('app.advanced') },
            ]}
            onChange={(v) => updateSettings({ advanced: v === 'adv' })}
          />
        </Card>

        <Card title={t('sections.bean')}>
          {activeBeans.length > 0 && (
            <Select
              label={t('simExtra.beanSource')}
              value={selectedBean ? selectedBean.id : ''}
              options={[
                { value: '', label: t('simExtra.manualBean') },
                ...activeBeans.map((b) => ({
                  value: b.id,
                  label: t('simExtra.fromStock', { name: b.name, g: fmt(b.stockG) }),
                  group: t('simExtra.myBeans'),
                })),
              ]}
              hint={selectedBean && <FreshnessBadge roastDate={selectedBean.roastDate} />}
              onChange={pickBean}
            />
          )}
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
          {settings.advanced && (
            <Slider
              label={t('fields.altitude')}
              value={s.bean.altitudeM ?? 1500}
              min={0}
              max={2500}
              step={50}
              unit="m"
              onChange={(v) => setBean({ altitudeM: v })}
            />
          )}
        </Card>

        <Card title={t('sections.grinder')}>
          <GrinderFields setup={setup} />
          <details className="calib-details" open={calibration.nTime + calibration.nTds > 0}>
            <summary>{t('calib.title')}</summary>
            <CalibrationInfo grinderKey={grinder.id} cal={calibration} />
          </details>
        </Card>

        <Card title={t('sections.brew')}>
          {methodMachines.length > 0 && (
            <Select
              label={t('simExtra.machine')}
              value={s.machineId && methodMachines.some((m) => m.id === s.machineId) ? s.machineId : ''}
              options={[
                { value: '', label: t('simExtra.noMachine') },
                ...methodMachines.map((m) => ({ value: m.id, label: m.name })),
              ]}
              onChange={(id) => setS((p) => applyMachine(p, methodMachines.find((m) => m.id === id)))}
            />
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
            label={yieldLabel}
            value={s.brew.waterG}
            min={method === 'espresso' ? 10 : 60}
            max={method === 'espresso' ? 90 : method === 'coldbrew' ? 2000 : 1000}
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
          {timeField}
          {method === 'espresso' && (
            <Select<PressureProfile>
              label={t('fields.profile')}
              value={s.brew.profile ?? 'flat'}
              options={PROFILES.map((p) => ({ value: p, label: t(`profiles.${p}`) }))}
              hint={t(`profileHints.${s.brew.profile ?? 'flat'}`)}
              onChange={(profile) =>
                setBrew({ profile, preinfusionS: profile === 'flat' || profile === 'declining' ? 0 : DEFAULT_PREINFUSION_S[profile] })
              }
            />
          )}
          {method === 'espresso' && settings.advanced && (
            <>
              <Slider
                label={t('fields.pressure')}
                value={s.brew.pressureBar ?? 9}
                min={3}
                max={12}
                step={0.5}
                unit="bar"
                onChange={(v) => setBrew({ pressureBar: v })}
              />
              <Slider
                label={t('fields.preinfusion')}
                value={s.brew.preinfusionS ?? 0}
                min={0}
                max={20}
                step={1}
                unit={t('units.seconds')}
                onChange={(v) => setBrew({ preinfusionS: v })}
              />
              <Slider
                label={t('fields.basket')}
                value={s.brew.basketDiameterMm ?? 58}
                min={49}
                max={60}
                step={1}
                unit="mm"
                onChange={(v) => setBrew({ basketDiameterMm: v })}
              />
            </>
          )}
          {!isEspressoLike && method !== 'turkish' && (
            <Segmented
              label={t('fields.filter')}
              value={s.brew.filter}
              options={FILTERS.map((f) => ({ value: f, label: t(`filters.${f}`) }))}
              onChange={(v) => setBrew({ filter: v })}
            />
          )}
        </Card>

        <Card title={t('sections.additions')}>
          {isEspressoLike && (
            <>
              <Slider
                label={t('fields.milk')}
                value={s.additions.milkMl ?? 0}
                min={0}
                max={350}
                step={5}
                unit="ml"
                onChange={(v) => setAdd({ milkMl: v })}
              />
              {(s.additions.milkMl ?? 0) > 0 && (
                <Select
                  label={t('fields.milkType')}
                  value={s.additions.milkType ?? 'whole'}
                  options={MILK_TYPES.map((m) => ({ value: m, label: t(`milks.${m}`) }))}
                  onChange={(v) => setAdd({ milkType: v })}
                />
              )}
              {(s.additions.milkMl ?? 0) > 0 && <MilkTexture setup={setup} />}
              <Slider
                label={t('fields.extraWater')}
                value={s.additions.waterMl ?? 0}
                min={0}
                max={300}
                step={5}
                unit="ml"
                onChange={(v) => setAdd({ waterMl: v })}
              />
            </>
          )}
          <Slider
            label={t('fields.sugar')}
            value={s.additions.sugarG ?? 0}
            min={0}
            max={20}
            step={1}
            unit="g"
            onChange={(v) => setAdd({ sugarG: v })}
          />
          <SyrupFields setup={setup} />
        </Card>

        {settings.advanced && (
          <Card title={t('sections.water')}>
            <Toggle label={t('fields.waterKnown')} checked={s.waterKnown} onChange={(v) => set('waterKnown', v)} />
            {s.waterKnown && (
              <>
                <Select
                  label={t('fields.waterPreset')}
                  value={matchPreset(s.water)}
                  options={[
                    ...WATER_PRESETS.map((p) => ({ value: p.id, label: tDyn(`waterPresets.${p.id}`) })),
                    { value: 'custom', label: t('waterPresets.custom') },
                  ]}
                  hint={t('fields.waterPresetHint')}
                  onChange={(id) => {
                    const p = WATER_PRESETS.find((x) => x.id === id);
                    if (p) set('water', { ...p.water });
                  }}
                />
                <Slider
                  label={t('fields.gh')}
                  value={s.water.ghPpm ?? 70}
                  min={0}
                  max={300}
                  step={5}
                  unit="ppm"
                  onChange={(v) => set('water', { ...s.water, ghPpm: v })}
                />
                <Slider
                  label={t('fields.kh')}
                  value={s.water.khPpm ?? 40}
                  min={0}
                  max={250}
                  step={5}
                  unit="ppm"
                  onChange={(v) => set('water', { ...s.water, khPpm: v })}
                />
              </>
            )}
          </Card>
        )}

        <button type="button" className="link-btn" onClick={() => pickDrink(drink)}>
          {t('app.reset')}
        </button>
      </div>

      <div className="sim__results" id="sim-results">
        <Card title={`${t('sections.results')} · ${tDyn(`drinks.${drink.id}`)}`} className="results">
          <div className="badges">
            <span className={`badge badge--${result.extraction}`}>{t(`results.extraction.${result.extraction}`)}</span>
            <span className={`badge badge--${result.strength === 'ideal' ? 'ideal' : 'warn'}`}>
              {t(`results.strength.${result.strength}`)}
            </span>
            <span className="badge badge--neutral">{t(`results.balanceLabels.${result.balance}`)}</span>
            {calibration.nTime + calibration.nTds > 0 && (
              <span className="badge badge--ideal">{t('calib.badge', { n: calibration.nTime + calibration.nTds })}</span>
            )}
          </div>
          <div className="metrics">
            <Metric
              label={t('results.ey')}
              value={`${fmt(result.ey, 1)} %`}
              delta={delta(result.ey, pinned?.ey, 1)}
              sub={`± ${fmt(result.eyUncertainty, 1)} · ${t('results.ideal')} ${result.idealEy[0]}–${result.idealEy[1]}`}
            />
            <Metric
              label={t('results.tds')}
              value={`${fmt(result.tds, method === 'espresso' ? 1 : 2)} %`}
              delta={delta(result.tds, pinned?.tds, method === 'espresso' ? 1 : 2)}
              sub={`${t('results.ideal')} ${fmt(result.idealTds[0], method === 'espresso' ? 0 : 2)}–${fmt(result.idealTds[1], method === 'espresso' ? 0 : 2)}`}
            />
            {method !== 'moka' && (
              <Metric
                delta={delta(result.timeS, pinned?.timeS, 0)}
                label={t('results.time')}
                value={method === 'coldbrew' ? `${fmt(result.timeS / 3600, 1)} ${t('units.hours')}` : `${fmt(result.timeS)} ${t('units.seconds')}`}
                sub={
                  result.timePredicted
                    ? `${t('results.predicted')}${result.idealTimeS ? ` · ${t('results.ideal')} ${result.idealTimeS[0]}–${result.idealTimeS[1]}` : ''}`
                    : undefined
                }
              />
            )}
            <Metric label={t('results.caffeine')} value={`${fmt(result.caffeineMg)} mg`} delta={delta(result.caffeineMg, pinned?.caffeineMg, 0)} />
            <Metric
              label={t('results.volume')}
              value={`${fmt(result.finalVolumeMl)} ml`}
              sub={result.finalVolumeMl !== result.beverageG ? `${t('results.beverage')}: ${fmt(result.beverageG)} g` : undefined}
            />
            <Metric label={t('results.kcal')} value={`${fmt(result.kcal)} kcal`} delta={delta(result.kcal, pinned?.kcal, 0)} />
          </div>
          <div className="whatif">
            {pinned ? (
              <>
                <span className="whatif__label">🔀 {t('whatIf.pinned')}</span>
                <button type="button" className="link-btn" onClick={() => setPinned(null)}>
                  {t('whatIf.clear')}
                </button>
                <p className="help">{t('whatIf.hint')}</p>
              </>
            ) : (
              <button type="button" className="btn btn--block" onClick={() => setPinned(result)}>
                📌 {t('whatIf.pin')}
              </button>
            )}
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={() => openWizardAt(WIZARD_RECIPE_STEP)}>
            ☕ {t('wizard.fromSimulator')} →
          </button>
        </Card>

        {shot && (
          <Card title={t('shot.title')}>
            <ShotChart
              curve={shot}
              labels={{ weight: t('shot.weight'), pressure: t('shot.pressure'), flow: t('shot.flow'), seconds: t('shot.seconds') }}
            />
            <div className="shot-legend">
              <span className="lw">{t('shot.weight')}</span>
              <span className="lp">{t('shot.pressure')}</span>
              <span className="lq">{t('shot.flow')}</span>
            </div>
            <p className="help">
              {t('shot.firstDrop', { s: fmt(shot.firstDropS) })} · {t('shot.total', { s: fmt(shot.timeS) })}
            </p>
          </Card>
        )}

        <Card title={`🎯 ${t('solver.title')}`}>
          <SolverPanel setup={setup} />
        </Card>

        <Card title={t('sections.profile')}>
          {pinned && (
            <div className="legend">
              <span className="legend__item legend__item--a">{t('whatIf.legendNow')}</span>
              <span className="legend__item legend__item--b">{t('whatIf.legendPinned')}</span>
            </div>
          )}
          <RadarChart profile={result.sensory} compare={pinned?.sensory} labels={sensoryLabels} />
          <div className="field__head"><span>{t('sections.notes')}</span></div>
          <div className="chips">
            {result.flavorNotes.map((n) => (
              <span key={n} className="chip chip--static">
                {tDyn(`notes.${n}`)}
              </span>
            ))}
          </div>
        </Card>

        <Card title={t('sections.chart')}>
          <ControlChart
            method={method}
            ey={result.ey}
            tds={result.tds}
            eyUncertainty={result.eyUncertainty}
            idealEy={result.idealEy}
            idealTds={result.idealTds}
            labels={{
              ey: t('chart.ey'),
              tds: t('chart.tds'),
              weak: t('chart.weak'),
              strong: t('chart.strong'),
              under: t('chart.under'),
              over: t('chart.over'),
            }}
            fmt={fmt}
          />
        </Card>

        <Card title={t('sections.diagnosis')}>
          <ul className="diag">
            {result.diagnoses.map((d) => (
              <li key={d.key} className={`diag__item diag__item--${d.severity}`}>
                {diagText(d)}
                {LESSON_FOR_DIAGNOSIS[d.key] && (
                  <a className="diag__why" href={`#/learn/${LESSON_FOR_DIAGNOSIS[d.key]}`}>
                    {t('learn.why')} →
                  </a>
                )}
              </li>
            ))}
          </ul>
          {suggestion?.kind === 'grind' && (
            <div className="suggest">
              <strong>{t('diag.suggestGrind', { texture: textureText(suggestion.um) })}</strong>
              {grindScale && <span> {t('diag.suggestGrindSetting', { setting: fmt(umToSetting(grindScale, suggestion.um), grindScale.step < 1 ? 1 : 0) })}</span>}
              <button type="button" className="link-btn" onClick={() => set('particleUm', suggestion.um)}>
                {t('app.apply')}
              </button>
            </div>
          )}
          {suggestion?.kind === 'dose' && (
            <div className="suggest">
              <strong>{t('diag.suggestDose', { dose: fmt(suggestion.dose, 1) })}</strong>
              <button
                type="button"
                className="link-btn"
                onClick={() => setBrew({ doseG: Math.round(suggestion.dose * 2) / 2 })}
              >
                {t('app.apply')}
              </button>
            </div>
          )}
          <p className="disclaimer">{t('app.disclaimer')}</p>
        </Card>
      </div>

      <button
        type="button"
        className="sticky-summary"
        aria-label={t('results.jump')}
        onClick={() => document.getElementById('sim-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      >
        <span>EY {fmt(result.ey, 1)}%</span>
        <span>TDS {fmt(result.tds, method === 'espresso' ? 1 : 2)}%</span>
        <span className={`badge badge--${result.extraction}`}>{t(`results.extraction.${result.extraction}`)}</span>
        <span className="sticky-summary__go" aria-hidden="true">↓</span>
      </button>
    </div>
  );
}

function Metric({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: string }) {
  return (
    <div className="metric">
      <div className="metric__label">{label}</div>
      <div className="metric__value">
        {value}
        {delta && <span className="metric__delta">{delta}</span>}
      </div>
      {sub && <div className="metric__sub">{sub}</div>}
    </div>
  );
}
