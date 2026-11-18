import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import { captureInstallPrompt } from './pwa';
import { SettingsProvider } from './settings';
import './styles.css';

captureInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>,
);
