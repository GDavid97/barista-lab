import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { DRINKS } from '../data/drinks';
import { deleteBrew, listBrews } from '../db/repo';
import { db, type UserBrew } from '../db/schema';
import { filterBrews, groupByDay, measuredEy, type JournalFilter } from '../domain/journal';
import type { SensoryProfile } from '../engine';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { formatClock } from '../ui/brewEffects';
import { RadarChart } from '../ui/charts';
import { Card, Select } from '../ui/fields';
import { DialInPanel } from '../ui/DialIn';
import { Stars, TastingForm } from '../ui/TastingForm';
import { openWizardAt, WIZARD_RECIPE_STEP } from './Brew';
import { clearBrewSession } from './BrewRunner';
import { storeSetup } from './useBrewSetup';

const SB_KEY: Record<number, string> = { [-2]: 'm2', [-1]: 'm1', 0: 'z', 1: 'p1', 2: 'p2' };

function useDateFormats() {
  const { lang } = useI18n();
  return useMemo(() => {
    const locale = lang === 'hu' ? 'hu-HU' : 'en-GB';
    return {
      day: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
      full: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
  }, [lang]);
}

export function rebrew(b: UserBrew): void {
  storeSetup(b.setup);
  clearBrewSession();
  openWizardAt(WIZARD_RECIPE_STEP);
}

export function Journal({ path }: { path: string[] }) {
  const brews = useLiveQuery(() => listBrews(db), []);
  if (!brews) return null;
  if (path[0] === 'compare' && path[1] && path[2]) {
    return <Compare a={brews.find((b) => b.id === path[1])} b={brews.find((b) => b.id === path[2])} />;
  }
  if (path[0]) return <Detail brew={brews.find((b) => b.id === path[0])} />;
  return <JournalList brews={brews} />;
}

/* ---------------- List ---------------- */

function JournalList({ brews }: { brews: UserBrew[] }) {
  const { t, tDyn, fmt } = useI18n();
  const dates = useDateFormats();
  const [filter, setFilter] = useState<JournalFilter>({});
  const [picked, setPicked] = useState<string[]>([]);

  const drinkIds = new Set(brews.map((b) => b.drinkId));
  const beans = new Map<string, string>();
  for (const b of brews) if (b.beanId) beans.set(b.beanId, b.beanName ?? b.beanId);
  const visible = filterBrews(brews, filter);
  const groups = groupByDay(visible);

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1]!, id] : [...p, id]));

  if (brews.length === 0) {
    return (
      <div className="page">
        <h2 className="page__title">{t('nav.journal')}</h2>
        <p className="empty">{t('journal.empty')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__head">
        <h2>{t('nav.journal')}</h2>
        <span className="muted">{t('journal.count', { n: visible.length })}</span>
      </div>
      <div className="form-grid">
        <Select
          label={t('journal.filterDrink')}
          value={filter.drinkId ?? ''}
          options={[
            { value: '', label: t('journal.all') },
            ...DRINKS.filter((d) => drinkIds.has(d.id)).map((d) => ({ value: d.id, label: tDyn(`drinks.${d.id}`) })),
          ]}
          onChange={(v) => setFilter((f) => ({ ...f, drinkId: v || undefined }))}
        />
        <Select
          label={t('journal.filterBean')}
          value={filter.beanId ?? ''}
          options={[{ value: '', label: t('journal.all') }, ...[...beans].map(([id, name]) => ({ value: id, label: name }))]}
          onChange={(v) => setFilter((f) => ({ ...f, beanId: v || undefined }))}
        />
      </div>

      <div className="compare-bar">
        <span className="muted">{t('journal.comparePick', { n: picked.length })}</span>
        {picked.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setPicked([])}>
            {t('journal.clear')}
          </button>
        )}
        <a
          className={`btn btn--primary${picked.length === 2 ? '' : ' is-disabled'}`}
          aria-disabled={picked.length !== 2}
          href={picked.length === 2 ? `#/journal/compare/${picked[0]}/${picked[1]}` : undefined}
        >
          {t('journal.compare')}
        </a>
      </div>

      {groups.map((g) => (
        <section key={g.day} className="page__section">
          <h3 className="day-head">{dates.day.format(g.brews[0]!.createdAt)}</h3>
          <div className="list">
            {g.brews.map((b) => {
              const ey = measuredEy(b);
              const isPicked = picked.includes(b.id);
              return (
                <div key={b.id} className={`journal-item${isPicked ? ' is-picked' : ''}`}>
                  <a className="journal-item__main" href={`#/journal/${b.id}`}>
                    <div className="row-card__title">
                      {tDyn(`drinks.${b.drinkId}`)}
                      <span className="muted journal-item__time">{dates.time.format(b.createdAt)}</span>
                    </div>
                    <div className="row-card__meta">
                      {b.beanName ?? t('journal.manualBean')} · {b.setup.brew.doseG} g → {fmt(b.setup.brew.waterG)} g · {b.grindLabel}
                    </div>
                    <div className="journal-item__stats">
                      {b.rating && b.rating.stars > 0 ? <Stars value={b.rating.stars} size="sm" /> : <span className="muted">{t('journal.notRated')}</span>}
                      <span>
                        EY {fmt(ey ?? b.predicted.ey, 1)}%{ey !== undefined ? '' : '*'}
                      </span>
                      {b.rating && b.rating.sourBitter !== 0 && (
                        <span className="badge badge--warn">{tDyn(`journal.sb.${SB_KEY[b.rating.sourBitter]}`)}</span>
                      )}
                    </div>
                  </a>
                  <label className="journal-item__pick">
                    <input type="checkbox" checked={isPicked} onChange={() => togglePick(b.id)} />
                    <span>{t('journal.compareAdd')}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="help">* {t('journal.predicted')}</p>
    </div>
  );
}

/* ---------------- Detail ---------------- */

function sensoryLabels(t: (k: `sensory.${keyof SensoryProfile}`) => string) {
  const keys: (keyof SensoryProfile)[] = ['acidity', 'sweetness', 'bitterness', 'astringency', 'aftertaste', 'body', 'aroma'];
  return Object.fromEntries(keys.map((k) => [k, t(`sensory.${k}`)])) as Record<keyof SensoryProfile, string>;
}

function Detail({ brew }: { brew?: UserBrew }) {
  const { t, tDyn, fmt } = useI18n();
  const { fmtTemp } = useSettings();
  const dates = useDateFormats();
  if (!brew) {
    return (
      <div className="page">
        <a className="link-btn" href="#/journal">{t('journal.back')}</a>
        <p className="empty">{t('journal.notFound')}</p>
      </div>
    );
  }
  const p = brew.predicted;
  const m = brew.measured;
  const mEy = measuredEy(brew);
  const espresso = brew.method === 'espresso';
  const tdsDigits = espresso ? 1 : 2;
  const s = brew.setup;

  const rows: [string, string, string | undefined][] = [
    [t('results.time'), `${fmt(p.timeS)} ${t('units.seconds')}`, m.timeS !== undefined ? `${fmt(m.timeS)} ${t('units.seconds')}` : undefined],
    [t('results.ey'), `${fmt(p.ey, 1)} %`, mEy !== undefined ? `${fmt(mEy, 1)} %` : undefined],
    [t('results.tds'), `${fmt(p.tds, tdsDigits)} %`, m.tds !== undefined ? `${fmt(m.tds, tdsDigits)} %` : undefined],
    [t('results.beverage'), `${fmt(p.beverageG)} g`, m.beverageG !== undefined ? `${fmt(m.beverageG, 1)} g` : undefined],
  ];
  if (brew.method === 'moka' || brew.method === 'coldbrew') rows.shift();

  return (
    <div className="page">
      <a className="link-btn" href="#/journal">{t('journal.back')}</a>
      <div className="page__head">
        <h2>
          {tDyn(`drinks.${brew.drinkId}`)} <span className="muted">· {dates.full.format(brew.createdAt)}</span>
        </h2>
        <div className="row-card__actions">
          <button type="button" className="btn btn--primary" onClick={() => rebrew(brew)}>
            ↻ {t('journal.rebrew')}
          </button>
          <button
            type="button"
            className="btn link-btn--danger"
            onClick={() => {
              if (confirm(t('common.confirmDelete', { name: tDyn(`drinks.${brew.drinkId}`) }))) {
                void deleteBrew(db, brew.id).then(() => (window.location.hash = '#/journal'));
              }
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>

      <Card title={t('journal.tasting')}>
        <TastingForm key={brew.id} brew={brew} />
      </Card>

      <Card title={t('dialIn.title')}>
        <DialInPanel
          brew={brew}
          applyLabel={t('dialIn.applyAndBrew')}
          onApply={(next) => {
            storeSetup(next);
            clearBrewSession();
            openWizardAt(WIZARD_RECIPE_STEP);
          }}
        />
      </Card>

      <Card title={`${t('journal.predicted')} ↔ ${t('journal.measured')}`}>
        <table className="kv-table">
          <thead>
            <tr>
              <th />
              <th>{t('journal.predicted')}</th>
              <th>{t('journal.measured')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{a}</td>
                <td>{b ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {brew.brewTimeS !== undefined && (
          <p className="help">
            {t('journal.brewTime')}: {formatClock(brew.brewTimeS)}
          </p>
        )}
      </Card>

      <Card title={t('journal.recipe')}>
        <table className="kv-table">
          <tbody>
            <tr>
              <th scope="row">{t('journal.bean')}</th>
              <td>{brew.beanName ?? t('journal.manualBean')}</td>
            </tr>
            <tr>
              <th scope="row">{t('journal.grinder')}</th>
              <td>
                {brew.grinderName ?? '—'} · {brew.grindLabel}
              </td>
            </tr>
            <tr>
              <th scope="row">{t('fields.dose')}</th>
              <td>{fmt(s.brew.doseG, 1)} g</td>
            </tr>
            <tr>
              <th scope="row">{espresso ? t('fields.yield') : t('fields.water')}</th>
              <td>
                {fmt(s.brew.waterG)} g · {t('journal.ratio')} 1 : {fmt(s.brew.waterG / s.brew.doseG, 1)}
              </td>
            </tr>
            {brew.method !== 'moka' && (
              <tr>
                <th scope="row">{t('fields.temp')}</th>
                <td>{fmtTemp(s.brew.tempC, 1)}</td>
              </tr>
            )}
            {(s.additions.milkMl ?? 0) > 0 && (
              <tr>
                <th scope="row">{t('fields.milk')}</th>
                <td>
                  {fmt(s.additions.milkMl!)} ml · {t(`milks.${s.additions.milkType ?? 'whole'}`)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title={t('journal.prediction')}>
        <RadarChart profile={p.sensory} labels={sensoryLabels(t)} />
        <div className="badges">
          <span className={`badge badge--${p.extraction}`}>{t(`results.extraction.${p.extraction}`)}</span>
          <span className="badge badge--neutral">{t(`results.balanceLabels.${p.balance}`)}</span>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Compare ---------------- */

function Compare({ a, b }: { a?: UserBrew; b?: UserBrew }) {
  const { t, tDyn, fmt } = useI18n();
  const { fmtTemp } = useSettings();
  const dates = useDateFormats();
  if (!a || !b) {
    return (
      <div className="page">
        <a className="link-btn" href="#/journal">{t('journal.back')}</a>
        <p className="empty">{t('journal.notFound')}</p>
      </div>
    );
  }
  const cell = (x: UserBrew, f: (x: UserBrew) => string) => f(x);
  const tdsD = (x: UserBrew) => (x.method === 'espresso' ? 1 : 2);
  const rows: [string, (x: UserBrew) => string][] = [
    [t('journal.bean'), (x) => x.beanName ?? t('journal.manualBean')],
    [t('journal.grind'), (x) => x.grindLabel],
    [t('fields.dose'), (x) => `${fmt(x.setup.brew.doseG, 1)} g`],
    [t('journal.ratio'), (x) => `1 : ${fmt(x.setup.brew.waterG / x.setup.brew.doseG, 1)}`],
    [t('fields.temp'), (x) => fmtTemp(x.setup.brew.tempC, 1)],
    [t('results.time'), (x) => `${fmt(x.measured.timeS ?? x.predicted.timeS)} ${t('units.seconds')}${x.measured.timeS === undefined ? '*' : ''}`],
    [t('results.ey'), (x) => { const e = measuredEy(x); return `${fmt(e ?? x.predicted.ey, 1)} %${e === undefined ? '*' : ''}`; }],
    [t('results.tds'), (x) => `${fmt(x.measured.tds ?? x.predicted.tds, tdsD(x))} %${x.measured.tds === undefined ? '*' : ''}`],
    [t('journal.rating'), (x) => (x.rating?.stars ? '★'.repeat(x.rating.stars) : '—')],
    [t('journal.sourBitter'), (x) => (x.rating ? tDyn(`journal.sb.${SB_KEY[x.rating.sourBitter]}`) : '—')],
    [t('journal.weakStrong'), (x) => (x.rating ? tDyn(`journal.ws.${SB_KEY[x.rating.weakStrong]}`) : '—')],
  ];

  return (
    <div className="page">
      <a className="link-btn" href="#/journal">{t('journal.back')}</a>
      <h2 className="page__title">{t('journal.compare')}</h2>
      <Card>
        <div className="legend">
          <span className="legend__item legend__item--a">
            {t('journal.legendA')}: {tDyn(`drinks.${a.drinkId}`)} · {dates.full.format(a.createdAt)}
          </span>
          <span className="legend__item legend__item--b">
            {t('journal.legendB')}: {tDyn(`drinks.${b.drinkId}`)} · {dates.full.format(b.createdAt)}
          </span>
        </div>
        <RadarChart profile={a.predicted.sensory} compare={b.predicted.sensory} labels={sensoryLabels(t)} />
      </Card>
      <Card>
        <table className="kv-table">
          <thead>
            <tr>
              <th />
              <th>{t('journal.legendA')}</th>
              <th>{t('journal.legendB')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => {
              const va = cell(a, f);
              const vb = cell(b, f);
              return (
                <tr key={label} className={va !== vb ? 'is-diff' : ''}>
                  <th scope="row">{label}</th>
                  <td>{va}</td>
                  <td>{vb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="help">* {t('journal.predicted')}</p>
      </Card>
      <div className="runner__controls">
        <button type="button" className="btn" onClick={() => rebrew(a)}>
          ↻ {t('journal.rebrew')} ({t('journal.legendA')})
        </button>
        <button type="button" className="btn" onClick={() => rebrew(b)}>
          ↻ {t('journal.rebrew')} ({t('journal.legendB')})
        </button>
      </div>
    </div>
  );
}
