import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { RestaurantSettings, PaymentMethod } from '../lib/types';
import { Save, Check, Store, QrCode, Palette, Link2, CreditCard, AlertTriangle, MessageCircle } from 'lucide-react';

const allPaymentMethods: PaymentMethod[] = ['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher'];

const accentColors = [
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Amarelo', value: '#ca8a04' },
  { name: 'Ciano', value: '#0891b2' },
  { name: 'Slate', value: '#475569' },
];

function SectionCard({ icon: Icon, title, description, children }: { icon: typeof Store; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<RestaurantSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    db.getSettings(user.id).then(s => { if (s) setForm({ ...s }); });
  }, [user]);

  if (!user || !form) return null;

  const save = async () => {
    const slug = form.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await db.updateSettings(user.id, { ...form, slug });
    setForm(f => ({ ...f!, slug }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Personalize seu cardápio digital</p>
      </div>

      <SectionCard icon={Store} title="Informações do restaurante">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f!, name: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Descrição</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f!, description: e.target.value }))} className="input-field resize-none" rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Endereço</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f!, address: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Telefone</label>
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f!, phone: e.target.value }))} className="input-field" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Link2} title="URL do cardápio" description="Endereço público do seu cardápio">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 whitespace-nowrap shrink-0">{window.location.origin}/m/</span>
            <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f!, slug: e.target.value }))} className="input-field" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Palette} title="Cor de destaque" description="Usada no cardápio público e QR Code">
        <div className="grid grid-cols-4 gap-2">
          {accentColors.map(c => (
            <button
              key={c.value}
              onClick={() => setForm(f => ({ ...f!, accentColor: c.value }))}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${form.accentColor === c.value ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
            >
              <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: c.value }} />
              <span className="text-[11px] font-semibold text-slate-700 truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Formas de pagamento" description="Selecione quais métodos estarão disponíveis">
        <div className="space-y-1.5">
          {allPaymentMethods.map(method => {
            const cfg = PAYMENT_METHOD_LABELS[method];
            const enabled = form.paymentMethods?.includes(method);
            return (
              <button
                key={method}
                onClick={() => {
                  const current = form.paymentMethods || [];
                  const updated = enabled ? current.filter(m => m !== method) : [...current, method];
                  setForm(f => ({ ...f!, paymentMethods: updated }));
                }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${enabled ? 'border-emerald-400/40 bg-emerald-50/40' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}
              >
                <span className="text-lg">{cfg.emoji}</span>
                <span className={`text-sm font-medium flex-1 ${enabled ? 'text-slate-900' : 'text-slate-500'}`}>{cfg.label}</span>
                <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
        {(!form.paymentMethods || form.paymentMethods.length === 0) && (
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 text-sm text-amber-700 border border-amber-100">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Nenhuma forma de pagamento selecionada. Os clientes não poderão finalizar pedidos.</span>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={QrCode} title="Pagamento via PIX (XGate)" description="Configure para aceitar pagamentos PIX">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">E-mail XGate</label>
            <input type="email" value={form.xgateEmail} onChange={e => setForm(f => ({ ...f!, xgateEmail: e.target.value }))} className="input-field" placeholder="conta@xgateglobal.com" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Senha XGate</label>
            <input type="password" value={form.xgatePassword} onChange={e => setForm(f => ({ ...f!, xgatePassword: e.target.value }))} className="input-field" placeholder="••••••••" />
          </div>
        </div>
        {!form.xgateEmail && (
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 text-sm text-amber-700 border border-amber-100">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Sem as credenciais XGate os clientes não poderão pagar via PIX. Cadastre-se em <a href="https://www.xgateglobal.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">xgateglobal.com</a>.</span>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={MessageCircle} title="Notificações WhatsApp" description="Envie atualizações de pedido automaticamente ao cliente">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Ativar notificações</span>
          <div
            onClick={() => setForm(f => ({ ...f!, whatsappEnabled: !f!.whatsappEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer ${form.whatsappEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.whatsappEnabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        {form.whatsappEnabled && (
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Token da API</label>
              <input type="password" value={form.whatsappApiToken} onChange={e => setForm(f => ({ ...f!, whatsappApiToken: e.target.value }))} className="input-field" placeholder="EAAx..." />
              <p className="text-[11px] text-slate-400 mt-1">Meta Business Suite → WhatsApp → Configuração da API</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Phone Number ID</label>
              <input type="text" value={form.whatsappPhoneNumberId} onChange={e => setForm(f => ({ ...f!, whatsappPhoneNumberId: e.target.value }))} className="input-field" placeholder="123456789012345" />
            </div>
          </div>
        )}
      </SectionCard>

      <button onClick={save} className={`btn-primary px-8 py-3 ${saved ? '!bg-emerald-600' : ''}`}>
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Salvo com sucesso!' : 'Salvar configurações'}
      </button>
    </div>
  );
}
