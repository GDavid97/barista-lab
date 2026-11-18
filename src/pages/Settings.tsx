import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/schema';
import {
  BackupError,
  backupFileName,
  countsOf,
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupCounts,
  type ImportMode,
} from '../domain/backup';
import { useI18n, type Lang } from '../i18n';
import { isStandalone, useInstallPrompt, useOnline } from '../pwa';
import { useSettings, type TempUnit, type Theme } from '../settings';
import { Card, Segmented } from '../ui/fields';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { settings, update } = useSettings();
  const { canInstall, install } = useInstallPrompt();
  const online = useOnline();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [status, setStatus] = useState<Status>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useLiveQuery(async () => {
    const [grinders, machines, beans, brews] = await Promise.all([
      db.grinders.count(),
      db.machines.count(),
      db.beans.count(),
      db.brews.count(),
    ]);
    return { grinders, machines, beans, brews } satisfies BackupCounts;
  }, []);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const summary = (c: BackupCounts) => t('settings.dataSummary', { ...c });

  const doExport = async () => {
    const backup = await createBackup(db, localStorage);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const file = backupFileName();
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ kind: 'ok', text: t('settings.exported', { file }) });
  };

  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      const s = summary(countsOf(backup));
      if (!confirm(t('settings.confirmImport', { summary: s }))) return;
      if (mode === 'replace' && !confirm(t('settings.confirmReplace'))) return;
      await restoreBackup(db, backup, mode, localStorage);
      setStatus({ kind: 'ok', text: t('settings.imported', { summary: s }) });
      // Settings, language and the current recipe live in localStorage: reload to apply them.
      if (Object.keys(backup.local).length > 0) setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'malformed';
      setStatus({ kind: 'error', text: t(`settings.errors.${code}`) });
    }
  };

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="page">
      <h2 className="page__title">{t('settings.title')}</h2>

      <Card title={t('settings.appearance')}>
        <Segmented<Lang>
          label={t('settings.language')}
          value={lang}
          options={[
            { value: 'hu', label: 'Magyar' },
            { value: 'en', label: 'English' },
          ]}
          onChange={setLang}
        />
        <Segmented<Theme>
          label={t('settings.theme')}
          value={settings.theme}
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          onChange={(theme) => update({ theme })}
        />
        <Segmented
          label={t('settings.defaultView')}
          value={settings.advanced ? 'adv' : 'simple'}
          options={[
            { value: 'simple', label: t('app.simple') },
            { value: 'adv', label: t('app.advanced') },
          ]}
          onChange={(v) => update({ advanced: v === 'adv' })}
        />
        <p className="help">{t('settings.defaultViewHint')}</p>
      </Card>

      <Card title={t('settings.units')}>
        <Segmented<TempUnit>
          label={t('settings.temp')}
          value={settings.tempUnit}
          options={[
            { value: 'C', label: '°C' },
            { value: 'F', label: '°F' },
          ]}
          onChange={(tempUnit) => update({ tempUnit })}
        />
        <p className="help">{t('settings.unitsHint')}</p>
      </Card>

      <Card title={t('settings.data')}>
        {counts && <p className="help">{summary(counts)}</p>}
        <div className="form-actions form-actions--start">
          <button type="button" className="btn btn--primary" onClick={() => void doExport()}>
            ⤓ {t('settings.export')}
          </button>
        </div>
        <Segmented<ImportMode>
          label={t('settings.importMode')}
          value={mode}
          options={[
            { value: 'merge', label: t('settings.merge') },
            { value: 'replace', label: t('settings.replace') },
          ]}
          onChange={setMode}
        />
        <p className="help">{mode === 'merge' ? t('settings.mergeHint') : t('settings.replaceHint')}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
        <div className="form-actions form-actions--start">
          <button type="button" className={`btn${mode === 'replace' ? ' link-btn--danger' : ''}`} onClick={() => fileRef.current?.click()}>
            ⤒ {t('settings.import')}
          </button>
        </div>
        {status && (
          <p className={status.kind === 'ok' ? 'good' : 'field__error'} role="status">
            {status.kind === 'ok' ? '✓ ' : ''}
            {status.text}
          </p>
        )}
        {persisted === false && <p className="help">{t('settings.storageNotPersisted')}</p>}
        {persisted === true && <p className="help">{t('settings.storagePersisted')}</p>}
      </Card>

      <Card title={t('settings.app')}>
        <p>
          <span className={`badge ${online ? 'badge--ideal' : 'badge--warn'}`}>{online ? t('settings.online') : t('settings.offline')}</span>
        </p>
        {isStandalone() ? (
          <p className="help">{t('settings.installed')}</p>
        ) : canInstall ? (
          <button type="button" className="btn btn--primary" onClick={() => void install()}>
            ⊕ {t('settings.install')}
          </button>
        ) : (
          <p className="help">{ios ? t('settings.installHintIos') : t('settings.installUnavailable')}</p>
        )}
        <p className="help">
          {t('settings.version')}: {__APP_VERSION__}
        </p>
      </Card>
    </div>
  );
}
