import type { Lang } from '../i18n';

export interface Lesson {
  id: LessonId;
  emoji: string;
  title: string;
  /** One-sentence takeaway. */
  summary: string;
  paragraphs: string[];
  tips: string[];
}

export const LESSON_IDS = [
  'extraction',
  'strength',
  'grind',
  'espressoTime',
  'temperature',
  'freshness',
  'water',
  'milk',
  'roast',
  'calibration',
] as const;
export type LessonId = (typeof LESSON_IDS)[number];

/** Which lesson explains a given diagnosis. */
export const LESSON_FOR_DIAGNOSIS: Record<string, LessonId> = {
  underExtracted: 'extraction',
  overExtracted: 'extraction',
  onTarget: 'extraction',
  weak: 'strength',
  strong: 'strength',
  shotFast: 'espressoTime',
  shotSlow: 'espressoTime',
  shotFastPredicted: 'espressoTime',
  shotSlowPredicted: 'espressoTime',
  darkRoastHot: 'temperature',
  lightRoastCool: 'temperature',
  tooFresh: 'freshness',
  stale: 'freshness',
  waterSoft: 'water',
  waterHard: 'water',
  scaleRisk: 'water',
  milkTooHot: 'milk',
};

type Content = Record<LessonId, Omit<Lesson, 'id'>>;

const hu: Content = {
  extraction: {
    emoji: '⚗️',
    title: 'Kivonatolás (EY)',
    summary: 'Az EY megmutatja, a kávé hány százaléka oldódott ki – ettől lesz savanyú, édes vagy keserű.',
    paragraphs: [
      'A pörkölt kávébab tömegének kb. 28–32%-a oldható. A kivonatolási arány (EY, extraction yield) azt mutatja, ebből mennyi került a csészébe: 18 g kávéból 3,6 g oldott anyag 20%-os EY-t jelent.',
      'Az anyagok nem egyszerre oldódnak ki. Először a savak (gyümölcsös, élénk ízek), aztán a cukrok és karamellizált vegyületek (édesség), végül a nehezebb, keserű és fanyar anyagok. Ezért az alulkivonatolt kávé savanyú és vékony, a túlkivonatolt keserű és száraz.',
      'A legtöbb kávé a 18–22%-os sávban a legkiegyensúlyozottabb. Az EY-t elsősorban az őrlés, az idő, a hőmérséklet és az arány befolyásolja.',
    ],
    tips: [
      'Savanyú? Növeld a kivonatolást: finomabb őrlés, melegebb víz, hosszabb idő vagy több víz.',
      'Keserű, száraz? Csökkentsd: durvább őrlés, hűvösebb víz, rövidebb idő.',
      'Egyszerre csak egy dolgot változtass, különben nem tudod, mi segített.',
    ],
  },
  strength: {
    emoji: '💪',
    title: 'Erősség (TDS)',
    summary: 'A TDS azt mutatja, mennyire tömény az ital – ezt főleg a kávé–víz arány dönti el.',
    paragraphs: [
      'A TDS (total dissolved solids) az oldott anyagok aránya az italban. Egy jó filterkávé 1,15–1,45%, egy espresso 8–12% körül van.',
      'Az erősség és a kivonatolás két külön dolog. Egy kávé lehet tökéletesen kivonatolt, mégis híg – ilyenkor nem az őrlésen kell állítani, hanem az arányon.',
      'A kivonatolási térkép (EY × TDS) ezt a két tengelyt mutatja egyszerre: a zöld doboz az ideális zóna.',
    ],
    tips: [
      'Híg, de nem savanyú? Több kávé ugyanannyi vízhez (pl. 1:17 helyett 1:15).',
      'Túl tömény? Több víz, vagy espressónál nagyobb hozam.',
      'Refraktométerrel mérheted a TDS-t – írd be a naplóba, és a modell tanul belőle.',
    ],
  },
  grind: {
    emoji: '⚙️',
    title: 'Őrlés',
    summary: 'A finomabb őrlés nagyobb felületet ad: gyorsabb kivonatolás, lassabb átfolyás.',
    paragraphs: [
      'Minél kisebb a szemcse, annál nagyobb a felülete, és annál rövidebb utat kell megtenniük az oldott anyagoknak. A szemcsék felszínén a sejtek fel is törnek – ezekből szinte azonnal kioldódik minden.',
      'Minden őrlő ad valamennyi nagyon finom port (fines). Ezek gyorsan kivonatolódnak és lassítják az átfolyást. A kúpos őrlőkövek jellemzően több fines-t adnak, mint a lapos kövek.',
      'Az őrlők skálája nem szabványos: „10 kattintás” minden gépen mást jelent. Ezért érdemes kalibrálni.',
    ],
    tips: [
      'Espresso: finom, mint a porcukor · V60: mint a kristálycukor · French press: durva, mint a tengeri só.',
      'Új babnál kezdj a megszokott fokozattal, és a lefolyási idő alapján állíts.',
      'Az őrlőt a Saját pultomban kétpontos kalibrációval a te skáládhoz igazíthatod.',
    ],
  },
  espressoTime: {
    emoji: '⏱️',
    title: 'Lefolyási idő (espresso)',
    summary: 'Az espresso ideje a pogácsa ellenállását mutatja – az őrléssel szabályozod.',
    paragraphs: [
      'Az espresso nyomás alatt átfolyó víz. A Darcy-törvény szerint az átfolyás a szemcsemérettel együtt gyorsan nő: kicsit durvább őrlés jóval gyorsabb lövést ad.',
      'A klasszikus cél 1:2 arány (18 g → 36 g) kb. 25–32 mp alatt. A túl gyors lövés jellemzően alulkivonatolt, a túl lassú túlkivonatolt.',
      'A nagyon friss bab CO₂-t enged, ami lassítja az átfolyást; a sötétebb pörkölés törékenyebb, gyorsabban folyik.',
    ],
    tips: [
      'Gyors és savanyú? Őrölj finomabbra.',
      'Lassú és keserű? Őrölj durvábbra.',
      'Lassú, mégis savanyú? Lehet csatornázódás – egyengesd jobban az őrleményt (WDT), vagy emeld a hőfokot.',
    ],
  },
  temperature: {
    emoji: '🌡️',
    title: 'Vízhőmérséklet',
    summary: 'A melegebb víz gyorsabban old – világos pörköléshez meleg, sötéthez kicsit hűvösebb víz illik.',
    paragraphs: [
      'A kioldódás sebessége a hőmérséklettel exponenciálisan nő (Arrhenius-törvény). Néhány fok különbség is érezhető az ízben.',
      'A világos pörkölésű bab sűrűbb és nehezebben adja ki az anyagait, ezért 94–96 °C körül érzi jól magát. A sötét pörkölés porózusabb és könnyen kivonatolódik; forró vízzel hamar keserű lesz, 88–91 °C a kíméletesebb.',
      'A cold brew órákig ázik hideg vízben: lassan kivonatolódik, kevesebb savval és keserűséggel.',
    ],
    tips: [
      'Savanyú világos pörkölés: emeld a hőfokot 1–2 fokkal.',
      'Keserű sötét pörkölés: csökkentsd 2–3 fokkal.',
      'A vízforraló kijelzője gyakran túloz – egy egyszerű hőmérő sokat segít.',
    ],
  },
  freshness: {
    emoji: '📅',
    title: 'Frissesség',
    summary: 'A frissen pörkölt kávénak pihennie kell, de egy hónap után az aroma gyorsan fogy.',
    paragraphs: [
      'Pörkölés után a bab napokig szén-dioxidot enged. Ez taszítja a vizet: a kivonatolás egyenetlen, az espresso csatornázódik, a filternél nagyot pöffen a bloom.',
      'Filterhez 4–7, espressóhoz 7–14 nap pihenő ajánlott. Utána kb. egy hónapig van a bab a csúcson, aztán az illékony aromák egyre gyorsabban eltűnnek.',
      'Zárt, szelepes zacskóban, hűvös és sötét helyen tárold; a lefagyasztás adagonként hosszabbítja az élettartamot.',
    ],
    tips: [
      'Mindig nézd meg a pörkölés dátumát (nem a lejáratit!).',
      'Nagyon friss babbal légy türelmes a bloommal (45–60 mp).',
      'A Babkamra kijelzi, hol tart a babod: pihen, csúcson, fogyóban.',
    ],
  },
  water: {
    emoji: '💧',
    title: 'Víz',
    summary: 'A kávé 98%-a víz – a keménysége kivonatolást, savasságot és a géped élettartamát is befolyásolja.',
    paragraphs: [
      'Az összes keménység (GH, főleg Ca²⁺ és Mg²⁺) segíti az ízanyagok kioldását. A desztillált víz lapos, vékony kávét ad.',
      'A karbonátkeménység (KH, lúgosság) puffereli a savakat: kevés kell belőle, különben a kávé tompa, krétás lesz.',
      'Az SCA ajánlása nagyjából 50–175 ppm összes keménység és ~40 ppm lúgosság. A kemény víz ráadásul vízkövet rak le a kávégépben.',
    ],
    tips: [
      'Kemény csapvíznél a kancsós szűrő már sokat javít.',
      'Espressogépbe soha ne tegyél nagyon kemény vizet – a vízkő a gép legnagyobb ellensége.',
      'Tesztcsíkkal vagy a vízszolgáltató adataiból megtudhatod a pontos értékeket.',
    ],
  },
  milk: {
    emoji: '🥛',
    title: 'Tej és hab',
    summary: 'A tej tompítja a savat és a keserűt, édesít – 55–65 °C-ra habosítva a legédesebb.',
    paragraphs: [
      'A tej zsírja és fehérjéje elfedi a kávé savasságát és keserűségét, a laktóz édességet ad. Ezért tejes italba gyakran testesebb, sötétebb pörkölést választanak.',
      'A laktóz édessége 55–65 °C körül a legérezhetőbb. 70 °C fölött a tej „főtt” ízű lesz, és a hab is szétesik.',
      'A selymes mikrohab (latte, flat white) sűrű és fényes; a habosabb, levegősebb textúra (cappuccino) nagyobb térfogatot ad.',
    ],
    tips: [
      'Hideg tejből és hideg kancsóból indulj.',
      'A kancsó oldala akkor jó, amikor már épp nem tudod tartani rajta a kezed.',
      'Növényi italokból a „barista” változatok habosodnak jól.',
    ],
  },
  roast: {
    emoji: '🔥',
    title: 'Pörkölés',
    summary: 'A világos pörkölés gyümölcsös és savas, a sötét testes, csokis és keserűbb.',
    paragraphs: [
      'Pörkölés közben a savak és cukrok egy része keserű, barna vegyületekké (melanoidinek) alakul. Minél sötétebb a pörkölés, annál kevesebb a sav és annál több a keserű anyag.',
      'A világos bab sűrűbb, nehezebben kivonatolható: finomabb őrlést és melegebb vizet kér. A sötét bab porózus, könnyen túlkivonatolódik.',
      'A feldolgozás is számít: a mosott kávé tiszta és savasabb, a natúr gyümölcsösebb és édesebb.',
    ],
    tips: [
      'Világos pörkölés: 94–96 °C, kicsit finomabb őrlés, hosszabb arány.',
      'Sötét pörkölés: 88–91 °C, kicsit durvább őrlés.',
      'Tejes italokhoz a közepes–sötét pörkölés a biztos választás.',
    ],
  },
  calibration: {
    emoji: '🎯',
    title: 'Személyes kalibráció',
    summary: 'Minden mért adat közelebb hozza a becslést a te konyhádhoz.',
    paragraphs: [
      'A modell fizikai alapon számol, de az őrlőd valódi szemcsemérete és a géped viselkedése egyedi. Ezért tanul a naplódból.',
      'Ha megadod a mért lefolyási időt, kiszámolja, mekkora szemcseméret magyarázza – és ezt az őrlődhöz rendeli. A refraktométeres TDS a kivonatolás becslését igazítja.',
      'A frissebb mérések többet számítanak, egyetlen furcsa mérés pedig nem borítja fel a modellt. A bizalom a mérések számával nő, a becslési sáv pedig szűkül.',
    ],
    tips: [
      'Espressónál mindig írd be a valódi lefolyási időt.',
      'Ha őrlőt cserélsz vagy szétszeded tisztítani, töröld a kalibrációt.',
      'A belövési asszisztens a kóstolásod alapján javasol következő lépést.',
    ],
  },
};

const en: Content = {
  extraction: {
    emoji: '⚗️',
    title: 'Extraction (EY)',
    summary: 'EY tells how much of the coffee dissolved – it is what makes a cup sour, sweet or bitter.',
    paragraphs: [
      'About 28–32% of roasted coffee is soluble. Extraction yield (EY) is how much of it ended up in your cup: 3.6 g of solids from 18 g of coffee is 20% EY.',
      'Compounds do not dissolve all at once. Acids come first (fruity, bright), then sugars and caramelised compounds (sweetness), and finally heavier bitter and astringent ones. That is why under-extracted coffee is sour and thin, and over-extracted coffee bitter and dry.',
      'Most coffees taste most balanced between 18 and 22%. Grind, time, temperature and ratio are the main levers.',
    ],
    tips: [
      'Sour? Extract more: finer grind, hotter water, longer time or more water.',
      'Bitter and dry? Extract less: coarser grind, cooler water, shorter time.',
      'Change one thing at a time, or you will not know what helped.',
    ],
  },
  strength: {
    emoji: '💪',
    title: 'Strength (TDS)',
    summary: 'TDS is how concentrated the drink is – mostly set by the coffee-to-water ratio.',
    paragraphs: [
      'TDS (total dissolved solids) is the share of dissolved solids in the drink. A good filter coffee is about 1.15–1.45%, an espresso 8–12%.',
      'Strength and extraction are different things. A coffee can be perfectly extracted yet weak – then change the ratio, not the grind.',
      'The brewing control chart (EY × TDS) shows both axes at once; the green box is the ideal zone.',
    ],
    tips: [
      'Weak but not sour? More coffee for the same water (e.g. 1:15 instead of 1:17).',
      'Too strong? More water, or a bigger yield for espresso.',
      'Measure TDS with a refractometer and log it – the model learns from it.',
    ],
  },
  grind: {
    emoji: '⚙️',
    title: 'Grind',
    summary: 'Finer grinds have more surface: faster extraction, slower flow.',
    paragraphs: [
      'Smaller particles have more surface and shorter paths for solubles. Cells on the surface are broken open by grinding and release their contents almost instantly.',
      'Every grinder makes some very fine dust (fines). Fines extract fast and slow the flow. Conical burrs typically produce more fines than flat burrs.',
      'Grinder dials are not standard: “10 clicks” means something different on every grinder. That is why calibration matters.',
    ],
    tips: [
      'Espresso: fine like powdered sugar · V60: like granulated sugar · French press: coarse like sea salt.',
      'With new beans start from your usual setting and adjust by shot time.',
      'Calibrate your grinder with two points under My bar.',
    ],
  },
  espressoTime: {
    emoji: '⏱️',
    title: 'Shot time (espresso)',
    summary: 'Shot time reflects the puck’s resistance – you control it with the grind.',
    paragraphs: [
      'Espresso is water pushed through a puck under pressure. By Darcy’s law, flow rises steeply with particle size: a slightly coarser grind gives a much faster shot.',
      'The classic target is a 1:2 ratio (18 g → 36 g) in about 25–32 s. Too fast usually means under-extracted, too slow over-extracted.',
      'Very fresh beans release CO₂ that slows the flow; darker roasts are more brittle and run faster.',
    ],
    tips: [
      'Fast and sour? Grind finer.',
      'Slow and bitter? Grind coarser.',
      'Slow yet sour? Maybe channeling – distribute better (WDT) or raise the temperature.',
    ],
  },
  temperature: {
    emoji: '🌡️',
    title: 'Water temperature',
    summary: 'Hotter water dissolves faster – light roasts like it hot, dark roasts a bit cooler.',
    paragraphs: [
      'Extraction speed rises exponentially with temperature (Arrhenius). A few degrees are noticeable in the cup.',
      'Light roasts are dense and give up their solubles reluctantly, so they like 94–96 °C. Dark roasts are porous and extract easily; with very hot water they turn bitter quickly, 88–91 °C is gentler.',
      'Cold brew steeps for hours in cold water: slow extraction with less acidity and bitterness.',
    ],
    tips: [
      'Sour light roast: raise the temperature by 1–2 degrees.',
      'Bitter dark roast: lower it by 2–3 degrees.',
      'Kettle displays often exaggerate – a simple thermometer helps.',
    ],
  },
  freshness: {
    emoji: '📅',
    title: 'Freshness',
    summary: 'Freshly roasted coffee needs rest, but after a month the aroma fades fast.',
    paragraphs: [
      'For days after roasting, beans release carbon dioxide. It repels water: extraction is uneven, espresso channels, filter blooms violently.',
      'Rest about 4–7 days for filter and 7–14 for espresso. Beans are then at their best for about a month before volatile aromas fade quickly.',
      'Store in a sealed, valved bag somewhere cool and dark; freezing in single doses extends their life.',
    ],
    tips: [
      'Always check the roast date (not the best-before date!).',
      'Be patient with the bloom (45–60 s) when beans are very fresh.',
      'The Bean shelf shows where your beans are: resting, at peak, fading.',
    ],
  },
  water: {
    emoji: '💧',
    title: 'Water',
    summary: 'Coffee is 98% water – its hardness affects extraction, acidity and your machine’s life.',
    paragraphs: [
      'General hardness (GH, mostly Ca²⁺ and Mg²⁺) helps pull flavour out. Distilled water makes flat, thin coffee.',
      'Carbonate hardness (KH, alkalinity) buffers acids: a little is good, too much makes coffee dull and chalky.',
      'The SCA recommends roughly 50–175 ppm total hardness and ~40 ppm alkalinity. Hard water also scales your machine.',
    ],
    tips: [
      'With hard tap water, a jug filter already helps a lot.',
      'Never put very hard water into an espresso machine – scale is its worst enemy.',
      'Test strips or your water report give you real numbers.',
    ],
  },
  milk: {
    emoji: '🥛',
    title: 'Milk & foam',
    summary: 'Milk mutes acidity and bitterness and adds sweetness – sweetest steamed to 55–65 °C.',
    paragraphs: [
      'Milk fat and protein mask acidity and bitterness, and lactose adds sweetness. That is why milk drinks often use fuller, darker roasts.',
      'Lactose tastes sweetest around 55–65 °C. Above 70 °C milk tastes cooked and the foam breaks down.',
      'Silky microfoam (latte, flat white) is dense and glossy; airier foam (cappuccino) adds volume.',
    ],
    tips: [
      'Start with cold milk and a cold jug.',
      'The jug is ready when you can just no longer keep your hand on it.',
      'For plant drinks, “barista” versions foam best.',
    ],
  },
  roast: {
    emoji: '🔥',
    title: 'Roast',
    summary: 'Light roasts are fruity and bright, dark roasts heavy, chocolatey and more bitter.',
    paragraphs: [
      'During roasting, part of the acids and sugars turns into bitter brown compounds (melanoidins). The darker the roast, the fewer acids and the more bitter compounds.',
      'Light beans are denser and harder to extract: finer grind and hotter water. Dark beans are porous and over-extract easily.',
      'Processing matters too: washed coffees are clean and brighter, naturals fruitier and sweeter.',
    ],
    tips: [
      'Light roast: 94–96 °C, slightly finer, longer ratio.',
      'Dark roast: 88–91 °C, slightly coarser.',
      'For milk drinks, medium-dark is the safe choice.',
    ],
  },
  calibration: {
    emoji: '🎯',
    title: 'Personal calibration',
    summary: 'Every measurement brings the estimate closer to your own kitchen.',
    paragraphs: [
      'The model is physics-based, but your grinder’s real particle size and your machine’s behaviour are unique. So it learns from your journal.',
      'Enter a measured shot time and it works out which particle size explains it, per grinder. Refractometer TDS readings tune the extraction estimate.',
      'Recent measurements count more, and a single odd one cannot derail the model. Confidence grows with every measurement and the estimate band narrows.',
    ],
    tips: [
      'For espresso, always log the real shot time.',
      'Reset the calibration after changing or disassembling your grinder.',
      'The dial-in assistant suggests a next step from your tasting.',
    ],
  },
};

const CONTENT: Record<Lang, Content> = { hu, en };

export function getLessons(lang: Lang): Lesson[] {
  return LESSON_IDS.map((id) => ({ id, ...CONTENT[lang][id] }));
}

export function getLesson(lang: Lang, id: string): Lesson | undefined {
  return (LESSON_IDS as readonly string[]).includes(id) ? { id: id as LessonId, ...CONTENT[lang][id as LessonId] } : undefined;
}
