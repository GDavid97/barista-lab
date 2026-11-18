import { GRINDERS } from '../src/data/grinders';
import { formatRange, settingRange, type GuideId } from '../src/domain/grindGuide';
const ids: GuideId[] = ['espresso', 'moka', 'aeropress', 'pourover', 'chemex', 'frenchPress'];
for (const g of GRINDERS) {
  const parts = ids.map((id) => { const r = settingRange(g.scale, id); return `${id} ${r ? formatRange(r, g.scale.step) : '—'}`; });
  console.log(g.name.padEnd(34), parts.join(' | '));
}
