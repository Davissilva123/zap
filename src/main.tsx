import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
