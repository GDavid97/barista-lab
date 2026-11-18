import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { GRINDERS, grinderById } from '../data/grinders';
import { deleteGrinder, deleteMachine, newId, saveGrinder, saveMachine } from '../db/repo';
import { db, type MachineKind, type UserGrinder, type UserMachine } from '../db/schema';
import { DEFAULT_PREINFUSION_S, scaleFromTwoPoints, type GrindScale, type PressureProfile } from '../engine';
import type { Calibration } from '../domain/calibration';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { CalibrationInfo } from '../ui/DialIn';
import { GrinderRangeList } from '../ui/GrindGuide';
import { useCalibrations } from './useCalibration';
import { Card, NumberField, Segmented, Select, Slider, TextField, Toggle } from '../ui/fields';

const MACHINE_KINDS: MachineKind[] = ['espresso', 'pourover', 'clever', 'immersion', 'aeropress', 'siphon', 'moka', 'turkish', 'coldbrew'];
const CUSTOM = 'custom';

export function Gear() {
  const { t } = useI18n();
  const grinders = useLiveQuery(() => db.grinders.orderBy('createdAt').toArray(), []);
  const calibrations = useCalibrations((grinders ?? []).map((g) => `user:${g.id}`));
  const machines = useLiveQuery(() => db.machines.orderBy('createdAt').toArray(), []);
  const [editGrinder, setEditGrinder] = useState<UserGrinder | 'new' | null>(null);
  const [editMachine, setEditMachine] = useState<UserMachine | 'new' | null>(null);

  return (
    <div className="page">
      <section className="page__section">
        <div className="page__head">
          <h2>{t('gear.grinders')}</h2>
          {editGrinder === null && (
            <button type="button" className="btn btn--primary" onClick={() => setEditGrinder('new')}>
              + {t('gear.newGrinder')}
            </button>
          )}
        </div>
        {editGrinder !== null && (
          <GrinderForm
            initial={editGrinder === 'new' ? undefined : editGrinder}
            onDone={() => setEditGrinder(null)}
          />
        )}
        <div className="list">
          {grinders?.length === 0 && editGrinder === null && <p className="empty">{t('common.empty')}</p>}
          {grinders?.map((g) => (
            <GrinderRow key={g.id} g={g} cal={calibrations[`user:${g.id}`]} onEdit={() => setEditGrinder(g)} />
          ))}
        </div>
      </section>

      <section className="page__section">
        <div className="page__head">
          <h2>{t('gear.machines')}</h2>
          {editMachine === null && (
            <button type="button" className="btn btn--primary" onClick={() => setEditMachine('new')}>
              + {t('gear.newMachine')}
            </button>
          )}
        </div>
        {editMachine !== null && (
          <MachineForm
            initial={editMachine === 'new' ? undefined : editMachine}
            onDone={() => setEditMachine(null)}
          />
        )}
        <div className="list">
          {machines?.length === 0 && editMachine === null && <p className="empty">{t('common.empty')}</p>}
          {machines?.map((m) => (
            <MachineRow key={m.id} m={m} onEdit={() => setEditMachine(m)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Grinders ---------------- */

function GrinderRow({ g, cal, onEdit }: { g: UserGrinder; cal?: Calibration; onEdit: () => void }) {
  const { t } = useI18n();
  const source =
    g.scaleSource === 'twoPoint' ? t('gear.sourceTwoPoint') : g.scaleSource === 'manual' ? t('gear.sourceManual') : t('gear.sourcePreset');
  return (
    <div className="row-card">
      <div className="row-card__main">
        <div className="row-card__title">
          {g.name}
          {g.isDefault && <span className="badge badge--ideal">{t('common.isDefault')}</span>}
        </div>
        <div className="row-card__meta">
          {t(`burrs.${g.burr}`)} · {g.kind === 'manual' ? t('gear.manual') : t('gear.electric')} ·{' '}
          <GrinderRangeList scale={g.scale} />
          <br />
          <span className={g.scaleSource === 'preset' ? 'muted' : 'good'}>{source}</span>
        </div>
        {cal && (
          <details className="calib-details" open={cal.nTime + cal.nTds > 0}>
            <summary>{t('calib.title')}</summary>
            <CalibrationInfo grinderKey={`user:${g.id}`} cal={cal} />
          </details>
        )}
      </div>
      <div className="row-card__actions">
        {!g.isDefault && (
          <button type="button" className="link-btn" onClick={() => saveGrinder(db, { ...g, isDefault: true })}>
            {t('common.makeDefault')}
          </button>
        )}
        <button type="button" className="link-btn" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button
          type="button"
          className="link-btn link-btn--danger"
          onClick={() => {
            if (confirm(t('common.confirmDelete', { name: g.name }))) void deleteGrinder(db, g.id);
          }}
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

type ScaleMode = UserGrinder['scaleSource'];

function GrinderForm({ initial, onDone }: { initial?: UserGrinder; onDone: () => void }) {
  const { t } = useI18n();
  const [presetId, setPresetId] = useState(initial?.presetId ?? (initial ? CUSTOM : GRINDERS[0]!.id));
  const preset = grinderById(presetId);
  const [name, setName] = useState(initial?.name ?? preset?.name ?? '');
  const [burr, setBurr] = useState(initial?.burr ?? preset?.burr ?? 'conical');
  const [kind, setKind] = useState(initial?.kind ?? preset?.kind ?? 'manual');
  const [mode, setMode] = useState<ScaleMode>(initial?.scaleSource ?? (preset ? 'preset' : 'twoPoint'));
  const [manual, setManual] = useState<GrindScale>(
    initial?.scale ?? preset?.scale ?? { zeroUm: 0, umPerStep: 25, min: 0, max: 40, step: 1 },
  );
  const [cal, setCal] = useState(initial?.calibration ?? { espressoSetting: 10, pouroverSetting: 22 });
  const [nameError, setNameError] = useState(false);

  const pickPreset = (id: string) => {
    setPresetId(id);
    const p = grinderById(id);
    if (p) {
      setName(p.name);
      setBurr(p.burr);
      setKind(p.kind);
      setManual(p.scale);
      if (mode === 'manual') setMode('preset');
    } else if (mode === 'preset') {
      setMode('twoPoint');
    }
  };

  const bounds = { min: manual.min, max: manual.max, step: manual.step };
  const scale: GrindScale | undefined =
    mode === 'preset'
      ? preset?.scale
      : mode === 'twoPoint'
        ? scaleFromTwoPoints(cal.espressoSetting, cal.pouroverSetting, bounds)
        : manual.umPerStep > 0
          ? manual
          : undefined;

  const save = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    if (!scale) return;
    await saveGrinder(db, {
      id: initial?.id ?? newId(),
      name: name.trim(),
      presetId: preset?.id,
      burr,
      kind,
      scale,
      scaleSource: mode,
      calibration: mode === 'twoPoint' ? cal : undefined,
      isDefault: initial?.isDefault ?? false,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    onDone();
  };

  const modes: { value: ScaleMode; label: string }[] = [
    ...(preset ? [{ value: 'preset' as const, label: t('gear.scalePreset') }] : []),
    { value: 'twoPoint', label: t('gear.scaleTwoPoint') },
    { value: 'manual', label: t('gear.scaleManual') },
  ];

  return (
    <Card className="form-card">
      <Select
        label={t('gear.preset')}
        value={presetId}
        options={[
          ...GRINDERS.map((g) => ({ value: g.id, label: g.name, group: t(`grinderGroups.${g.category}`) })),
          { value: CUSTOM, label: t('gear.customModel') },
        ]}
        onChange={pickPreset}
      />
      <TextField
        label={t('common.name')}
        value={name}
        error={nameError ? t('common.required') : undefined}
        onChange={(v) => {
          setName(v);
          setNameError(false);
        }}
      />
      <div className="form-grid">
        <Segmented
          label={t('fields.burr')}
          value={burr}
          options={(['conical', 'flat'] as const).map((b) => ({ value: b, label: t(`burrs.${b}`) }))}
          onChange={setBurr}
        />
        <Segmented
          label={t('gear.kind')}
          value={kind}
          options={[
            { value: 'manual', label: t('gear.manual') },
            { value: 'electric', label: t('gear.electric') },
          ]}
          onChange={setKind}
        />
      </div>
      <Segmented label={t('gear.scaleMode')} value={mode} options={modes} onChange={setMode} />

      {mode !== 'preset' && (
        <div className="form-grid form-grid--3">
          <NumberField label={t('gear.min')} value={manual.min} onChange={(v) => setManual({ ...manual, min: v })} />
          <NumberField label={t('gear.max')} value={manual.max} onChange={(v) => setManual({ ...manual, max: v })} />
          <NumberField
            label={t('gear.step')}
            value={manual.step}
            step={0.05}
            min={0.05}
            onChange={(v) => v > 0 && setManual({ ...manual, step: v })}
          />
        </div>
      )}
      {mode === 'twoPoint' && (
        <>
          <p className="help">{t('gear.twoPointHelp')}</p>
          <div className="form-grid">
            <NumberField
              label={t('gear.espressoSetting')}
              value={cal.espressoSetting}
              step={manual.step}
              onChange={(v) => setCal({ ...cal, espressoSetting: v })}
            />
            <NumberField
              label={t('gear.pouroverSetting')}
              value={cal.pouroverSetting}
              step={manual.step}
              onChange={(v) => setCal({ ...cal, pouroverSetting: v })}
            />
          </div>
        </>
      )}
      {mode === 'manual' && (
        <div className="form-grid">
          <NumberField label={t('gear.zeroUm')} value={manual.zeroUm} unit="µm" onChange={(v) => setManual({ ...manual, zeroUm: v })} />
          <NumberField
            label={t('gear.umPerStep')}
            value={manual.umPerStep}
            unit="µm"
            step={0.5}
            onChange={(v) => setManual({ ...manual, umPerStep: v })}
          />
        </div>
      )}

      {scale ? (
        <p className="help">
          <strong>{t('grindGuide.ranges')}:</strong> <GrinderRangeList scale={scale} />
        </p>
      ) : (
        <p className="field__error">{t('gear.invalidCalibration')}</p>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" disabled={!scale} onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </Card>
  );
}

/* ---------------- Machines ---------------- */

function MachineRow({ m, onEdit }: { m: UserMachine; onEdit: () => void }) {
  const { t, fmt } = useI18n();
  const { fmtTemp } = useSettings();
  const details: string[] = [t(`gear.machineKinds.${m.kind}`)];
  if (m.kind === 'espresso') {
    details.push(`${fmt(m.pressureBar ?? 9, 1)} bar`, `${m.basketDiameterMm ?? 58} mm`);
    if (m.profile && m.profile !== 'flat') details.push(t(`profiles.${m.profile}`));
    if (m.hasPid) details.push('PID');
    else if (m.tempC) details.push(fmtTemp(m.tempC, 1));
  }
  return (
    <div className="row-card">
      <div className="row-card__main">
        <div className="row-card__title">
          {m.name}
          {m.isDefault && <span className="badge badge--ideal">{t('common.isDefault')}</span>}
        </div>
        <div className="row-card__meta">{details.join(' · ')}</div>
      </div>
      <div className="row-card__actions">
        {!m.isDefault && (
          <button type="button" className="link-btn" onClick={() => saveMachine(db, { ...m, isDefault: true })}>
            {t('common.makeDefault')}
          </button>
        )}
        <button type="button" className="link-btn" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button
          type="button"
          className="link-btn link-btn--danger"
          onClick={() => {
            if (confirm(t('common.confirmDelete', { name: m.name }))) void deleteMachine(db, m.id);
          }}
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

function MachineForm({ initial, onDone }: { initial?: UserMachine; onDone: () => void }) {
  const { t } = useI18n();
  const [m, setM] = useState<UserMachine>(
    initial ?? {
      id: newId(),
      name: '',
      kind: 'espresso',
      pressureBar: 9,
      basketDiameterMm: 58,
      preinfusionS: 0,
      hasPid: true,
      tempC: 93,
      isDefault: false,
      createdAt: Date.now(),
    },
  );
  const [nameError, setNameError] = useState(false);
  const patch = (p: Partial<UserMachine>) => setM((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!m.name.trim()) {
      setNameError(true);
      return;
    }
    await saveMachine(db, { ...m, name: m.name.trim() });
    onDone();
  };

  return (
    <Card className="form-card">
      <TextField
        label={t('common.name')}
        value={m.name}
        error={nameError ? t('common.required') : undefined}
        onChange={(v) => {
          patch({ name: v });
          setNameError(false);
        }}
      />
      <Select
        label={t('gear.kind')}
        value={m.kind}
        options={MACHINE_KINDS.map((k) => ({ value: k, label: t(`gear.machineKinds.${k}`) }))}
        onChange={(kind) => patch({ kind })}
      />
      {m.kind === 'espresso' && (
        <>
          <Slider label={t('fields.pressure')} value={m.pressureBar ?? 9} min={3} max={12} step={0.5} unit="bar" onChange={(v) => patch({ pressureBar: v })} />
          <Slider label={t('fields.basket')} value={m.basketDiameterMm ?? 58} min={49} max={60} step={1} unit="mm" onChange={(v) => patch({ basketDiameterMm: v })} />
          <Select<PressureProfile>
            label={t('fields.profile')}
            value={m.profile ?? 'flat'}
            options={(['flat', 'preinfusion', 'blooming', 'declining', 'lever'] as const).map((p) => ({ value: p, label: t(`profiles.${p}`) }))}
            hint={t(`profileHints.${m.profile ?? 'flat'}`)}
            onChange={(profile) =>
              patch({ profile, preinfusionS: profile === 'flat' || profile === 'declining' ? 0 : DEFAULT_PREINFUSION_S[profile] })
            }
          />
          <Slider label={t('fields.preinfusion')} value={m.preinfusionS ?? 0} min={0} max={20} step={1} unit={t('units.seconds')} onChange={(v) => patch({ preinfusionS: v })} />
          <Toggle label={t('gear.hasPid')} checked={m.hasPid ?? false} onChange={(v) => patch({ hasPid: v })} />
          {!m.hasPid && (
            <Slider label={t('gear.fixedTemp')} value={m.tempC ?? 93} min={85} max={98} step={0.5} temp onChange={(v) => patch({ tempC: v })} />
          )}
        </>
      )}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </Card>
  );
}
