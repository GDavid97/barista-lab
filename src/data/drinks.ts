import type { Additions, BrewInput, TargetOverride } from '../engine';

export interface DrinkType {
  /** Also the i18n key under `drinks.*`. */
  id: string;
  group: 'espresso' | 'milk' | 'filter';
  brew: BrewInput;
  /** Recommended median particle size (µm). */
  grindUm: number;
  additions?: Additions;
  target?: TargetOverride;
}

const shot = (doseG: number, waterG: number): BrewInput => ({
  method: 'espresso',
  doseG,
  waterG,
  tempC: 93,
  pressureBar: 9,
  filter: 'metal',
});

export const DRINKS: DrinkType[] = [
  { id: 'ristretto', group: 'espresso', brew: shot(18, 22), grindUm: 260, target: { tds: [12, 17], time: [16, 26] } },
  { id: 'espresso', group: 'espresso', brew: shot(18, 36), grindUm: 300 },
  { id: 'lungo', group: 'espresso', brew: shot(18, 54), grindUm: 330, target: { tds: [5.5, 8], time: [28, 45] } },
  { id: 'americano', group: 'espresso', brew: shot(18, 36), grindUm: 300, additions: { waterMl: 120 } },
  { id: 'cappuccino', group: 'milk', brew: shot(18, 36), grindUm: 300, additions: { milkMl: 120, milkType: 'whole', foam: 'airy' } },
  { id: 'latte', group: 'milk', brew: shot(18, 36), grindUm: 300, additions: { milkMl: 220, milkType: 'whole' } },
  { id: 'flatWhite', group: 'milk', brew: shot(18, 30), grindUm: 290, additions: { milkMl: 110, milkType: 'whole' } },
  { id: 'cortado', group: 'milk', brew: shot(18, 36), grindUm: 300, additions: { milkMl: 50, milkType: 'whole' } },
  { id: 'macchiato', group: 'milk', brew: shot(18, 36), grindUm: 300, additions: { milkMl: 15, milkType: 'whole' } },
  {
    id: 'mocha',
    group: 'milk',
    brew: shot(18, 36),
    grindUm: 300,
    additions: { milkMl: 180, milkType: 'whole', foam: 'silky', syrup: { type: 'chocolate', ml: 20 } },
  },
  {
    id: 'v60',
    group: 'filter',
    brew: { method: 'pourover', doseG: 15, waterG: 250, tempC: 94, filter: 'paper' },
    grindUm: 650,
  },
  {
    id: 'chemex',
    group: 'filter',
    brew: { method: 'pourover', doseG: 30, waterG: 500, tempC: 94, filter: 'paper' },
    grindUm: 800,
  },
  {
    id: 'frenchPress',
    group: 'filter',
    brew: { method: 'immersion', doseG: 32, waterG: 500, tempC: 95, timeS: 240, filter: 'metal' },
    grindUm: 900,
  },
  {
    id: 'aeropress',
    group: 'filter',
    brew: { method: 'aeropress', doseG: 15, waterG: 220, tempC: 88, timeS: 110, filter: 'paper' },
    grindUm: 500,
  },
  {
    id: 'moka',
    group: 'filter',
    brew: { method: 'moka', doseG: 15, waterG: 150, tempC: 90, filter: 'metal' },
    grindUm: 450,
  },
  {
    id: 'clever',
    group: 'filter',
    brew: { method: 'clever', doseG: 20, waterG: 300, tempC: 94, timeS: 180, filter: 'paper' },
    grindUm: 700,
  },
  {
    id: 'siphon',
    group: 'filter',
    brew: { method: 'siphon', doseG: 20, waterG: 300, tempC: 92, timeS: 75, filter: 'cloth' },
    grindUm: 600,
  },
  {
    id: 'turkish',
    group: 'filter',
    brew: { method: 'turkish', doseG: 7, waterG: 70, tempC: 96, timeS: 150, filter: 'none' },
    grindUm: 120,
  },
  {
    id: 'coldBrew',
    group: 'filter',
    brew: { method: 'coldbrew', doseG: 100, waterG: 1000, tempC: 20, timeS: 14 * 3600, filter: 'paper' },
    grindUm: 1100,
  },
];

export const drinkById = (id: string) => DRINKS.find((d) => d.id === id);
