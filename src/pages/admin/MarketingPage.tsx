import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { Save, Check, Loader2, Globe, MessageCircle, Mail, Phone, Type, AlignLeft, Building2, Clock } from 'lucide-react';

type Settings = {
  whatsappNumber: string;
  whatsappMessage: string;
  contactEmail: string;
  contactPhone: string;
  heroTitle: string;
  heroSubtitle: string;
  companyName: string;
  businessHours: string;
};

const DEFAULT: Settings = {
  whatsappNumber: '5511999999999',
  whatsappMessage: 'Olá! Tenho interesse em saber mais sobre o ZapMenu para meu restaurante. Pode me ajudar?',
  contactEmail: 'contato@zapmenu.com.br',
  contactPhone: '+55 (11) 99999-9999',
  heroTitle: 'Cardápio digital para o seu restaurante',
  heroSubtitle: 'Crie seu cardápio, gere QR Codes e receba pedidos com pagamento via PIX — tudo em um só lugar.',
  companyName: 'ZapMenu',
  businessHours: 'Segunda a sexta, das 9h às 18h. Suporte via WhatsApp.',
};

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Globe; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children}
    </div>
  );
}

export default function MarketingPage() {
  const [form, setForm] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    db.getMarketingSettings().then(s => {
      if (s) setForm(s);
    }).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await db.saveMarketingSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const whatsappPreview = `https://wa.me/${form.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(form.whatsappMessage)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Página de Marketing</h1>
        <p className="text-slate-500 text-sm mt-1">Edite as informações exibidas na página pública do ZapMenu.</p>
      </div>

      {/* Identidade */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identidade</p>

        <Field label="Nome da empresa" icon={Building2}>
          <input
            value={form.companyName}
            onChange={set('companyName')}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="ZapMenu"
          />
        </Field>

        <Field label="Título principal (hero)" icon={Type}>
          <input
            value={form.heroTitle}
            onChange={set('heroTitle')}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="Cardápio digital para o seu restaurante"
          />
        </Field>

        <Field label="Subtítulo (hero)" icon={AlignLeft}>
          <textarea
            value={form.heroSubtitle}
            onChange={set('heroSubtitle')}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            placeholder="Descrição breve do produto..."
          />
        </Field>
      </div>

      {/* Contato */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contato</p>

        <Field label="E-mail de contato" icon={Mail}>
          <input
            value={form.contactEmail}
            onChange={set('contactEmail')}
            type="email"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="contato@zapmenu.com.br"
          />
        </Field>

        <Field label="Telefone de exibição" icon={Phone}>
          <input
            value={form.contactPhone}
            onChange={set('contactPhone')}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="+55 (11) 99999-9999"
          />
          <p className="text-xs text-slate-400 mt-1">Exibido apenas como texto na seção de contato.</p>
        </Field>

        <Field label="Horário de atendimento" icon={Clock}>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, businessHours: '24 horas por dia, 7 dias por semana.' }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.businessHours === '24 horas por dia, 7 dias por semana.' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-500 hover:border-violet-400 hover:text-violet-600'}`}
              >
                🕐 24 horas / 7 dias
              </button>
              <span className="text-xs text-slate-400">ou preencha abaixo</span>
            </div>
            <input
              value={form.businessHours}
              onChange={set('businessHours')}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Ex: Segunda a sexta, das 9h às 18h. Suporte via WhatsApp."
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Texto exibido na seção de contato da página de marketing.</p>
        </Field>
      </div>

      {/* WhatsApp */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>

        <Field label="Número do WhatsApp" icon={MessageCircle}>
          <input
            value={form.whatsappNumber}
            onChange={set('whatsappNumber')}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="5511999999999"
          />
          <p className="text-xs text-slate-400 mt-1">Formato: código do país + DDD + número, sem espaços. Ex: <span className="font-mono">5511987654321</span></p>
        </Field>

        <Field label="Mensagem pré-preenchida" icon={MessageCircle}>
          <textarea
            value={form.whatsappMessage}
            onChange={set('whatsappMessage')}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            placeholder="Olá! Tenho interesse em saber mais..."
          />
        </Field>

        {/* Preview do link */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Preview do link gerado
          </p>
          <a
            href={whatsappPreview}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-green-700 break-all hover:underline font-mono"
          >
            {whatsappPreview}
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-8 py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60 ${saved ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-700'}`}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}
      </button>
    </div>
  );
}
