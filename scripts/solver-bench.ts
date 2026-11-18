import { drinkById } from '../src/data/drinks';
import { grinderById } from '../src/data/grinders';
import { stateForDrink } from '../src/pages/useBrewSetup';
import { goalTarget, solveRecipe } from '../src/domain/solver';
for (const id of ['espresso', 'v60', 'coldBrew']) {
  const s = stateForDrink(drinkById(id)!);
  const t0 = performance.now();
  const r = solveRecipe({ ...s, particleUm: s.particleUm * 1.3 }, goalTarget('sweeter', s, 'conical'), { burr: 'conical', scale: grinderById('comandante-c40')!.scale });
  console.log(id.padEnd(9), `${(performance.now() - t0).toFixed(0)} ms`, `→ ${r.state.particleUm}µm ${r.state.brew.waterG}g ${r.state.brew.tempC}°C · EY ${r.result.ey.toFixed(1)} TDS ${r.result.tds.toFixed(2)} t ${r.result.timeS.toFixed(0)}s feasible=${r.feasible}`);
}
