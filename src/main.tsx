import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  // Force page reload when new SW takes control so users always get latest version
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

// Auto-reload when chunk fails to load after a new deploy (stale hashes)
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message ?? '');
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    event.preventDefault();
    window.location.reload();
  }
});

// Captura beforeinstallprompt antes do React montar para evitar race condition
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as Record<string, unknown>).__pwa_prompt = e;
});

const root = document.getElementById('root')!;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  root.innerHTML = `<div style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;color:#dc2626">
    <strong>Configuração incompleta</strong>
    <p style="margin:0;font-size:14px;color:#64748b">Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas.</p>
  </div>`;
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
