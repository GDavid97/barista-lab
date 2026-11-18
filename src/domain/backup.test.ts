import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drinkById } from '../data/drinks';
import { saveBean, saveBrew, saveGrinder, saveMachine } from '../db/repo';
import { BaristaDb, type UserBean, type UserGrinder } from '../db/schema';
import { simulate } from '../engine';
import { stateForDrink } from '../pages/useBrewSetup';
import { BackupError, countsOf, createBackup, parseBackup, restoreBackup } from './backup';
import { buildInput } from './calibration';
import { makeBrewRecord } from './journal';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const grinder = (id: string, isDefault: boolean, createdAt: number): UserGrinder => ({
  id,
  name: id,
  burr: 'conical',
  kind: 'manual',
  scale: { zeroUm: 0, umPerStep: 30, min: 0, max: 40, step: 1 },
  scaleSource: 'twoPoint',
  calibration: { espressoSetting: 9, pouroverSetting: 21 },
  isDefault,
  createdAt,
});
const bean = (id: string, stockG: number): UserBean => ({
  id,
  name: id,
  process: 'natural',
  roast: 0.3,
  robustaShare: 0,
  roastDate: '2026-11-01',
  flavorNotes: ['áfonya'],
  stockG,
  bagG: 250,
  archived: false,
  createdAt: 1,
});

let src: BaristaDb;
let dst: BaristaDb;
let n = 0;
beforeEach(async () => {
  src = new BaristaDb(`bk-src-${++n}`);
  dst = new BaristaDb(`bk-dst-${n}`);
  await saveGrinder(src, grinder('g1', true, 1));
  await saveMachine(src, { id: 'm1', name: 'Gaggia', kind: 'espresso', pressureBar: 9, isDefault: true, createdAt: 1 });
  await saveBean(src, bean('b1', 180));
  const setup = { ...stateForDrink(drinkById('v60')!), beanId: 'b1' };
  const rec = makeBrewRecord({ id: 'r1', now: 5, setup, result: simulate(buildInput(setup, 'conical')), grindLabel: '22' });
  await saveBrew(src, { ...rec, rating: { stars: 4, sourBitter: -1, weakStrong: 0, notes: 'ízes' }, measured: { tds: 1.3 } });
});
afterEach(async () => {
  await src.delete();
  await dst.delete();
});

describe('backup', () => {
  it('export → JSON → import restores everything (incl. local settings)', async () => {
    const storage = new MemStorage();
    storage.setItem('baristaLab.settings.v1', '{"tempUnit":"F"}');
    storage.setItem('unrelated.key', 'x');
    const json = JSON.stringify(await createBackup(src, storage));

    const parsed = parseBackup(json);
    expect(countsOf(parsed)).toEqual({ grinders: 1, machines: 1, beans: 1, brews: 1 });
    expect(Object.keys(parsed.local)).toEqual(['baristaLab.settings.v1']);

    const target = new MemStorage();
    await restoreBackup(dst, parsed, 'replace', target);
    expect(await dst.grinders.get('g1')).toEqual(await src.grinders.get('g1'));
    expect(await dst.beans.get('b1')).toEqual(await src.beans.get('b1'));
    expect(await dst.brews.get('r1')).toEqual(await src.brews.get('r1'));
    expect(await dst.machines.get('m1')).toEqual(await src.machines.get('m1'));
    expect(target.getItem('baristaLab.settings.v1')).toBe('{"tempUnit":"F"}');
  });

  it('merge keeps existing items and a single default grinder; replace clears', async () => {
    await saveGrinder(dst, grinder('mine', true, 0));
    await saveBean(dst, bean('b1', 20)); // same id → overwritten by backup
    const b = parseBackup(JSON.stringify(await createBackup(src, undefined)));

    await restoreBackup(dst, b, 'merge');
    expect((await dst.grinders.toArray()).map((g) => g.id).sort()).toEqual(['g1', 'mine']);
    expect((await dst.grinders.toArray()).filter((g) => g.isDefault).map((g) => g.id)).toEqual(['mine']);
    expect((await dst.beans.get('b1'))!.stockG).toBe(180);

    await restoreBackup(dst, b, 'replace');
    expect((await dst.grinders.toArray()).map((g) => g.id)).toEqual(['g1']);
  });

  it('rejects garbage with a reason', () => {
    const code = (text: string) => {
      try {
        parseBackup(text);
        return 'ok';
      } catch (e) {
        return e instanceof BackupError ? e.code : 'other';
      }
    };
    expect(code('nem json')).toBe('notJson');
    expect(code('{"app":"valami-más"}')).toBe('notBackup');
    expect(code('{"app":"barista-lab","version":99,"data":{}}')).toBe('newerVersion');
    expect(code('{"app":"barista-lab","version":1,"data":{"beans":[{"nincs":"id"}]}}')).toBe('malformed');
    expect(code('{"app":"barista-lab","version":1,"data":{}}')).toBe('ok');
  });
});
