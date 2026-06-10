import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { Save, Check, Loader2, Globe, MessageCircle, Mail, Phone, Type, AlignLeft, Building2, Clock, Instagram, Twitter, Facebook, Link, Search, Star, Plus, Trash2, Image } from 'lucide-react';

type Settings = {
  whatsappNumber: string;
  whatsappMessage: string;
  contactEmail: string;
  contactPhone: string;
  heroTitle: string;
  heroSubtitle: string;
  companyName: string;
  businessHours: string;
  instagramUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  seoDescription: string;
  seoKeywords: string;
  logoUrl: string;
  features: string[];
};

const DEFAULT: Settings = {
  whatsappNumber: '5511999999999',
  whatsappMessage: 'Ola! Tenho interesse em saber mais sobre o ZapMenu para meu restaurante. Pode me ajudar?',
  contactEmail: 'contato@zapmenu.com.br',
  contactPhone: '+55 (11) 99999-9999',
  heroTitle: 'Cardapio digital para o seu restaurante',
  heroSubtitle: 'Crie seu cardapio, gere QR Codes e receba pedidos com pagamento via PIX — tudo em um so lugar.',
  companyName: 'ZapMenu',
  businessHours: 'Segunda a sexta, das 9h as 18h. Suporte via WhatsApp.',
  instagramUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  websiteUrl: '',
  seoDescription: 'ZapMenu — cardapio digital com QR Code, pedidos online e pagamento via PIX para restaurantes.',
  seoKeywords: 'cardapio digital, qr code restaurante, pedidos online, sistema para restaurante',
  logoUrl: '',
  features: [
    'Cardapio digital com QR Code',
    'Pedidos online em tempo real',
    'Pagamento via PIX integrado',
    'Relatorios e analytics',
    'Suporte via WhatsApp',
  ],
};

function Field({ label, icon: Icon, children, hint }: { label: string; icon: typeof Globe; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

export default function MarketingPage() {
  const [form, setForm] = useState<Settings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => {
    db.getMarketingSettings().then(s => {
      if (s) {
        setForm({
          ...DEFAULT,
          ...s,
          instagramUrl: (s as any).instagramUrl ?? '',
          facebookUrl: (s as any).facebookUrl ?? '',
          twitterUrl: (s as any).twitterUrl ?? '',
          websiteUrl: (s as any).websiteUrl ?? '',
          seoDescription: (s as any).seoDescription ?? DEFAULT.seoDescription,
          seoKeywords: (s as any).seoKeywords ?? DEFAULT.seoKeywords,
          logoUrl: (s as any).logoUrl ?? '',
          features: (s as any).features ?? DEFAULT.features,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const addFeature = () => {
    if (!newFeature.trim() || form.features.length >= 8) return;
    setForm(f => ({ ...f, features: [...f.features, newFeature.trim()] }));
    setNewFeature('');
  };

  const removeFeature = (idx: number) => {
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await db.saveMarketingSettings(form as any);
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
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pagina de Marketing</h1>
        <p className="text-slate-500 text-sm mt-1">Edite as informacoes exibidas na pagina publica do ZapMenu.</p>
      </div>

      {/* Identidade */}
      <Section title="Identidade">
        <Field label="Nome da empresa" icon={Building2}>
          <input value={form.companyName} onChange={set('companyName')} className={inputCls} placeholder="ZapMenu" />
        </Field>

        <Field label="Logo (URL da imagem)" icon={Image}>
          <input value={form.logoUrl} onChange={set('logoUrl')} className={inputCls} placeholder="https://..." />
          {form.logoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img src={form.logoUrl} alt="Logo preview" className="w-10 h-10 rounded-xl object-cover border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-xs text-slate-400">Preview</span>
            </div>
          )}
        </Field>

        <Field label="Titulo principal (hero)" icon={Type}>
          <input value={form.heroTitle} onChange={set('heroTitle')} className={inputCls} placeholder="Cardapio digital para o seu restaurante" />
        </Field>

        <Field label="Subtitulo (hero)" icon={AlignLeft}>
          <textarea value={form.heroSubtitle} onChange={set('heroSubtitle')} rows={3} className={`${inputCls} resize-none`} placeholder="Descricao breve do produto..." />
        </Field>
      </Section>

      {/* SEO */}
      <Section title="SEO e mecanismos de busca">
        <Field label="Meta descricao" icon={Search} hint="Exibida nos resultados do Google. Ideal: 120-160 caracteres.">
          <textarea
            value={form.seoDescription}
            onChange={set('seoDescription')}
            rows={3}
            maxLength={200}
            className={`${inputCls} resize-none`}
            placeholder="ZapMenu — cardapio digital com QR Code..."
          />
          <p className="text-[11px] text-slate-400 mt-1 text-right">{form.seoDescription.length}/200</p>
        </Field>

        <Field label="Palavras-chave (keywords)" icon={Search} hint="Separadas por virgula. Ex: cardapio digital, qr code restaurante">
          <input value={form.seoKeywords} onChange={set('seoKeywords')} className={inputCls} placeholder="cardapio digital, qr code restaurante, pedidos online" />
        </Field>
      </Section>

      {/* Diferenciais */}
      <Section title="Diferenciais do produto">
        <p className="text-xs text-slate-400 -mt-2">Ate 8 itens exibidos como bullets na landing page.</p>
        <div className="space-y-2">
          {form.features.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 group">
              <Star className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-slate-700">{feat}</span>
              <button onClick={() => removeFeature(idx)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {form.features.length < 8 && (
          <div className="flex gap-2 mt-2">
            <input
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFeature(); }}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Novo diferencial..."
            />
            <button onClick={addFeature} disabled={!newFeature.trim()} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </Section>

      {/* Contato */}
      <Section title="Contato">
        <Field label="E-mail de contato" icon={Mail}>
          <input value={form.contactEmail} onChange={set('contactEmail')} type="email" className={inputCls} placeholder="contato@zapmenu.com.br" />
        </Field>

        <Field label="Telefone de exibicao" icon={Phone} hint="Exibido apenas como texto na secao de contato.">
          <input value={form.contactPhone} onChange={set('contactPhone')} className={inputCls} placeholder="+55 (11) 99999-9999" />
        </Field>

        <Field label="Horario de atendimento" icon={Clock}>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, businessHours: '24 horas por dia, 7 dias por semana.' }))}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.businessHours === '24 horas por dia, 7 dias por semana.' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-500 hover:border-violet-400 hover:text-violet-600'}`}
              >
                24h / 7 dias
              </button>
              <span className="text-xs text-slate-400">ou preencha abaixo</span>
            </div>
            <input value={form.businessHours} onChange={set('businessHours')} className={inputCls} placeholder="Ex: Segunda a sexta, das 9h as 18h." />
          </div>
        </Field>
      </Section>

      {/* Redes sociais */}
      <Section title="Redes sociais">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Instagram" icon={Instagram}>
            <input value={form.instagramUrl} onChange={set('instagramUrl')} className={inputCls} placeholder="https://instagram.com/zapmenu" />
          </Field>

          <Field label="Facebook" icon={Facebook}>
            <input value={form.facebookUrl} onChange={set('facebookUrl')} className={inputCls} placeholder="https://facebook.com/zapmenu" />
          </Field>

          <Field label="Twitter / X" icon={Twitter}>
            <input value={form.twitterUrl} onChange={set('twitterUrl')} className={inputCls} placeholder="https://twitter.com/zapmenu" />
          </Field>

          <Field label="Site / outro link" icon={Link}>
            <input value={form.websiteUrl} onChange={set('websiteUrl')} className={inputCls} placeholder="https://zapmenu.com.br" />
          </Field>
        </div>
      </Section>

      {/* WhatsApp */}
      <Section title="WhatsApp">
        <Field label="Numero do WhatsApp" icon={MessageCircle} hint="Formato: codigo do pais + DDD + numero. Ex: 5511987654321">
          <input value={form.whatsappNumber} onChange={set('whatsappNumber')} className={`${inputCls} font-mono`} placeholder="5511999999999" />
        </Field>

        <Field label="Mensagem pre-preenchida" icon={MessageCircle}>
          <textarea value={form.whatsappMessage} onChange={set('whatsappMessage')} rows={3} className={`${inputCls} resize-none`} placeholder="Ola! Tenho interesse em saber mais..." />
        </Field>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Preview do link gerado
          </p>
          <a href={whatsappPreview} target="_blank" rel="noreferrer" className="text-xs text-green-700 break-all hover:underline font-mono">
            {whatsappPreview}
          </a>
        </div>
      </Section>

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
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alteracoes'}
      </button>
    </div>
  );
}
