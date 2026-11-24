import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './ventora-experience.css';
import './gust-platform.css';
import './ventora-loader.css';
import './signed-in-refresh.css';
import './ventora-performance.css';
import './ventora-audit-fixes.css';
import './ventora-responsive-qa-fixes.css';
import './ventora-contrast-qa-fixes.css';
import './ventora-readable-type.css';
import './ventora-overview-readable.css';
import './ventora-overview-topbar-readable.css';
import './ventora-home-microcopy-readable.css';
import './ventora-wordmark-readable.css';
import './ventora-public-microcopy-readable.css';
import './ventora-directory-card-readable.css';
import './ventora-faq-index-readable.css';
import './ventora-desktop-microcopy-readable.css';
import './ventora-messages-readable.css';
import './ventora-universal-readable-pass.css';
import './ventora-full-surface-quality.css';
import './ventora-home-readable-overrides.css';
import './ventora-signed-in-readable-polish.css';
import './ventora-mobile-edge-polish.css';
import './ventora-public-readable-polish.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
