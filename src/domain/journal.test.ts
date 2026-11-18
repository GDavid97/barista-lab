import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drinkById } from '../data/drinks';
import { deleteBrew, listBrews, saveBrew, updateBrew } from '../db/repo';
import { BaristaDb } from '../db/schema';
import { simulate } from '../engine';
import { stateForDrink, type SimState } from '../pages/useBrewSetup';
import { filterBrews, groupByDay, makeBrewRecord, measuredEy } from './journal';

const setupFor = (id: string, beanId?: string): SimState => ({ ...stateForDrink(drinkById(id)!), beanId });
const resultFor = (s: SimState) =>
  simulate({ bean: s.bean, grind: { particleUm: s.particleUm, burr: 'conical' }, brew: s.brew, additions: s.additions });

type Extra = Partial<Omit<Parameters<typeof makeBrewRecord>[0], 'setup'>> & { beanId?: string };
const record = (id: string, drink: string, now: number, { beanId, ...extra }: Extra = {}) => {
  const setup = setupFor(drink, beanId);
  return makeBrewRecord({ id, now, setup, result: resultFor(setup), grindLabel: '10', ...extra });
};

describe('makeBrewRecord', () => {
  it('snapshots the setup and prediction', () => {
    const r = record('a', 'espresso', 1000);
    expect(r.drinkId).toBe('espresso');
    expect(r.method).toBe('espresso');
    expect(r.predicted.ey).toBeGreaterThan(18);
    expect(r.setup.brew.doseG).toBe(18);
  });

  it('trusts the timer only when the brew was actually followed', () => {
    expect(record('a', 'espresso', 1, { brewTimeS: 29, plannedS: 28 }).measured.timeS).toBe(29);
    expect(record('b', 'espresso', 1, { brewTimeS: 3, plannedS: 28 }).measured.timeS).toBeUndefined();
    expect(record('c', 'moka', 1, { brewTimeS: 200 }).measured.timeS).toBeUndefined();
  });
});

describe('measuredEy', () => {
  it('derives EY from TDS and beverage mass', () => {
    const r = record('a', 'espresso', 1);
    expect(measuredEy(r)).toBeUndefined();
    r.measured.tds = 10;
    r.measured.beverageG = 36;
    expect(measuredEy(r)).toBeCloseTo(20); // 10% × 36 g / 18 g
  });
});

describe('filter & group', () => {
  it('filters by drink and bean, newest first, grouped by day', () => {
    const day1 = new Date(2026, 10, 15, 9).getTime();
    const day2 = new Date(2026, 10, 16, 9).getTime();
    const brews = [
      record('a', 'espresso', day1, { beanId: 'x' }),
      record('b', 'v60', day2),
      record('c', 'espresso', day2 + 1000, { beanId: 'y' }),
    ];
    expect(filterBrews(brews, {}).map((b) => b.id)).toEqual(['c', 'b', 'a']);
    expect(filterBrews(brews, { drinkId: 'espresso' }).map((b) => b.id)).toEqual(['c', 'a']);
    expect(filterBrews(brews, { beanId: 'x' }).map((b) => b.id)).toEqual(['a']);
    const groups = groupByDay(filterBrews(brews, {}));
    expect(groups.map((g) => g.brews.length)).toEqual([2, 1]);
  });
});

describe('brew repo', () => {
  let db: BaristaDb;
  let n = 0;
  beforeEach(() => {
    db = new BaristaDb(`journal-${++n}`);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('saves, rates, lists newest first and deletes', async () => {
    await saveBrew(db, record('old', 'espresso', 1));
    await saveBrew(db, record('new', 'v60', 2));
    await updateBrew(db, 'old', { rating: { stars: 4, sourBitter: -1, weakStrong: 0, notes: 'kicsit savanyú' } });
    const list = await listBrews(db);
    expect(list.map((b) => b.id)).toEqual(['new', 'old']);
    expect(list[1]!.rating?.stars).toBe(4);
    await deleteBrew(db, 'new');
    expect((await listBrews(db)).length).toBe(1);
  });
});
