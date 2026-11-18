import { useState } from 'react';
import { updateBrew } from '../db/repo';
import { db, type BrewRating, type UserBrew } from '../db/schema';
import { measuredEy } from '../domain/journal';
import { useI18n } from '../i18n';
import { OptionalNumberField, Segmented } from './fields';

const SCALE = ['-2', '-1', '0', '1', '2'] as const;
const SCALE_KEY = { '-2': 'm2', '-1': 'm1', '0': 'z', '1': 'p1', '2': 'p2' } as const;

export function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  return (
    <span className={`stars stars--${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`${t('journal.stars')}: ${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            className={n <= value ? 'is-on' : ''}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= value ? 'is-on' : ''} aria-hidden>
            ★
          </span>
        ),
      )}
    </span>
  );
}

export function TastingForm({ brew, onSaved }: { brew: UserBrew; onSaved?: () => void }) {
  const { t, fmt } = useI18n();
  const [rating, setRating] = useState<BrewRating>(brew.rating ?? { stars: 0, sourBitter: 0, weakStrong: 0, notes: '' });
  const [measured, setMeasured] = useState(brew.measured);
  const [saved, setSaved] = useState(false);
  const isEspresso = brew.method === 'espresso';
  const patchRating = (p: Partial<BrewRating>) => {
    setRating((r) => ({ ...r, ...p }));
    setSaved(false);
  };
  const patchMeasured = (p: Partial<UserBrew['measured']>) => {
    setMeasured((m) => ({ ...m, ...p }));
    setSaved(false);
  };
  const ey = measuredEy({ ...brew, measured });
  const showTime = brew.method !== 'moka' && brew.method !== 'coldbrew';

  const save = async () => {
    await updateBrew(db, brew.id, { rating, measured });
    setSaved(true);
    onSaved?.();
  };

  return (
    <div className="tasting">
      <div className="field">
        <div className="field__head">
          <span>{t('journal.rating')}</span>
        </div>
        <Stars value={rating.stars} onChange={(stars) => patchRating({ stars })} />
      </div>
      <Segmented
        label={t('journal.sourBitter')}
        value={String(rating.sourBitter) as (typeof SCALE)[number]}
        options={SCALE.map((v) => ({ value: v, label: t(`journal.sb.${SCALE_KEY[v]}`) }))}
        onChange={(v) => patchRating({ sourBitter: Number(v) })}
      />
      <Segmented
        label={t('journal.weakStrong')}
        value={String(rating.weakStrong) as (typeof SCALE)[number]}
        options={SCALE.map((v) => ({ value: v, label: t(`journal.ws.${SCALE_KEY[v]}`) }))}
        onChange={(v) => patchRating({ weakStrong: Number(v) })}
      />
      <div className="field">
        <div className="field__head">
          <label htmlFor={`notes-${brew.id}`}>{t('journal.notes')}</label>
        </div>
        <textarea
          id={`notes-${brew.id}`}
          className="text-input"
          rows={3}
          value={rating.notes}
          placeholder={t('journal.notesPlaceholder')}
          onChange={(e) => patchRating({ notes: e.target.value })}
        />
      </div>
      <div className="form-grid form-grid--3">
        {showTime && (
          <OptionalNumberField
            label={t('journal.measuredTime')}
            unit={t('units.seconds')}
            value={measured.timeS}
            onChange={(timeS) => patchMeasured({ timeS })}
          />
        )}
        <OptionalNumberField
          label={t('journal.measuredBeverage')}
          unit="g"
          step={0.1}
          value={measured.beverageG}
          onChange={(beverageG) => patchMeasured({ beverageG })}
        />
        <OptionalNumberField
          label={t('journal.measuredTds')}
          unit="%"
          step={isEspresso ? 0.1 : 0.01}
          value={measured.tds}
          onChange={(tds) => patchMeasured({ tds })}
        />
      </div>
      {ey !== undefined && (
        <p className="help">
          {t('journal.measuredEy')}: <strong>{fmt(ey, 1)} %</strong> · {t('journal.predicted')} {fmt(brew.predicted.ey, 1)} %
        </p>
      )}
      <div className="form-actions">
        {saved && <span className="good">✓ {t('journal.saved')}</span>}
        <button type="button" className="btn btn--primary" onClick={() => void save()}>
          {t('journal.save')}
        </button>
      </div>
    </div>
  );
}
