import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { requestPersistentStorage } from './db/schema';
import { useI18n } from './i18n';
import { Beans } from './pages/Beans';
import { Brew } from './pages/Brew';
import { Gear } from './pages/Gear';
import { Journal } from './pages/Journal';
import { Landing } from './pages/Landing';

// three.js is heavy: load the 3D lab (and three) only when the page is opened.
const Lab = lazy(() => import('./pages/Lab'));
import { Learn } from './pages/Learn';
import { Settings } from './pages/Settings';
import { Simulator } from './pages/Simulator';
import { PwaToasts } from './pwa';

const ROUTES = ['home', 'simulator', 'brew', 'lab', 'journal', 'gear', 'beans', 'settings', 'learn'] as const;
/** Routes shown as tabs; settings lives behind the header button. */
const TABS = ['simulator', 'brew', 'lab', 'journal', 'beans', 'gear', 'learn'] as const;
type Route = (typeof ROUTES)[number];

interface Location {
  route: Route;
  /** Remaining path segments, e.g. ['compare', idA, idB] for #/journal/compare/idA/idB. */
  path: string[];
}

const parseHash = (): Location => {
  const [head = '', ...path] = window.location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return (ROUTES as readonly string[]).includes(head) ? { route: head as Route, path } : { route: 'home', path: [] };
};

function useHashRoute(): Location {
  const [route, setRoute] = useState<Location>(parseHash);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const { route, path } = useHashRoute();
  const tabsRef = useRef<HTMLElement>(null);

  // The tab strip scrolls sideways on phones: keep the active tab in view.
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('a.is-active');
    if (!el || !tabsRef.current) return;
    const nav = tabsRef.current;
    nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [route]);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" aria-label={t('nav.home')}>
          <img src="/icon.svg" alt="" width={32} height={32} />
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </a>
        <div className="topbar__actions">
          <div className="segmented segmented--small" role="radiogroup" aria-label={t('app.language')}>
            {(['hu', 'en'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? 'is-active' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a
            href="#/settings"
            className={`icon-btn${route === 'settings' ? ' is-active' : ''}`}
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
            aria-current={route === 'settings' ? 'page' : undefined}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
                transform="translate(-1 0)"
              />
            </svg>
          </a>
        </div>
      </header>
      {route !== 'home' && (
      <nav className="tabs" aria-label="main" ref={tabsRef}>
        {TABS.map((r) => (
          <a key={r} href={`#/${r}`} className={route === r ? 'is-active' : ''} aria-current={route === r ? 'page' : undefined}>
            {t(`nav.${r}`)}
          </a>
        ))}
      </nav>
      )}
      <main>
        {route === 'home' && <Landing />}
        {route === 'lab' && (
          <Suspense fallback={<p className="help">{t('lab.loading')}</p>}>
            <Lab />
          </Suspense>
        )}
        {route === 'simulator' && <Simulator />}
        {route === 'brew' && <Brew />}
        {route === 'journal' && <Journal path={path} />}
        {route === 'gear' && <Gear />}
        {route === 'beans' && <Beans />}
        {route === 'settings' && <Settings />}
        {route === 'learn' && <Learn path={path} />}
      </main>
      <footer className="footer">{t('footer.phase')}</footer>
      <PwaToasts />
    </div>
  );
}
