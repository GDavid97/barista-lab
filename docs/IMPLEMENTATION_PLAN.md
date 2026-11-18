# Barista Lab – Implementációs terv

**Cél:** otthoni barista webapp (PWA), amely a felszerelés, a kávébab és a recept alapján
megbecsüli a kész kávé tulajdonságait (EY, TDS, ízprofil, koffein, testesség…), és
javaslatokkal segít a recept „belövésében”.

**Keretek:** saját hobbiprojekt · webapp + PWA (offline, telepíthető) · magyar és angol nyelv ·
nincs fiók / közösségi funkció · a szimuláció legyen minél pontosabb (fizikai alapú modell).

## Technológia

| Terület | Választás | Indok |
|---|---|---|
| Build | Vite + TypeScript | gyors, egyszerű |
| UI | React | elterjedt, sok példa |
| PWA | vite-plugin-pwa (Workbox) | manifest + service worker |
| Tárolás | IndexedDB (Dexie) – 4. fázistól | offline, strukturált adatok |
| i18n | saját, típusbiztos szótár (hu/en) | nincs függőség, a hiányzó kulcs fordítási hiba |
| Diagramok | saját SVG (radar, kivonatolási térkép) | kis méret, teljes kontroll |
| Teszt | Vitest | a motor tiszta függvényei jól tesztelhetők |

## Architektúra

```
src/
  engine/   tiszta TS szimulációs motor (nincs React-függés) + tesztek
  data/     törzsadatok: italtípusok, őrlő-adatbázis, tejek, ideális tartományok
  i18n/     hu.ts (forrás), en.ts (ugyanazzal a típussal), useT hook
  ui/       újrahasznosítható komponensek (RadarChart, ControlChart, mezők)
  pages/    oldalak
```

A motor **fordítási kulcsokat** ad vissza (pl. `diag.underExtracted`), nem szöveget,
így nyelvfüggetlen.

## A szimulációs modell (v1)

1. **Őrlés → szemcseméret:** az őrlő beállítása lineárisan µm-re képeződik
   (adatbázis vagy kétpontos kalibráció). Bimodális eloszlás: finomszemcse-arány (fines)
   az őrlőkő típusából (kúpos > lapos).
2. **Két kompartmentes kioldódás:**
   - *gyors rész*: feltört sejtek a szemcse felszínén (arány: `1-(1-2c/d)^3`) + finomszemcsék,
     másodpercek alatt kioldódnak;
   - *lassú rész*: diffúzió ép sejtekből – gömb diffúziós megoldás (Crank-sor),
     `x = D·t/r²`.
3. **Hőmérséklet:** Arrhenius-függés a diffúziós együtthatóra + oldható anyag mennyisége.
4. **Módszerek:** perkoláció (espresso, filter, moka) – hajtóerő a víz/kávé arányból;
   immerzió (French press, AeroPress, cold brew) – egyensúlyi korlát.
5. **Vegyületcsoportok:** savak, édes anyagok, keserű anyagok, fanyar/nehéz anyagok,
   koffein – mindegyik saját diffúziós szorzóval (a savak oldódnak elsőként, a fanyar anyagok
   utoljára). Az EY a csoportok összege → konzisztens ízprofil.
6. **Átfolyás (espresso):** Darcy/Kozeny–Carman: áramlás ∝ d_eff² · nyomás / (viszkozitás · ágyhossz)
   → becsült lefolyási idő.
7. **Érzékszervi leképezés:** csoportarányok egy referencia-főzéshez viszonyítva, erősségkorrekció,
   maszkolás (édesség ↔ keserűség), tej és hígítás hatása.
8. **Javaslatok:** felezéses kereséssel kiszámolja az ideális EY-hoz szükséges őrlést
   (µm + az őrlő saját skáláján).

A modellkonstansok egy helyen (`engine/constants.ts`) vannak; referencia-főzésekkel kalibrálva,
tesztekkel rögzítve.

## Fázisok

### 0. fázis – Alapok ✅
- Vite + React + TS projekt, PWA-plugin, manifest, ikon
- i18n infrastruktúra (hu/en, nyelvváltó, a választás megjegyzése)
- Vitest, `typecheck` script
- **Kész, ha:** `npm run dev`, `npm test` és `npm run build` hiba nélkül fut.

### 1. fázis – Domain-modell és törzsadatok ✅
- Típusok: bab, őrlés, főzés, víz, hozzávalók, eredmény
- Italtípusok (espresso-alapú és filteres), alapreceptek
- Őrlő-adatbázis (közelítő µm/lépés) + egyéni kétpontos kalibráció
- Tejtípusok (kalória, édesség, test)
- **Kész, ha:** minden italtípus érvényes alaprecepttel szimulálható.

### 2. fázis – Szimulációs motor v1 ✅
- Kinetika, átfolyás, EY/TDS, érzékszervi profil, koffein, kalória, diagnózis, őrlés-javaslat
- Referencia-főzések tesztjei (pl. 18 g → 36 g espresso, 28 mp → EY 19–21%, TDS 9–11%)
- Monotonitási tesztek (finomabb őrlés → nagyobb EY; magasabb hőfok → nagyobb EY; stb.)
- **Kész, ha:** az összes referencia- és monotonitási teszt zöld.

### 3. fázis – Szimulátor-felület ✅ (első verzió)
- Egy oldal: ital, bab, őrlő, paraméterek → élő eredmény
- Mérőszám-kártyák, ízradar, kivonatolási térkép (EY × TDS), diagnózis és javaslatok
- Mobil-first, világos/sötét téma
- **Kész, ha:** telefonon is kényelmesen használható, a csúszkákra azonnal frissül.

### 4. fázis – Adattárolás: Saját pultom és Babkamra ✅
- Dexie séma: grinders, machines, beans (a recipes és brews táblák az 5–6. fázisban jönnek)
- Őrlő/gép CRUD, alapértelmezett eszközök, kétpontos őrlő-kalibráció
- Bab CRUD: eredet, feldolgozás, pörkölés, pörkölés dátuma, ízjegyek, készlet (g)
- Frissesség-jelző (pihen / csúcson / fogyóban)
- **Kész, ha:** újratöltés után minden megmarad, offline is működik.

### 5. fázis – Főzés-varázsló és főzés mód ✅
- Lépések: ital → bab → eszközök (előtöltve) → paraméterek → becslés → főzés
- Főzés mód: időzítő, öntési menetrend (filter), lépésenkénti útmutató, ébren tartott kijelző
- A babkészlet automatikus csökkentése
- **Kész, ha:** egy teljes főzés végigvihető a varázslóval.

### 6. fázis – Napló és kóstolási visszajelzés ✅
- Főzés mentése: becsült + mért adatok (idő, hozam, TDS) + értékelés
- Gyors értékelés: savanyú ↔ keserű, gyenge ↔ erős, csillagok, jegyzet
- Előzmények listája, szűrés babra/italra, két főzés összevetése (radar overlay)
- **Kész, ha:** a naplóból bármelyik főzés megnyitható és újrafőzhető.

### 7. fázis – Belövési asszisztens és személyes kalibráció ✅
- Becsült ↔ mért eltérésből eszközönkénti korrekció (őrlés-eltolás µm-ben, EY-torzítás)
- A kóstolási visszajelzésből következő lépés javaslata („2 kattintással finomabbra”)
- Kalibráció bizalmi szintje, ami a becslési sávot szűkíti
- **Kész, ha:** 3–5 visszajelzés után a becsült lefolyási idő mérhetően közelebb kerül a méréshez.

### 8. fázis – PWA finomítás ✅
- Offline-first ellenőrzés, telepítési felhívás, frissítési értesítés (kérésre frissít, így nem szakít meg főzést)
- PNG ikonok (192/512, maskable, Apple touch), parancsikonok (Főzés, Napló)
- Adatexport/-import (JSON) – biztonsági mentés, összefésülés vagy csere
- Beállítások: °C/°F, alapnézet (egyszerű/haladó), téma (rendszer/világos/sötét), nyelv
- *Eltérés:* a g/oz váltás kimaradt – kávéadagolásnál a gramm az általános, a mérlegek is így mérnek.
- **Kész, ha:** a böngésző telepíthetőségi ellenőrzése hibamentes (a Lighthouse PWA kategóriája megszűnt),
  offline újratöltés működik, export → törlés → import visszaállít mindent.

### 9. fázis – Modell v2 és tanuló mód ✅
- Vízkémia (GH/KH) részletesebben, további módszerek (török, szifon, Clever)
- Tej habosítás hatása, cukor/szirupok
- Tanuló mód: rövid leckék a diagnózisokhoz
- „Mi lenne ha?” összehasonlító nézet

## Kockázatok és kezelésük
- **Becslési pontosság:** fizikai alapú modell + személyes kalibráció + becslési sáv kijelzése.
- **Őrlő-adatok bizonytalansága:** az adatbázis értékei közelítők; kétpontos kalibráció ajánlott.
- **Túl bonyolult UI:** egyszerű/haladó mód, okos alapértékek az italtípusokból.

## v1.1 – Továbbfejlesztések ✅
- **Recept-kereső (fordított tervezés):** ízcélból vagy pontos EY/TDS-célból rögzített adag mellett kiszámolja
  az őrlést (az őrlő fokozatára kerekítve, személyes kalibrációval), az arányt és a hőfokot; espressónál
  a profilhoz igazított időablakon belül marad. (`src/domain/solver.ts`)
- **Lövésgörbe és nyomásprofilok:** időléptékes espresso-modell (fej feltöltése → pogácsa átázása → lefolyás,
  pogácsa-erózió); profilok: állandó, előáztatás, blooming, csökkenő, karos. Az állandó profil a korábbi
  zárt képletet adja vissza, így a kalibráció érvényes marad. Görbe a szimulátorban, élő kurzor és
  „most ennyi legyen a mérlegen” főzés közben. (`src/engine/shot.ts`)

## v1.2 – 3D labor ✅
- three.js alapú interaktív espresso-modell (`src/lab/espressoScene.ts`, oldal: `#/lab`), külön csomagban
  lusta betöltéssel. A pogácsa ~2400 szemcséből áll (méret az őrlésből, finomszemcsék, pörkölésfüggő szín);
  a kivonatolási front felülről lefelé világosítja a szemcséket; vízcseppek, két kifolyó sugár, töltődő pohár
  krémával. Metszet (clipping plane), automatikus forgatás, idővonal lejátszással és tekeréssel.
- Az időzítést, nyomást, átfolyást és az EY/TDS értékeket a valódi motor (`simulateShot`, `simulate`) adja.
