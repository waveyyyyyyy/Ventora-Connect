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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
