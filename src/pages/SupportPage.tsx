import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, ChevronDown, ChevronUp, HelpCircle, Zap } from 'lucide-react';
import { db } from '../lib/db';

const FALLBACK_WA_NUMBER = import.meta.env.VITE_WHATSAPP_CONTACT ?? '5511999999999';

const faqs = [
  {
    q: 'Como adiciono itens ao meu cardápio?',
    a: 'Acesse o painel → Cardápio → clique em "Adicionar item". Preencha nome, preço, categoria e foto opcional. O item aparece instantaneamente no cardápio público.',
  },
  {
    q: 'Como funciona o período de teste gratuito?',
    a: 'Você tem acesso completo à plataforma durante o trial sem precisar cadastrar cartão. Ao final, escolha um plano para continuar usando.',
  },
  {
    q: 'Como configuro o pagamento via PIX?',
    a: 'Acesse Configurações → Pagamentos. Insira seu token do Mercado Pago. O PIX será gerado automaticamente em cada pedido do cliente.',
  },
  {
    q: 'Posso cancelar a assinatura a qualquer momento?',
    a: 'Sim. Acesse Configurações → Assinatura → Cancelar. Você continua com acesso até o fim do período pago, sem multas ou fidelidade.',
  },
  {
    q: 'Como cadastro operadores (garçons, caixa, cozinha)?',
    a: 'Acesse Operadores no menu lateral → Adicionar operador. Insira o e-mail, nome e função. O operador recebe acesso com permissões do papel escolhido.',
  },
  {
    q: 'O cardápio funciona sem instalar aplicativo?',
    a: 'Sim. Seus clientes acessam pelo navegador do celular ao escanear o QR Code. Não é necessário baixar nenhum app.',
  },
  {
    q: 'Como recebo pedidos pelo WhatsApp?',
    a: 'Acesse Configurações → WhatsApp. Você precisará de uma instância Evolution API ou Meta Cloud API. Siga o passo a passo na tela de configurações.',
  },
  {
    q: 'Posso ter filiais de um mesmo restaurante?',
    a: 'Sim, nos planos Pro ou Premium você pode cadastrar filiais com cardápios e configurações separadas na seção Filiais.',
  },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [waNumber, setWaNumber] = useState(FALLBACK_WA_NUMBER);
  const [contactEmail, setContactEmail] = useState('suporte@zapmenu.com.br');

  useEffect(() => {
    db.getMarketingSettings().then(s => {
      if (!s) return;
      if (s.whatsappNumber) setWaNumber(s.whatsappNumber);
      if (s.contactEmail) setContactEmail(s.contactEmail);
    }).catch(() => {});
  }, []);

  const waLink = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Preciso de ajuda com o ZapMenu.')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Central de Ajuda</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Como podemos ajudar?</h1>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            Estamos disponíveis para tirar dúvidas e garantir que seu restaurante funcione perfeitamente.
          </p>
        </div>

        {/* Canais de contato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-5 bg-[#25D366] hover:bg-[#20bd5a] rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-green-500/20"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-base">WhatsApp</p>
              <p className="text-white/80 text-sm">Resposta em minutos</p>
            </div>
          </a>

          <a
            href={`mailto:${contactEmail}`}
            className="flex items-center gap-4 p-5 bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md rounded-2xl transition-all hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-base">E-mail</p>
              <p className="text-slate-500 text-sm truncate">{contactEmail}</p>
            </div>
          </a>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">Perguntas frequentes</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm leading-snug">{faq.q}</span>
                  {openIdx === i
                    ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  }
                </button>
                {openIdx === i && (
                  <div className="px-4 pb-4 border-t border-slate-50">
                    <p className="pt-3 text-slate-600 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA inferior */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
          <p className="font-bold text-slate-900 mb-1">Não encontrou sua resposta?</p>
          <p className="text-slate-500 text-sm mb-4">Nossa equipe responde em minutos pelo WhatsApp.</p>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-sm transition-all"
          >
            <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
          </a>
        </div>

        {/* Links legais */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pb-4">
          <button onClick={() => navigate('/privacidade')} className="hover:text-slate-600 transition-colors">
            Política de Privacidade
          </button>
          <span>·</span>
          <button onClick={() => navigate('/termos')} className="hover:text-slate-600 transition-colors">
            Termos de Uso
          </button>
        </div>
      </div>
    </div>
  );
}
