import { simulate } from '../src/engine';
import { DRINKS } from '../src/data/drinks';
const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => k.slice(0, 4) + ' ' + v.toFixed(1)).join(' | ');
const beans = {
  med: { robustaShare: 0, roast: 0.45, process: 'washed' as const, daysOffRoast: 14 },
  light: { robustaShare: 0, roast: 0.15, process: 'washed' as const, daysOffRoast: 14 },
  dark: { robustaShare: 0.3, roast: 0.85, process: 'natural' as const, daysOffRoast: 14 },
};
for (const d of DRINKS) {
  const r = simulate({ bean: beans.med, grind: { particleUm: d.grindUm, burr: 'conical' }, brew: d.brew, additions: d.additions, target: d.target });
  console.log(d.id.padEnd(12), `t${r.timeS.toFixed(0)} EY${r.ey.toFixed(1)} TDS${r.tds.toFixed(2)} caf${r.caffeineMg.toFixed(0)} kcal${r.kcal.toFixed(0)} ${r.balance.padEnd(8)}`, fmt(r.sensory as any), r.diagnoses.map(x=>x.key).join(','));
}
console.log('--- espresso grind sweep / beans');
for (const [bn, bean] of Object.entries(beans)) for (const um of [220, 260, 300, 340, 400]) {
  const r = simulate({ bean, grind: { particleUm: um, burr: 'conical' }, brew: DRINKS[1]!.brew });
  console.log(bn.padEnd(6), um, `t${r.timeS.toFixed(0)} EY${r.ey.toFixed(1)} TDS${r.tds.toFixed(1)} ${r.balance.padEnd(8)}`, fmt(r.sensory as any));
}
