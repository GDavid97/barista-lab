import type { BaristaDb, UserBean, UserBrew, UserGrinder, UserMachine } from './schema';

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* ---------- Grinders ---------- */

/** Save a grinder; the first grinder, or one flagged default, becomes the only default. */
export async function saveGrinder(db: BaristaDb, g: UserGrinder): Promise<void> {
  await db.transaction('rw', db.grinders, async () => {
    const others = (await db.grinders.toArray()).filter((x) => x.id !== g.id);
    const makeDefault = g.isDefault || !others.some((x) => x.isDefault);
    if (makeDefault) {
      for (const o of others.filter((x) => x.isDefault)) await db.grinders.update(o.id, { isDefault: false });
    }
    await db.grinders.put({ ...g, isDefault: makeDefault });
  });
}

export async function deleteGrinder(db: BaristaDb, id: string): Promise<void> {
  await db.transaction('rw', db.grinders, async () => {
    const g = await db.grinders.get(id);
    await db.grinders.delete(id);
    if (g?.isDefault) {
      const next = (await db.grinders.orderBy('createdAt').toArray())[0];
      if (next) await db.grinders.update(next.id, { isDefault: true });
    }
  });
}

/* ---------- Machines (one default per kind) ---------- */

export async function saveMachine(db: BaristaDb, m: UserMachine): Promise<void> {
  await db.transaction('rw', db.machines, async () => {
    const sameKind = (await db.machines.where('kind').equals(m.kind).toArray()).filter((x) => x.id !== m.id);
    const makeDefault = m.isDefault || !sameKind.some((x) => x.isDefault);
    if (makeDefault) {
      for (const o of sameKind.filter((x) => x.isDefault)) await db.machines.update(o.id, { isDefault: false });
    }
    await db.machines.put({ ...m, isDefault: makeDefault });
  });
}

export async function deleteMachine(db: BaristaDb, id: string): Promise<void> {
  await db.transaction('rw', db.machines, async () => {
    const m = await db.machines.get(id);
    await db.machines.delete(id);
    if (m?.isDefault) {
      const next = (await db.machines.where('kind').equals(m.kind).sortBy('createdAt'))[0];
      if (next) await db.machines.update(next.id, { isDefault: true });
    }
  });
}

/* ---------- Beans ---------- */

export async function saveBean(db: BaristaDb, b: UserBean): Promise<void> {
  await db.beans.put({ ...b, stockG: Math.max(0, b.stockG) });
}

export async function deleteBean(db: BaristaDb, id: string): Promise<void> {
  await db.beans.delete(id);
}

export async function setBeanArchived(db: BaristaDb, id: string, archived: boolean): Promise<void> {
  await db.beans.update(id, { archived });
}

/** Change stock by deltaG (negative = used). Never goes below zero. Returns the new stock. */
export async function adjustStock(db: BaristaDb, id: string, deltaG: number): Promise<number | undefined> {
  return db.transaction('rw', db.beans, async () => {
    const b = await db.beans.get(id);
    if (!b) return undefined;
    const stockG = Math.max(0, Math.round((b.stockG + deltaG) * 10) / 10);
    await db.beans.update(id, { stockG });
    return stockG;
  });
}

/** Active beans first by roast date (newest first), archived last. */
export function sortBeans(beans: UserBean[]): UserBean[] {
  return [...beans].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return (b.roastDate ?? '').localeCompare(a.roastDate ?? '') || b.createdAt - a.createdAt;
  });
}

/* ---------- Brews (journal) ---------- */

export async function saveBrew(db: BaristaDb, b: UserBrew): Promise<void> {
  await db.brews.put(b);
}

export async function updateBrew(db: BaristaDb, id: string, patch: Partial<Omit<UserBrew, 'id'>>): Promise<void> {
  await db.brews.update(id, patch);
}

export async function deleteBrew(db: BaristaDb, id: string): Promise<void> {
  await db.brews.delete(id);
}

/** Newest first. */
export async function listBrews(db: BaristaDb): Promise<UserBrew[]> {
  return db.brews.orderBy('createdAt').reverse().toArray();
}
