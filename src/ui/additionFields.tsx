import type { FoamType, SyrupType } from '../engine';
import { useI18n } from '../i18n';
import type { BrewSetup } from '../pages/useBrewSetup';
import { Segmented, Select, Slider } from './fields';

const FOAMS: FoamType[] = ['silky', 'airy', 'none'];
const SYRUPS: SyrupType[] = ['vanilla', 'caramel', 'hazelnut', 'chocolate'];

/** Foam texture and steaming temperature (shown when the drink has milk). */
export function MilkTexture({ setup }: { setup: BrewSetup }) {
  const { t } = useI18n();
  const { s, setAdd } = setup;
  return (
    <>
      <Segmented<FoamType>
        label={t('fields.foam')}
        value={s.additions.foam ?? 'silky'}
        options={FOAMS.map((f) => ({ value: f, label: t(`foams.${f}`) }))}
        onChange={(foam) => setAdd({ foam })}
      />
      <Slider
        label={t('fields.milkTemp')}
        value={s.additions.milkTempC ?? 60}
        min={40}
        max={80}
        step={1}
        temp
        onChange={(milkTempC) => setAdd({ milkTempC })}
      />
    </>
  );
}

export function SyrupFields({ setup }: { setup: BrewSetup }) {
  const { t } = useI18n();
  const { s, setAdd } = setup;
  const syrup = s.additions.syrup;
  return (
    <>
      <Select
        label={t('fields.syrupType')}
        value={syrup && syrup.ml > 0 ? syrup.type : ''}
        options={[{ value: '', label: t('fields.noSyrup') }, ...SYRUPS.map((y) => ({ value: y, label: t(`syrups.${y}`) }))]}
        onChange={(v) => setAdd({ syrup: v ? { type: v as SyrupType, ml: syrup?.ml || (v === 'chocolate' ? 20 : 10) } : undefined })}
      />
      {syrup && syrup.ml > 0 && (
        <Slider
          label={t('fields.syrup')}
          value={syrup.ml}
          min={5}
          max={40}
          step={5}
          unit="ml"
          onChange={(ml) => setAdd({ syrup: { ...syrup, ml } })}
        />
      )}
    </>
  );
}
