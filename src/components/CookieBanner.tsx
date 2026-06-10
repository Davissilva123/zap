import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';

const STORAGE_KEY = 'zm_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setTimeout(() => setVisible(true), 1500);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-fade-in">
        <div className="bg-slate-900 rounded-2xl p-5 shadow-2xl border border-white/10">
          <div className="flex items-start gap-3 mb-4">
            <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-bold text-sm">Privacidade e Cookies</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Usamos cookies essenciais para o funcionamento do site e cookies de analise para melhorar sua experiencia. Conforme a{' '}
                <button onClick={() => setShowPolicy(true)} className="text-emerald-400 hover:underline">LGPD</button>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={decline} className="flex-1 py-2 rounded-xl text-slate-400 text-xs font-semibold border border-white/10 hover:bg-white/5 transition-colors">
              Recusar
            </button>
            <button onClick={accept} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors">
              Aceitar todos
            </button>
          </div>
        </div>
      </div>

      {/* Privacy policy modal */}
      {showPolicy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="font-bold text-slate-900">Politica de Privacidade</p>
              <button onClick={() => setShowPolicy(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm text-slate-600 max-h-96 overflow-y-auto leading-relaxed">
              <p><strong>ZapMenu</strong> esta comprometido com a protecao dos seus dados pessoais, em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei 13.709/2018).</p>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Dados coletados</p>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Nome e telefone para finalizacao de pedidos</li>
                  <li>E-mail para criacao de conta e comunicacoes</li>
                  <li>Endereco para entregas (quando aplicavel)</li>
                  <li>Dados de navegacao via cookies essenciais</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Finalidade</p>
                <p className="text-slate-500">Os dados sao utilizados exclusivamente para processamento de pedidos, comunicacao com o restaurante e melhoria do servico.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Seus direitos (LGPD art. 18)</p>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Acesso aos dados pessoais</li>
                  <li>Correcao de dados incompletos ou incorretos</li>
                  <li>Exclusao dos dados pessoais</li>
                  <li>Portabilidade dos dados</li>
                  <li>Revogacao do consentimento</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Contato do DPO</p>
                <p className="text-slate-500">Para exercer seus direitos ou obter mais informacoes, entre em contato pelo WhatsApp disponivel na pagina inicial.</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setShowPolicy(false)} className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
