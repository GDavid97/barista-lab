# Barista Lab

Otthoni barista webapp (PWA): a felszerelés, a kávébab és a recept alapján megbecsüli a kész
kávé tulajdonságait (EY, TDS, ízprofil, koffein, testesség), és javaslatot ad a recept belövéséhez.

## Parancsok

```bash
npm install
npm run dev        # fejlesztői szerver
npm test           # motor-tesztek (Vitest)
npm run typecheck
npm run build      # éles build + service worker
npm run preview    # az éles build kipróbálása
```

Modellkalibrációs segédszkriptek (a referencia-főzések kiírása):

```bash
npx vite-node scripts/calibrate.ts
npx vite-node scripts/sensory.ts
```

## Felépítés

- `src/engine/` – fizikai alapú szimulációs motor (tiszta TypeScript, React nélkül)
  - `physics.ts` – gömbdiffúzió, Arrhenius, viszkozitás, szemcse-eloszlás
  - `flow.ts` – espresso átfolyás (Darcy), filter lefolyási idő
  - `extraction.ts` – két kompartmentes kioldódás vegyületcsoportonként, EY/TDS, koffein
  - `sensory.ts` – ízprofil, tej és hígítás hatása
  - `simulate.ts` – összefogó függvény, diagnózis, őrlés- és adagjavaslat
  - `constants.ts` – minden hangolható modellkonstans
- `src/data/` – italtípusok, őrlő-adatbázis
- `src/i18n/` – magyar (forrás) és angol szótár, típusbiztos kulcsokkal
- `src/ui/`, `src/pages/` – felület

A teljes ütemterv: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
