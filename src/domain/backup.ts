import type { BaristaDb, UserBean, UserBrew, UserGrinder, UserMachine } from '../db/schema';

export const BACKUP_APP = 'barista-lab';
export const BACKUP_VERSION = 1;

/** localStorage keys worth carrying over (setup, settings, language, calibration resets). */
export const LOCAL_KEYS = [
  'baristaLab.simulator.v1',
  'baristaLab.settings.v1',
  'baristaLab.lang',
  'baristaLab.calibrationReset.v1',
] as const;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: {
    grinders: UserGrinder[];
    machines: UserMachine[];
    beans: UserBean[];
    brews: UserBrew[];
  };
  local: Record<string, string>;
}

export interface BackupCounts {
  grinders: number;
  machines: number;
  beans: number;
  brews: number;
}

export function countsOf(b: Backup): BackupCounts {
  return {
    grinders: b.data.grinders.length,
    machines: b.data.machines.length,
    beans: b.data.beans.length,
    brews: b.data.brews.length,
  };
}

export async function createBackup(db: BaristaDb, storage: Pick<Storage, 'getItem'> | undefined, now = new Date()): Promise<Backup> {
  const [grinders, machines, beans, brews] = await Promise.all([
    db.grinders.toArray(),
    db.machines.toArray(),
    db.beans.toArray(),
    db.brews.toArray(),
  ]);
  const local: Record<string, string> = {};
  for (const k of LOCAL_KEYS) {
    const v = storage?.getItem(k);
    if (v != null) local[k] = v;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: { grinders, machines, beans, brews }, local };
}

export class BackupError extends Error {
  constructor(public readonly code: 'notJson' | 'notBackup' | 'newerVersion' | 'malformed') {
    super(code);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasIds = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

/** Parse and validate a backup file. Throws BackupError with a reason code. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('notJson');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new BackupError('notBackup');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) throw new BackupError('newerVersion');
  const data = raw.data;
  if (!isObj(data)) throw new BackupError('malformed');
  for (const t of ['grinders', 'machines', 'beans', 'brews'] as const) {
    if (data[t] === undefined) data[t] = [];
    if (!hasIds(data[t])) throw new BackupError('malformed');
  }
  const local: Record<string, string> = {};
  if (isObj(raw.local)) {
    for (const k of LOCAL_KEYS) {
      const v = raw.local[k];
      if (typeof v === 'string') local[k] = v;
    }
  }
  return {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data: data as Backup['data'],
    local,
  };
}

export type ImportMode = 'merge' | 'replace';

/**
 * Restore a backup. 'merge' upserts by id (existing items with the same id are
 * overwritten, others kept); 'replace' clears everything first. Atomic.
 */
export async function restoreBackup(
  db: BaristaDb,
  b: Backup,
  mode: ImportMode,
  storage?: Pick<Storage, 'setItem'>,
): Promise<void> {
  await db.transaction('rw', [db.grinders, db.machines, db.beans, db.brews], async () => {
    if (mode === 'replace') {
      await Promise.all([db.grinders.clear(), db.machines.clear(), db.beans.clear(), db.brews.clear()]);
    }
    await db.grinders.bulkPut(b.data.grinders);
    await db.machines.bulkPut(b.data.machines);
    await db.beans.bulkPut(b.data.beans);
    await db.brews.bulkPut(b.data.brews);
    // Merging can bring in a second default grinder; keep exactly one.
    const defaults = (await db.grinders.toArray()).filter((g) => g.isDefault).sort((x, y) => x.createdAt - y.createdAt);
    for (const g of defaults.slice(1)) await db.grinders.update(g.id, { isDefault: false });
  });
  if (storage) for (const [k, v] of Object.entries(b.local)) storage.setItem(k, v);
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `barista-lab-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
