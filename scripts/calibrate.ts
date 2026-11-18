import { extract, caffeineMg } from '../src/engine/extraction';
import type { SimulationInput } from '../src/engine/types';
const bean = { robustaShare: 0, roast: 0.45, process: 'washed' as const, daysOffRoast: 14 };
const cases: [string, SimulationInput][] = [
  ['espresso 18/36 300um', { bean, grind: { particleUm: 300, burr: 'conical' }, brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, filter: 'metal' } }],
  ['ristretto 18/20', { bean, grind: { particleUm: 300, burr: 'conical' }, brew: { method: 'espresso', doseG: 18, waterG: 20, tempC: 93, filter: 'metal' } }],
  ['lungo 18/54', { bean, grind: { particleUm: 300, burr: 'conical' }, brew: { method: 'espresso', doseG: 18, waterG: 54, tempC: 93, filter: 'metal' } }],
  ['espresso 270um', { bean, grind: { particleUm: 270, burr: 'conical' }, brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, filter: 'metal' } }],
  ['v60 15/250 650', { bean, grind: { particleUm: 650, burr: 'conical' }, brew: { method: 'pourover', doseG: 15, waterG: 250, tempC: 94, filter: 'paper' } }],
  ['french 30/500 1000 4min', { bean, grind: { particleUm: 1000, burr: 'conical' }, brew: { method: 'immersion', doseG: 30, waterG: 500, tempC: 95, timeS: 240, filter: 'metal' } }],
  ['aeropress 15/220 500 85C', { bean, grind: { particleUm: 500, burr: 'conical' }, brew: { method: 'aeropress', doseG: 15, waterG: 220, tempC: 85, timeS: 120, filter: 'paper' } }],
  ['moka 15/150 400', { bean, grind: { particleUm: 400, burr: 'conical' }, brew: { method: 'moka', doseG: 15, waterG: 150, tempC: 90, filter: 'metal' } }],
  ['cold 100/1000 1100 16h 20C', { bean, grind: { particleUm: 1100, burr: 'conical' }, brew: { method: 'coldbrew', doseG: 100, waterG: 1000, tempC: 20, timeS: 57600, filter: 'paper' } }],
];
for (const [n, c] of cases) {
  const r = extract(c);
  const f = Object.fromEntries(Object.entries(r.classExtraction).map(([k, v]) => [k, v.toFixed(2)]));
  console.log(n.padEnd(28), 't', r.timeS.toFixed(0), 'EY', r.ey.toFixed(1), 'TDS', r.tds.toFixed(2), 'bev', r.beverageG.toFixed(0), 'caf', caffeineMg(c, r).toFixed(0), JSON.stringify(f));
}
