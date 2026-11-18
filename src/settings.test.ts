import { describe, expect, it } from 'vitest';
import { cToF, fToC } from './settings';

describe('temperature units', () => {
  it('converts both ways', () => {
    expect(cToF(100)).toBe(212);
    expect(cToF(93)).toBeCloseTo(199.4);
    expect(fToC(cToF(91.5))).toBeCloseTo(91.5);
  });
});
