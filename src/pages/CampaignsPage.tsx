import { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { CustomerRecord } from '../lib/types';
import { MessageCircle, Send, Users, Star, TrendingUp, AlertTriangle, XCircle, Loader2, CheckCircle2 } from 'lucide-react';

type Segment = 'all' | 'loyal' | 'active' | 'at_risk' | 'inactive';

const SEG_LABEL: Record<Segment, string> = {
  all: 'Todos os clientes', loyal: 'Clientes fieis', active: 'Clientes ativos',
  at_risk: 'Em risco de churn', inactive: 'Inativos',
};

const SEG_ICON: Record<Segment, typeof Users> = {
  all: Users, loyal: Star, active: TrendingUp, at_risk: AlertTriangle, inactive: XCircle,
};

const TEMPLATES = [
  { label: 'Promocao', text: 'Oi {nome}! Temos uma promocao especial so para voce hoje. Venha nos visitar!' },
  { label: 'Reativacao', text: 'Saudades, {nome}! Faz um tempo que voce nao faz um pedido. Temos novidades te esperando!' },
  { label: 'Fidelidade', text: '{nome}, voce e um dos nossos clientes mais especiais! Obrigado pela preferencia. Preparamos uma surpresa para voce.' },
  { label: 'Novidade', text: 'Oi {nome}! Novidade no cardapio! Venha conferir os novos itens que preparamos com muito carinho.' },
];

export default function CampaignsPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<Segment>('all');
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [step, setStep] = useState<'compose' | 'preview' | 'done'>('compose');

  useEffect(() => {
    if (!user) return;
    db.getCRMCustomers(user.id).then(data => { setCustomers(data); setLoading(false); });
  }, [user]);

  const targets = useMemo(() => {
    if (segment === 'all') return customers;
    return customers.filter(c => c.segment === segment);
  }, [customers, segment]);

  const preview = (name: string) => message.replace(/\{nome\}/g, name.split(' ')[0]);

  const sendAll = async () => {
    setSending(true);
    let count = 0;
    for (const c of targets) {
      const text = preview(c.name);
      const num = c.phone.replace(/\D/g, '');
      if (num.length >= 10) {
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
        count++;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    setSentCount(count);
    setStep('done');
    setSending(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Campanhas de WhatsApp</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Envie mensagens proativas para segmentos de clientes</p>
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : step === 'done' ? (
        <div className="card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">Campanha disparada!</p>
            <p className="text-slate-400 text-sm mt-1">{sentCount} janela{sentCount !== 1 ? 's' : ''} de WhatsApp aberta{sentCount !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { setStep('compose'); setSentCount(0); }} className="btn-primary mx-auto">
            Nova campanha
          </button>
        </div>
      ) : (
        <>
          {/* Segment select */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Selecione o publico-alvo</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SEG_LABEL) as Segment[]).map(seg => {
                const count = seg === 'all' ? customers.length : customers.filter(c => c.segment === seg).length;
                const Icon = SEG_ICON[seg];
                return (
                  <button key={seg} onClick={() => setSegment(seg)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${segment === seg ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}>
                    <div className="flex items-center gap-1.5 w-full">
                      <Icon className={`w-3.5 h-3.5 ${segment === seg ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-bold ${segment === seg ? 'text-emerald-700' : 'text-slate-600'}`}>{SEG_LABEL[seg]}</span>
                    </div>
                    <span className={`text-lg font-black ${segment === seg ? 'text-emerald-700' : 'text-slate-700'}`}>{count}</span>
                    <span className="text-xs text-slate-400">cliente{count !== 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-bold text-emerald-600">{targets.length}</span> cliente{targets.length !== 1 ? 's' : ''} ser{targets.length !== 1 ? 'ao' : 'a'} impactado{targets.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Message compose */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Compose a mensagem</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setMessage(t.text)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="input w-full resize-none"
                placeholder="Digite a mensagem... Use {nome} para personalizar."
              />
              <p className="text-xs text-slate-400 mt-1">Use <code className="bg-slate-100 px-1 rounded">{'{nome}'}</code> para incluir o primeiro nome do cliente</p>
            </div>
          </div>

          {/* Preview */}
          {targets.length > 0 && (
            <div className="card p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">3. Preview</p>
              <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-none px-4 py-3 max-w-xs text-sm text-slate-800 shadow-sm">
                {preview(targets[0]?.name ?? 'Cliente')}
              </div>
              <p className="text-xs text-slate-400">Para: {targets[0]?.name} ({targets[0]?.phone})</p>
            </div>
          )}

          {/* Info */}
          <div className="card p-4 bg-amber-50/60 border-amber-100">
            <p className="text-xs font-bold text-amber-800 mb-1">Como funciona o disparo</p>
            <p className="text-xs text-amber-700">O sistema abrira uma janela do WhatsApp Web para cada cliente com a mensagem pre-preenchida. Voce confirma o envio manualmente. Recomendamos no maximo 50 contatos por campanha.</p>
          </div>

          <div className="flex gap-3">
            {step === 'preview' && (
              <button onClick={() => setStep('compose')} className="btn-secondary flex-1">Voltar</button>
            )}
            {step === 'compose' ? (
              <button
                onClick={() => setStep('preview')}
                disabled={!message.trim() || targets.length === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Revisar campanha
              </button>
            ) : (
              <button
                onClick={sendAll}
                disabled={sending || targets.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? `Enviando...` : `Disparar para ${targets.length} cliente${targets.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
