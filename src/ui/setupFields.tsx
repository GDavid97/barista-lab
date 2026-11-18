import { DRINKS } from '../data/drinks';
import { settingToUm, umToSetting } from '../engine';
import { scalePos, SCALE_MAX_UM, SCALE_MIN_UM, textureOf } from '../domain/grindGuide';
import { GrindGuide } from './GrindGuide';
import { GRINDERS } from '../data/grinders';
import { useI18n } from '../i18n';
import { CUSTOM, USER_PREFIX, type BrewSetup } from '../pages/useBrewSetup';
import { Segmented, Select, Slider } from './fields';

export function DrinkPicker({ setup }: { setup: BrewSetup }) {
  const { t, tDyn } = useI18n();
  return (
    <>
      {(['espresso', 'milk', 'filter'] as const).map((g) => (
        <div key={g} className="drink-group">
          <div className="drink-group__label">{t(`groups.${g}`)}</div>
          <div className="chips">
            {DRINKS.filter((d) => d.group === g).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`chip${d.id === setup.s.drinkId ? ' is-active' : ''}`}
                aria-pressed={d.id === setup.s.drinkId}
                onClick={() => setup.pickDrink(d)}
              >
                {tDyn(`drinks.${d.id}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** Dial setting text for the current grinder, e.g. "10 – finom, mint a porcukor". */
export function useGrindLabel(setup: BrewSetup): string {
  const { t, tDyn, fmt } = useI18n();
  const scale = setup.grinder.scale;
  const texture = tDyn(`grindTextures.${textureOf(setup.s.particleUm)}`);
  if (!scale) return t('wizard.grindUmOnly', { texture });
  const setting = umToSetting(scale, setup.s.particleUm);
  return t('wizard.grindLabel', { setting: fmt(setting, scale.step < 1 ? 1 : 0), texture });
}

/** Position 0–100 on a log scale ↔ particle size, for grinders without a known dial. */
const posToUm = (pos: number) => Math.round(Math.exp(Math.log(SCALE_MIN_UM) + (pos / 100) * (Math.log(SCALE_MAX_UM) - Math.log(SCALE_MIN_UM))));

export function GrinderFields({ setup }: { setup: BrewSetup }) {
  const { t, tDyn } = useI18n();
  const { s, set, grinder, savedGrinders } = setup;
  const grindScale = grinder.scale;
  const setting = grindScale ? umToSetting(grindScale, s.particleUm) : undefined;

  return (
    <>
      <Select
        label={t('fields.grinder')}
        value={grinder.id}
        options={[
          ...(savedGrinders ?? []).map((g) => ({ value: USER_PREFIX + g.id, label: g.name, group: t('simExtra.myGrinders') })),
          ...GRINDERS.map((g) => ({ value: g.id, label: g.name, group: t(`grinderGroups.${g.category}`) })),
          { value: CUSTOM, label: t('fields.customGrinder') },
        ]}
        hint={savedGrinders?.length === 0 ? t('simExtra.gearHint') : undefined}
        onChange={(v) => set('grinderId', v)}
      />
      {grindScale && setting !== undefined ? (
        <Slider
          label={t('fields.setting')}
          value={setting}
          min={grindScale.min}
          max={grindScale.max}
          step={grindScale.step}
          hint={grinder.approximate && setup.calibration.nTime === 0 ? t('fields.approxScale') : undefined}
          onChange={(v) => set('particleUm', settingToUm(grindScale, v))}
        />
      ) : (
        <>
          <Slider
            label={t('fields.particle')}
            value={Math.round(scalePos(s.particleUm) * 100)}
            min={0}
            max={100}
            step={1}
            display={tDyn(`grindTextures.${textureOf(s.particleUm)}`)}
            onChange={(v) => set('particleUm', posToUm(v))}
          />
          <Segmented
            label={t('fields.burr')}
            value={s.customBurr}
            options={(['conical', 'flat'] as const).map((b) => ({ value: b, label: t(`burrs.${b}`) }))}
            onChange={(v) => set('customBurr', v)}
          />
        </>
      )}
      <GrindGuide um={s.particleUm} drinkId={s.drinkId} scale={grindScale} />
    </>
  );
}
