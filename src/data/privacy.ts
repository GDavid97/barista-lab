import type { Lang } from '../i18n';

/** Controller details shown in the privacy notice. */
export const CONTROLLER = {
  name: 'Göbölyös Dávid',
  email: 'davidgobolyos@gmail.com',
} as const;


export interface PrivacySection {
  title: string;
  paragraphs: string[];
  list?: string[];
  /** Paragraphs shown after the list. */
  after?: string[];
}

export interface PrivacyNotice {
  title: string;
  updated: string;
  summary: string;
  sections: PrivacySection[];
}

const hu: PrivacyNotice = {
  title: 'Adatvédelmi tájékoztató',
  updated: 'Utolsó módosítás: 2026. november 18.',
  summary:
    'Röviden: a Barista Lab nem gyűjt rólad adatot. Minden, amit beírsz, csak a saját eszközödön, a böngésződben tárolódik, és sehová nem kerül feltöltésre. Nincs regisztráció, nincs süti, nincs analitika és nincs hirdetés.',
  sections: [
    {
      title: '1. Ki az adatkezelő?',
      paragraphs: [
        `Az alkalmazást ${CONTROLLER.name} magánszemélyként fejleszti és üzemelteti, nem üzleti tevékenység keretében.`,
        `Kapcsolat: ${CONTROLLER.email}`,
      ],
    },
    {
      title: '2. Milyen adatokat tárol az app – és hol?',
      paragraphs: [
        'Az általad megadott adatok kizárólag a saját eszközödön, a böngésző helyi tárhelyén (IndexedDB és localStorage) tárolódnak:',
      ],
      list: [
        'az őrlőid, kávéfőző gépeid és kávébabjaid adatai,',
        'a főzési naplód, értékeléseid és ízjegyzeteid,',
        'a beállításaid (nyelv, téma, mértékegység), az aktuális recept és a kalibráció.',
      ],
      after: [
        'Ezekhez az adatokhoz a fejlesztő nem fér hozzá: az app nem küldi el őket semmilyen szerverre. Az alkalmazás telepítés után internetkapcsolat nélkül is működik.',
        'Az „Exportálás” gombbal készített mentés egy fájl, amely a te eszközödre töltődik le; azt csak te osztod meg, ha szeretnéd.',
      ],
    },
    {
      title: '3. Sütik, követés, analitika',
      paragraphs: [
        'Az app nem használ sütiket, nem használ analitikai vagy követő eszközt, nem jelenít meg hirdetést, és nem tölt be külső szolgáltatótól betűtípust vagy szkriptet.',
        'A helyi tárhely használata az app működéséhez feltétlenül szükséges (enélkül nem maradnának meg a beírt adataid), ezért ehhez nem kell külön hozzájárulás.',
      ],
    },
    {
      title: '4. Tárhelyszolgáltató (Cloudflare)',
      paragraphs: [
        'Az oldalt a Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA) szolgálja ki. Amikor megnyitod az oldalt, a böngésződ – mint bármely weboldal esetén – technikai adatokat küld a szervernek: IP-cím, időpont, a kért fájl, böngésző típusa.',
        'Ezeket az adatokat a Cloudflare az oldal kiszolgálásához és a túlterheléses támadások elleni védelemhez kezeli, rövid ideig. A fejlesztő nem kapcsolt be naplózást vagy látogatottsági statisztikát, és ezekhez az adatokhoz nem fér hozzá.',
        'Jogalap: az oldal biztonságos működtetéséhez fűződő jogos érdek (GDPR 6. cikk (1) f)). A Cloudflare részt vesz az EU–USA adatvédelmi keretrendszerben (Data Privacy Framework), így az Egyesült Államokba történő adattovábbítás megfelelő garanciák mellett történik. Részletek: cloudflare.com/privacypolicy.',
      ],
    },
    {
      title: '5. Meddig maradnak meg az adatok?',
      paragraphs: [
        'A helyi adatok addig maradnak meg az eszközödön, amíg nem törlöd őket. Törölheted a böngésző beállításaiban az oldal adatainak törlésével („Webhelyadatok törlése”), illetve a telepített app eltávolításával. A törlést a fejlesztő nem tudja helyetted elvégezni, és visszaállítani sem tudja – ezért érdemes időnként mentést készíteni.',
      ],
    },
    {
      title: '6. Jogaid',
      paragraphs: [
        'A GDPR alapján jogod van tájékoztatást kérni, valamint kérni az adataid helyesbítését, törlését, kezelésük korlátozását, és tiltakozhatsz a kezelés ellen. Mivel a fejlesztő rólad nem tárol adatot, ezeket a helyi adatok esetében közvetlenül, a saját eszközödön tudod gyakorolni.',
        `Kérdéssel vagy panasszal írj a ${CONTROLLER.email} címre. Panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál is (NAIH, 1055 Budapest, Falk Miksa utca 9–11., naih.hu), vagy bírósághoz fordulhatsz.`,
      ],
    },
    {
      title: '7. Változások',
      paragraphs: [
        'Ha az app adatkezelése megváltozik (például új, szerverrel kommunikáló funkció kerül bele), ezt a tájékoztatót még a változás előtt frissítem, és a módosítás dátumát feltüntetem.',
      ],
    },
  ],
};

const en: PrivacyNotice = {
  title: 'Privacy notice',
  updated: 'Last updated: 18 November 2026',
  summary:
    'In short: Barista Lab does not collect any data about you. Everything you enter is stored only on your own device, in your browser, and is never uploaded anywhere. No account, no cookies, no analytics, no ads.',
  sections: [
    {
      title: '1. Who is responsible?',
      paragraphs: [
        `The app is developed and operated by ${CONTROLLER.name} as a private individual, not as a business.`,
        `Contact: ${CONTROLLER.email}`,
      ],
    },
    {
      title: '2. What the app stores – and where',
      paragraphs: ["Everything you enter is stored only on your own device, in the browser's local storage (IndexedDB and localStorage):"],
      list: [
        'your grinders, coffee machines and beans,',
        'your brew journal, ratings and tasting notes,',
        'your settings (language, theme, units), the current recipe and calibration.',
      ],
      after: [
        'The developer has no access to this data: the app never sends it to any server. Once installed, the app works without an internet connection.',
        'A backup made with “Export” is a file downloaded to your device; it is only shared if you share it.',
      ],
    },
    {
      title: '3. Cookies, tracking, analytics',
      paragraphs: [
        'The app uses no cookies, no analytics or tracking tools, shows no ads, and loads no fonts or scripts from third parties.',
        'Local storage is strictly necessary for the app to work (otherwise your data would not be kept), so no separate consent is required.',
      ],
    },
    {
      title: '4. Hosting provider (Cloudflare)',
      paragraphs: [
        'The site is served by Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA). When you open it, your browser sends technical data to the server, as with any website: IP address, time, the requested file and browser type.',
        'Cloudflare processes this data briefly to deliver the site and protect it from attacks. The developer has not enabled request logging or visitor statistics and has no access to this data.',
        'Legal basis: legitimate interest in operating the site securely (Art. 6(1)(f) GDPR). Cloudflare participates in the EU–US Data Privacy Framework, so transfers to the United States are covered by appropriate safeguards. Details: cloudflare.com/privacypolicy.',
      ],
    },
    {
      title: '5. How long is data kept?',
      paragraphs: [
        "Local data stays on your device until you delete it – by clearing this site's data in your browser settings or by uninstalling the app. The developer cannot delete or restore it for you, so make a backup now and then.",
      ],
    },
    {
      title: '6. Your rights',
      paragraphs: [
        'Under the GDPR you have the right to access, rectify and erase your data, to restrict its processing and to object to it. Since the developer holds no data about you, you can exercise these rights over your local data directly on your own device.',
        `For questions or complaints, write to ${CONTROLLER.email}. You may also lodge a complaint with the Hungarian data protection authority (NAIH, 1055 Budapest, Falk Miksa utca 9–11, naih.hu) or the supervisory authority of your country, or go to court.`,
      ],
    },
    {
      title: '7. Changes',
      paragraphs: [
        'If the way the app handles data changes (for example a new feature that talks to a server), this notice will be updated before the change, with the new date shown above.',
      ],
    },
  ],
};

const NOTICES: Record<Lang, PrivacyNotice> = { hu, en };

export const getPrivacyNotice = (lang: Lang): PrivacyNotice => NOTICES[lang];
