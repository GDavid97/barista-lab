import { simulate, simulateShot } from '../src/engine';
for (const profile of [undefined, 'flat', 'preinfusion', 'blooming', 'declining', 'lever'] as const) {
  const input = { bean: { robustaShare: 0, roast: 0.45, process: 'washed' as const, daysOffRoast: 14 }, grind: { particleUm: 300, burr: 'conical' as const }, brew: { method: 'espresso' as const, doseG: 18, waterG: 36, tempC: 93, pressureBar: 9, filter: 'metal' as const, profile } };
  const r = simulate(input); const c = simulateShot(input)!;
  console.log(String(profile ?? 'closed-form').padEnd(12), `idő ${r.timeS.toFixed(1)} s · első csepp ${c.firstDropS.toFixed(1)} s · EY ${r.ey.toFixed(1)}% · fanyar ${r.sensory.astringency.toFixed(1)}`);
}
