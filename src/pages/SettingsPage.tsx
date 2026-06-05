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

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<RestaurantSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const s = db.getSettings(user.id);
    if (s) setForm({ ...s });
  }, [user]);

  if (!user || !form) return null;

  const save = () => {
    const slug = form.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    db.updateSettings(user.id, { ...form, slug });
    setForm(f => ({ ...f, slug }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configurações</h1>
        <p className="text-slate-500 mt-1 text-sm">Personalize seu cardápio digital</p>
      </div>

      <div className="space-y-5">
        {/* Restaurant info */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-400" /> Informações do restaurante
          </h3>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field resize-none" rows={2} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Endereço</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Telefone</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" />
            </div>
          </div>
        </div>

        {/* XGate */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-400" /> Pagamento via PIX (XGate)
          </h3>
          <p className="text-sm text-slate-500 -mt-1">Configure suas credenciais da XGate para aceitar pagamentos PIX</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">E-mail XGate</label>
              <input type="email" value={form.xgateEmail} onChange={e => setForm(f => ({ ...f, xgateEmail: e.target.value }))} className="input-field" placeholder="conta@xgateglobal.com" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Senha XGate</label>
              <input type="password" value={form.xgatePassword} onChange={e => setForm(f => ({ ...f, xgatePassword: e.target.value }))} className="input-field" placeholder="Sua senha da XGate" />
            </div>
          </div>
          {!form.xgateEmail && (
            <div className="flex items-start gap-3 bg-amber-50/80 rounded-xl p-4 text-sm text-amber-700 border border-amber-100/80">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Sem as credenciais XGate, os clientes não poderão pagar via PIX. Cadastre-se em <a href="https://www.xgateglobal.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">xgateglobal.com</a>.</span>
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400" /> Formas de pagamento aceitas
          </h3>
          <p className="text-sm text-slate-500 -mt-1">Selecione quais métodos estarão disponíveis no cardápio</p>
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
                    setForm(f => ({ ...f, paymentMethods: updated }));
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${enabled ? 'border-emerald-500/40 bg-emerald-50/30' : 'border-transparent bg-slate-50/50 hover:bg-slate-50'}`}
                >
                  <span className="text-lg">{cfg.emoji}</span>
                  <span className={`text-sm font-medium flex-1 ${enabled ? 'text-slate-900' : 'text-slate-500'}`}>{cfg.label}</span>
                  <div className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>
          {(!form.paymentMethods || form.paymentMethods.length === 0) && (
            <div className="flex items-start gap-3 bg-amber-50/80 rounded-xl p-4 text-sm text-amber-700 border border-amber-100/80">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Nenhuma forma de pagamento selecionada. Os clientes não poderão finalizar pedidos.</span>
            </div>
          )}
        </div>

        {/* WhatsApp notifications */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-400" /> Notificações WhatsApp
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, whatsappEnabled: !f.whatsappEnabled }))}
                className={`w-10 h-6 rounded-full transition-colors duration-200 flex items-center ${form.whatsappEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.whatsappEnabled ? 'translate-x-4' : ''}`} />
              </div>
              <input type="checkbox" checked={form.whatsappEnabled} onChange={e => setForm(f => ({ ...f, whatsappEnabled: e.target.checked }))} className="sr-only" />
              <span className="text-sm font-medium text-slate-600">{form.whatsappEnabled ? 'Ativo' : 'Inativo'}</span>
            </label>
          </div>
          <p className="text-sm text-slate-500 -mt-1">Envie atualizações de pedido automaticamente via WhatsApp para o cliente</p>

          {form.whatsappEnabled && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Token da API (Access Token)</label>
                <input type="password" value={form.whatsappApiToken} onChange={e => setForm(f => ({ ...f, whatsappApiToken: e.target.value }))} className="input-field" placeholder="EAAx..." />
                <p className="text-[11px] text-slate-400 mt-1">Gerado no Meta Business Suite &gt; WhatsApp &gt; Configuração da API</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Phone Number ID</label>
                <input type="text" value={form.whatsappPhoneNumberId} onChange={e => setForm(f => ({ ...f, whatsappPhoneNumberId: e.target.value }))} className="input-field" placeholder="123456789012345" />
                <p className="text-[11px] text-slate-400 mt-1">ID do número de telefone do WhatsApp Business</p>
              </div>
              {(!form.whatsappApiToken || !form.whatsappPhoneNumberId) && (
                <div className="flex items-start gap-3 bg-amber-50/80 rounded-xl p-4 text-sm text-amber-700 border border-amber-100/80">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Preencha o Token e Phone Number ID para enviar notificações. Configure em <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Meta Business Suite</a>.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* URL slug */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-400" /> URL do cardápio
          </h3>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Slug (parte da URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 whitespace-nowrap">{window.location.origin}/m/</span>
              <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="input-field" />
            </div>
          </div>
        </div>

        {/* Accent color */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-[15px] flex items-center gap-2">
            <Palette className="w-4 h-4 text-slate-400" /> Cor de destaque
          </h3>
          <p className="text-sm text-slate-500 -mt-1">Cor usada no cardápio público e QR Code</p>
          <div className="grid grid-cols-4 gap-2.5">
            {accentColors.map(c => (
              <button
                key={c.value}
                onClick={() => setForm(f => ({ ...f, accentColor: c.value }))}
                className={`relative flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${form.accentColor === c.value ? 'border-slate-300 shadow-sm bg-white' : 'border-transparent hover:bg-slate-50'}`}
              >
                <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: c.value }} />
                <span className="text-[11px] font-semibold text-slate-700">{c.name}</span>
                {form.accentColor === c.value && <Check className="w-3.5 h-3.5 text-slate-400 absolute top-1.5 right-1.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={save} className={`btn-primary px-8 ${saved ? 'bg-emerald-500' : ''}`}>
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
