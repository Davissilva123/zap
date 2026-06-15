import { useEffect, useState } from 'react';
import { Download, X, Zap } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const win = window as unknown as Record<string, unknown>;

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('zm_pwa_dismissed') === '1') return;

    // Evento já capturado globalmente em main.tsx antes do React montar
    if (win.__pwa_prompt) {
      setDeferredPrompt(win.__pwa_prompt as BeforeInstallPromptEvent);
      setVisible(true);
      return;
    }

    // Fallback: escuta o evento caso ainda não tenha disparado
    const handler = (e: Event) => {
      e.preventDefault();
      win.__pwa_prompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('zm_pwa_dismissed', '1');
      setVisible(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem('zm_pwa_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80 animate-slide-up">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 border border-slate-700">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow shadow-emerald-500/30">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Instalar ZapMenu</p>
          <p className="text-xs text-slate-400 mt-0.5">Acesso rápido na tela inicial</p>
        </div>
        <button
          onClick={install}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-colors flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Instalar
        </button>
        <button
          onClick={dismiss}
          className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
