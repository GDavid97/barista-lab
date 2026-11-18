import { describe, expect, it } from 'vitest';
import { DRINKS } from '../data/drinks';
import { grinderById, GRINDERS } from '../data/grinders';
import { fitFor, formatRange, GRIND_RANGES, guideForDrink, settingRange, textureOf } from './grindGuide';

describe('grinder presets', () => {
  it('every preset has a sane, increasing scale and unique id', () => {
    expect(new Set(GRINDERS.map((g) => g.id)).size).toBe(GRINDERS.length);
    for (const g of GRINDERS) {
      expect(g.scale.umPerStep, g.id).toBeGreaterThan(0);
      expect(g.scale.max, g.id).toBeGreaterThan(g.scale.min);
    }
  });

  it('every preset can do filter and espresso unless marked otherwise', () => {
    for (const g of GRINDERS) {
      if (g.noFilter) expect(settingRange(g.scale, 'pourover'), `${g.id} pourover`).toBeUndefined();
      else expect(settingRange(g.scale, 'pourover'), `${g.id} pourover`).toBeDefined();
      const esp = settingRange(g.scale, 'espresso');
      if (g.noEspresso) {
        // Espresso fineness lies below the dial's finest end.
        expect(g.scale.zeroUm + g.scale.umPerStep * g.scale.min, g.id).toBeGreaterThan(GRIND_RANGES.espresso[0]);
      } else {
        expect(esp, `${g.id} espresso`).toBeDefined();
        expect(esp![0], g.id).toBeGreaterThanOrEqual(g.scale.min);
      }
    }
  });

  it('DF64 and DF54 put espresso in the usual low-teens to twenties and filter much coarser', () => {
    for (const id of ['df64', 'df54']) {
      const g = grinderById(id)!;
      const [lo, hi] = settingRange(g.scale, 'espresso')!;
      expect(lo, id).toBeGreaterThanOrEqual(5);
      expect(hi, id).toBeLessThanOrEqual(30);
      expect(settingRange(g.scale, 'pourover')![0], id).toBeGreaterThan(hi + 15);
      expect(g.burr).toBe('flat');
    }
  });

  it('keeps the Comandante mapping the rest of the app was calibrated with', () => {
    expect(grinderById('comandante-c40')!.scale.umPerStep).toBe(30);
  });
});

describe('grind guide', () => {
  it('describes size with everyday textures, finest to coarsest', () => {
    expect([120, 300, 450, 650, 850, 1100].map(textureOf)).toEqual([
      'flour',
      'powderedSugar',
      'fineSalt',
      'sugar',
      'coarseSalt',
      'seaSalt',
    ]);
  });

  it('every drink maps to a guide whose window contains its default grind', () => {
    for (const d of DRINKS) expect(fitFor(d.grindUm, guideForDrink(d.id)), d.id).toBe('ok');
  });

  it('flags grinds outside the drink window', () => {
    expect(fitFor(600, 'espresso')).toBe('tooCoarse');
    expect(fitFor(300, 'frenchPress')).toBe('tooFine');
  });

  it('formats dial ranges for coarse and fine-stepped dials', () => {
    expect(formatRange([8, 12], 1)).toBe('8–12');
    expect(formatRange([13.5, 21], 0.5)).toBe('13.5–21');
    expect(formatRange([9, 9], 1)).toBe('9');
  });
});
