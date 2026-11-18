import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { daysSince, freshnessStatus } from '../domain/freshness';
import {
  adjustStock,
  deleteGrinder,
  deleteMachine,
  saveBean,
  saveGrinder,
  saveMachine,
  sortBeans,
} from './repo';
import { BaristaDb, type UserBean, type UserGrinder, type UserMachine } from './schema';

let db: BaristaDb;
let n = 0;
beforeEach(() => {
  db = new BaristaDb(`test-${++n}`);
});
afterEach(async () => {
  await db.delete();
});

const grinder = (id: string, createdAt: number, isDefault = false): UserGrinder => ({
  id,
  name: id,
  burr: 'conical',
  kind: 'manual',
  scale: { zeroUm: 0, umPerStep: 30, min: 0, max: 40, step: 1 },
  scaleSource: 'preset',
  isDefault,
  createdAt,
});

const machine = (id: string, kind: UserMachine['kind'], createdAt: number, isDefault = false): UserMachine => ({
  id,
  name: id,
  kind,
  isDefault,
  createdAt,
});

const bean = (patch: Partial<UserBean>): UserBean => ({
  id: 'b',
  name: 'Bean',
  process: 'washed',
  roast: 0.4,
  robustaShare: 0,
  flavorNotes: [],
  stockG: 250,
  bagG: 250,
  archived: false,
  createdAt: 1,
  ...patch,
});

describe('grinders', () => {
  it('first grinder becomes default, a new default replaces the old one', async () => {
    await saveGrinder(db, grinder('a', 1));
    expect((await db.grinders.get('a'))!.isDefault).toBe(true);
    await saveGrinder(db, grinder('b', 2));
    expect((await db.grinders.get('b'))!.isDefault).toBe(false);
    await saveGrinder(db, grinder('b', 2, true));
    expect((await db.grinders.get('a'))!.isDefault).toBe(false);
    expect((await db.grinders.get('b'))!.isDefault).toBe(true);
  });

  it('deleting the default promotes the oldest remaining grinder', async () => {
    await saveGrinder(db, grinder('a', 1));
    await saveGrinder(db, grinder('b', 2));
    await saveGrinder(db, grinder('c', 3));
    await deleteGrinder(db, 'a');
    expect((await db.grinders.get('b'))!.isDefault).toBe(true);
  });
});

describe('machines', () => {
  it('keeps one default per kind', async () => {
    await saveMachine(db, machine('e1', 'espresso', 1));
    await saveMachine(db, machine('v1', 'pourover', 2));
    await saveMachine(db, machine('e2', 'espresso', 3, true));
    expect((await db.machines.get('e1'))!.isDefault).toBe(false);
    expect((await db.machines.get('e2'))!.isDefault).toBe(true);
    expect((await db.machines.get('v1'))!.isDefault).toBe(true);
    await deleteMachine(db, 'e2');
    expect((await db.machines.get('e1'))!.isDefault).toBe(true);
  });
});

describe('beans', () => {
  it('stock never goes negative', async () => {
    await saveBean(db, bean({ stockG: 20 }));
    expect(await adjustStock(db, 'b', -18)).toBe(2);
    expect(await adjustStock(db, 'b', -18)).toBe(0);
    expect(await adjustStock(db, 'b', 250)).toBe(250);
    expect(await adjustStock(db, 'missing', -1)).toBeUndefined();
  });

  it('sorts active beans newest roast first, archived last', () => {
    const sorted = sortBeans([
      bean({ id: 'old', roastDate: '2026-10-01' }),
      bean({ id: 'arch', roastDate: '2026-11-10', archived: true }),
      bean({ id: 'new', roastDate: '2026-11-05' }),
    ]);
    expect(sorted.map((b) => b.id)).toEqual(['new', 'old', 'arch']);
  });
});

describe('freshness', () => {
  const now = new Date(2026, 10, 16);
  it('counts days off roast', () => {
    expect(daysSince('2026-11-02', now)).toBe(14);
    expect(daysSince(undefined, now)).toBeUndefined();
    expect(daysSince('2026-12-01', now)).toBe(0);
  });

  it('classifies freshness by use', () => {
    expect(freshnessStatus(5, 'filter')).toBe('peak');
    expect(freshnessStatus(5, 'espresso')).toBe('resting');
    expect(freshnessStatus(40)).toBe('fading');
    expect(freshnessStatus(60)).toBe('stale');
    expect(freshnessStatus(undefined)).toBe('unknown');
  });
});
