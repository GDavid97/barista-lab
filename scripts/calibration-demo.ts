import { drinkById } from '../src/data/drinks';
import { simulate } from '../src/engine';
import { stateForDrink, type SimState } from '../src/pages/useBrewSetup';
import { buildInput, calibrationFrom, NO_CALIBRATION } from '../src/domain/calibration';
import { makeBrewRecord } from '../src/domain/journal';
const esp = (um: number, dose = 18, y = 36): SimState => { const s = stateForDrink(drinkById('espresso')!); return { ...s, particleUm: um, brew: { ...s.brew, doseG: dose, waterG: y } }; };
const TRUE = 1.15;
const real = (s: SimState) => simulate(buildInput(s, 'conical', { ...NO_CALIBRATION, grindFactor: TRUE })).timeS;
const hist = [esp(290), esp(320, 17), esp(305), esp(280, 18, 40), esp(310)];
const brews = hist.map((s, i) => ({ ...makeBrewRecord({ id: 'b' + i, now: i + 1, setup: s, result: simulate(buildInput(s, 'conical')), grindLabel: '', grinderKey: 'k', burr: 'conical' }), measured: { timeS: real(s) + (i % 2 ? 1 : -1) } }));
const next = esp(300);
console.log('valós idő a következő főzésnél:', real(next).toFixed(1), 's');
console.log('kalibrálatlan becslés:', simulate(buildInput(next, 'conical')).timeS.toFixed(1), 's');
for (const n of [1, 2, 3, 4, 5]) {
  const c = calibrationFrom(brews.slice(0, n), 'k', { keyOf: (b) => b.grinderKey! });
  const r = simulate(buildInput(next, 'conical', c));
  console.log(`${n} mérés után: becslés ${r.timeS.toFixed(1)} s, szorzó ${c.grindFactor.toFixed(3)}, bizalom ${(c.confidence * 100).toFixed(0)}%, EY sáv ±${r.eyUncertainty.toFixed(2)}`);
}
