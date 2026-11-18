import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { adjustStock, deleteBean, newId, saveBean, setBeanArchived, sortBeans } from '../db/repo';
import { db, type UserBean } from '../db/schema';
import { daysSince, freshnessStatus, todayIso, type FreshnessStatus } from '../domain/freshness';
import type { Process } from '../engine';
import { useI18n, type TKey } from '../i18n';
import { Card, NumberField, Select, Slider, TextField, Toggle } from '../ui/fields';

const PROCESSES: Process[] = ['washed', 'natural', 'honey', 'anaerobic', 'wetHulled'];
const TYPICAL_DOSE_G = 18;

export function roastKey(r: number): TKey {
  if (r < 0.2) return 'roastLevels.veryLight';
  if (r < 0.4) return 'roastLevels.light';
  if (r < 0.6) return 'roastLevels.medium';
  if (r < 0.8) return 'roastLevels.mediumDark';
  return 'roastLevels.dark';
}

const FRESHNESS_CLASS: Record<FreshnessStatus, string> = {
  unknown: 'neutral',
  resting: 'warn',
  peak: 'ideal',
  fading: 'warn',
  stale: 'bad',
};

export function FreshnessBadge({ roastDate }: { roastDate?: string }) {
  const { t } = useI18n();
  const days = daysSince(roastDate);
  const status = freshnessStatus(days);
  return (
    <span className={`badge badge--${FRESHNESS_CLASS[status]}`}>
      {t(`freshness.${status}`)}
      {days !== undefined && ` · ${days === 0 ? t('beansPage.roastedToday') : t('beansPage.daysOff', { days })}`}
    </span>
  );
}

export function Beans() {
  const { t } = useI18n();
  const beans = useLiveQuery(() => db.beans.toArray(), []);
  const [editing, setEditing] = useState<UserBean | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = sortBeans(beans ?? []).filter((b) => showArchived || !b.archived);
  const hasArchived = (beans ?? []).some((b) => b.archived);

  return (
    <div className="page">
      <section className="page__section">
        <div className="page__head">
          <h2>{t('nav.beans')}</h2>
          {editing === null && (
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
              + {t('beansPage.newBean')}
            </button>
          )}
        </div>
        {editing !== null && <BeanForm initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
        {hasArchived && <Toggle label={t('common.showArchived')} checked={showArchived} onChange={setShowArchived} />}
        <div className="list list--beans">
          {visible.length === 0 && editing === null && <p className="empty">{t('common.empty')}</p>}
          {visible.map((b) => (
            <BeanCard key={b.id} bean={b} onEdit={() => setEditing(b)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BeanCard({ bean: b, onEdit }: { bean: UserBean; onEdit: () => void }) {
  const { t, fmt } = useI18n();
  const [adjusting, setAdjusting] = useState(false);
  const [used, setUsed] = useState(TYPICAL_DOSE_G);
  const pct = b.bagG > 0 ? Math.min(100, (b.stockG / b.bagG) * 100) : 0;
  const sub = [b.roaster, b.origin].filter(Boolean).join(' · ');

  return (
    <div className={`bean-card${b.archived ? ' is-archived' : ''}`}>
      <div className="bean-card__head">
        <div>
          <div className="row-card__title">{b.name}</div>
          {sub && <div className="row-card__meta">{sub}</div>}
        </div>
        <FreshnessBadge roastDate={b.roastDate} />
      </div>
      <div className="row-card__meta">
        {t(roastKey(b.roast))} · {t(`processes.${b.process}`)}
        {b.robustaShare > 0 && ` · ${fmt(b.robustaShare * 100)}% robusta`}
        {b.altitudeM !== undefined && ` · ${fmt(b.altitudeM)} m`}
      </div>
      {b.flavorNotes.length > 0 && (
        <div className="chips chips--tight">
          {b.flavorNotes.map((n) => (
            <span key={n} className="chip chip--static">
              {n}
            </span>
          ))}
        </div>
      )}
      <div className="stock">
        <div className="stock__bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} className={pct < 15 ? 'is-low' : ''} />
        </div>
        <div className="stock__text">
          {t('beansPage.stockLeft', { g: fmt(b.stockG) })} ·{' '}
          {t('beansPage.doses', { n: Math.floor(b.stockG / TYPICAL_DOSE_G), dose: TYPICAL_DOSE_G })}
        </div>
      </div>
      {adjusting && (
        <div className="adjust">
          <NumberField label={t('beansPage.used')} value={used} unit="g" min={0} step={0.5} onChange={setUsed} />
          <button
            type="button"
            className="btn"
            onClick={() => {
              void adjustStock(db, b.id, -used);
              setAdjusting(false);
            }}
          >
            − {fmt(used, used % 1 ? 1 : 0)} g
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void saveBean(db, { ...b, stockG: b.stockG + b.bagG, archived: false });
              setAdjusting(false);
            }}
          >
            + {t('beansPage.refill')} ({fmt(b.bagG)} g)
          </button>
        </div>
      )}
      <div className="row-card__actions">
        <button type="button" className="link-btn" onClick={() => setAdjusting((v) => !v)}>
          {t('beansPage.adjust')}
        </button>
        <button type="button" className="link-btn" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button type="button" className="link-btn" onClick={() => void setBeanArchived(db, b.id, !b.archived)}>
          {b.archived ? t('common.unarchive') : t('common.archive')}
        </button>
        <button
          type="button"
          className="link-btn link-btn--danger"
          onClick={() => {
            if (confirm(t('common.confirmDelete', { name: b.name }))) void deleteBean(db, b.id);
          }}
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

function BeanForm({ initial, onDone }: { initial?: UserBean; onDone: () => void }) {
  const { t } = useI18n();
  const [b, setB] = useState<UserBean>(
    initial ?? {
      id: newId(),
      name: '',
      process: 'washed',
      roast: 0.4,
      robustaShare: 0,
      roastDate: todayIso(),
      flavorNotes: [],
      stockG: 250,
      bagG: 250,
      archived: false,
      createdAt: Date.now(),
    },
  );
  const [notes, setNotes] = useState(b.flavorNotes.join(', '));
  const [nameError, setNameError] = useState(false);
  const patch = (p: Partial<UserBean>) => setB((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!b.name.trim()) {
      setNameError(true);
      return;
    }
    await saveBean(db, {
      ...b,
      name: b.name.trim(),
      roaster: b.roaster?.trim() || undefined,
      origin: b.origin?.trim() || undefined,
      flavorNotes: notes
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
    });
    onDone();
  };

  return (
    <Card className="form-card">
      <TextField
        label={t('common.name')}
        value={b.name}
        error={nameError ? t('common.required') : undefined}
        onChange={(v) => {
          patch({ name: v });
          setNameError(false);
        }}
      />
      <div className="form-grid">
        <TextField label={t('beansPage.roaster')} value={b.roaster ?? ''} onChange={(v) => patch({ roaster: v })} />
        <TextField label={t('beansPage.origin')} value={b.origin ?? ''} onChange={(v) => patch({ origin: v })} />
      </div>
      <div className="form-grid">
        <TextField label={t('beansPage.roastDate')} type="date" value={b.roastDate ?? ''} onChange={(v) => patch({ roastDate: v || undefined })} />
        <Select
          label={t('fields.process')}
          value={b.process}
          options={PROCESSES.map((p) => ({ value: p, label: t(`processes.${p}`) }))}
          onChange={(process) => patch({ process })}
        />
      </div>
      <Slider label={t('fields.roast')} value={b.roast} min={0} max={1} step={0.05} display={t(roastKey(b.roast))} onChange={(roast) => patch({ roast })} />
      <Slider
        label={t('fields.robusta')}
        value={Math.round(b.robustaShare * 100)}
        min={0}
        max={100}
        step={5}
        unit="%"
        onChange={(v) => patch({ robustaShare: v / 100 })}
      />
      <Slider
        label={t('fields.altitude')}
        value={b.altitudeM ?? 1500}
        min={0}
        max={2500}
        step={50}
        unit="m"
        onChange={(altitudeM) => patch({ altitudeM })}
      />
      <TextField label={t('beansPage.flavorNotes')} value={notes} placeholder={t('beansPage.notesPlaceholder')} onChange={setNotes} />
      <div className="form-grid">
        <NumberField label={t('beansPage.bagG')} value={b.bagG} unit="g" min={0} onChange={(bagG) => patch({ bagG })} />
        <NumberField label={t('beansPage.stockG')} value={b.stockG} unit="g" min={0} onChange={(stockG) => patch({ stockG })} />
      </div>
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
