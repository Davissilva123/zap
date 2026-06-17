import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { uploadImage } from '../lib/upload';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { RestaurantSettings, PaymentMethod } from '../lib/types';
import { Save, Check, Store, QrCode, Palette, Link2, CreditCard, AlertTriangle, MessageCircle, ImagePlus, Loader2, X, Clock, Truck, Plus, Trash2, Gift, Crown, XCircle, ExternalLink, Globe, Shield, Copy, Users, Printer } from 'lucide-react';
import { maskPhone, parseCurrency, numToCurrency } from '../lib/masks';
import { useNavigate } from 'react-router-dom';
import type { DayHours } from '../lib/types';

const allPaymentMethods: PaymentMethod[] = ['pix', 'credit_card', 'debit_card', 'cash', 'meal_voucher', 'food_voucher', 'picpay', 'bank_transfer', 'payment_link'];

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

function ImageUploadField({ label, preview, onFileChange, onRemove, inputRef, hint }: {
  label: string; preview: string; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void; inputRef: React.RefObject<HTMLInputElement>; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      {preview ? (
        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-100">
          <img src={preview} alt={label} className="w-full h-full object-cover" />
          <button type="button" onClick={onRemove} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors">
          <ImagePlus className="w-5 h-5" />
          <span className="text-[13px] font-medium">Clique para adicionar</span>
        </button>
      )}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RestaurantSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Plano
  const [plan, setPlan] = useState<{ planName: string; status: string; nextBillingAt: string | null; daysRemaining: number } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    db.getSettings(user.id).then(s => {
      if (s) {
        setForm({ ...s });
        setLogoPreview(s.logoUrl || '');
        setCoverPreview(s.coverUrl || '');
      }
    });
    db.getMyPlan().then(p => {
      if (p) setPlan({ planName: p.planName, status: p.status, nextBillingAt: p.nextBillingAt, daysRemaining: p.daysRemaining });
    }).catch(() => {});
  }, [user]);

  if (!user || !form) return null;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true);
    try {
      const slug = form.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      let logoUrl = form.logoUrl;
      let coverUrl = form.coverUrl;
      if (logoFile) { const u = await uploadImage(logoFile, 'logos'); if (u) logoUrl = u; }
      if (coverFile) { const u = await uploadImage(coverFile, 'covers'); if (u) coverUrl = u; }
      await db.updateSettings(user.id, { ...form, slug, logoUrl, coverUrl });
      setForm(f => ({ ...f!, slug, logoUrl, coverUrl }));
      setLogoFile(null);
      setCoverFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
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
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f!, phone: maskPhone(e.target.value) }))} className="input-field" placeholder="(11) 99999-9999" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={ImagePlus} title="Imagens do restaurante" description="Logo e imagem de capa exibidos no cardápio público">
        <div className="grid sm:grid-cols-2 gap-5">
          <ImageUploadField
            label="Logo"
            preview={logoPreview}
            onFileChange={handleLogoChange}
            onRemove={() => { setLogoFile(null); setLogoPreview(''); setForm(f => ({ ...f!, logoUrl: '' })); if (logoInputRef.current) logoInputRef.current.value = ''; }}
            inputRef={logoInputRef}
            hint="Aparece no topo do cardápio (quadrado, mín. 200×200px)"
          />
          <ImageUploadField
            label="Imagem de capa"
            preview={coverPreview}
            onFileChange={handleCoverChange}
            onRemove={() => { setCoverFile(null); setCoverPreview(''); setForm(f => ({ ...f!, coverUrl: '' })); if (coverInputRef.current) coverInputRef.current.value = ''; }}
            inputRef={coverInputRef}
            hint="Banner do hero no topo do cardápio (16:9 recomendado)"
          />
        </div>
      </SectionCard>

      <SectionCard icon={Link2} title="URL do cardápio" description="Endereço público do seu cardápio">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Slug</label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0 truncate max-w-full">{window.location.origin}/m/</span>
            <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f!, slug: e.target.value }))} className="input-field w-full" />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Palette} title="Cor de destaque" description="Usada no cardápio público e QR Code">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {accentColors.map(c => (
            <button
              key={c.value}
              onClick={() => setForm(f => ({ ...f!, accentColor: c.value }))}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${form.accentColor === c.value ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
            >
              <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: c.value }} />
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 truncate">{c.name}</span>
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
            <span>Sem as credenciais XGate os clientes não poderão pagar via PIX.</span>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={QrCode} title="PIX via Mercado Pago (opcional)" description="Alternativa ao XGate — requer Edge Function deployada no Supabase">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Access Token Mercado Pago</label>
          <input type="password" value={form.mercadoPagoToken ?? ''} onChange={e => setForm(f => ({ ...f!, mercadoPagoToken: e.target.value }))} className="input-field" placeholder="APP_USR-..." />
          <p className="text-xs text-slate-400 mt-1.5">Obtenha em developers.mercadopago.com → Credenciais de produção</p>
        </div>
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

      {/* Horário de funcionamento */}
      <SectionCard icon={Clock} title="Horário de funcionamento" description="Defina os dias e horários em que o restaurante está aberto">
        {(['0','1','2','3','4','5','6'] as const).map(day => {
          const labels = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
          const hours: DayHours = form.openingHours?.[day] ?? { open: false, from: '09:00', to: '22:00' };
          const setDay = (h: DayHours) => setForm(f => ({ ...f!, openingHours: { ...f!.openingHours, [day]: h } }));
          return (
            <div key={day} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div
                onClick={() => setDay({ ...hours, open: !hours.open })}
                className={`w-10 h-5 rounded-full flex items-center cursor-pointer flex-shrink-0 transition-colors ${hours.open ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-transform ${hours.open ? 'translate-x-5' : ''}`} />
              </div>
              <span className={`text-sm w-16 sm:w-20 flex-shrink-0 ${hours.open ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{labels[Number(day)]}</span>
              {hours.open ? (
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <input type="time" value={hours.from} onChange={e => setDay({ ...hours, from: e.target.value })}
                    className="input-field py-1.5 text-sm flex-1" />
                  <span className="text-slate-400 text-sm flex-shrink-0">até</span>
                  <input type="time" value={hours.to} onChange={e => setDay({ ...hours, to: e.target.value })}
                    className="input-field py-1.5 text-sm flex-1" />
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Fechado</span>
              )}
            </div>
          );
        })}
      </SectionCard>

      {/* Entrega */}
      <SectionCard icon={Truck} title="Configurações de entrega" description="Tempo estimado e taxas por bairro">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tempo estimado de entrega</label>
          <div className="flex items-center gap-2">
            <input type="text" value={form.deliveryTime} onChange={e => setForm(f => ({ ...f!, deliveryTime: e.target.value }))}
              className="input-field w-32" placeholder="30-45" />
            <span className="text-sm text-slate-500">minutos</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ex: "30-45" ou "50" ou "1h"</p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Frete grátis para todos</span>
            <p className="text-xs text-slate-400 mt-0.5">Quando ativado, todos os clientes recebem entrega gratuita</p>
          </div>
          <div
            onClick={() => setForm(f => ({ ...f!, freeShippingEnabled: !f!.freeShippingEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0 ${form.freeShippingEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.freeShippingEnabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>

        <div className={`grid sm:grid-cols-2 gap-4 ${form.freeShippingEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Taxa de entrega padrão (R$)</label>
            <input type="text" inputMode="numeric" value={numToCurrency(form.deliveryFee)}
              onChange={e => setForm(f => ({ ...f!, deliveryFee: parseCurrency(e.target.value) }))}
              className="input-field" placeholder="R$ 0,00" />
            <p className="text-[11px] text-slate-400 mt-1">Usada quando nenhum bairro abaixo bater</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Pedido mínimo para delivery (R$)</label>
            <input type="text" inputMode="numeric" value={numToCurrency(form.minimumOrder ?? 0)}
              onChange={e => setForm(f => ({ ...f!, minimumOrder: parseCurrency(e.target.value) }))}
              className="input-field" placeholder="R$ 0,00" />
            <p className="text-[11px] text-slate-400 mt-1">0 = sem valor mínimo</p>
          </div>
        </div>

        <div className={form.freeShippingEnabled ? 'opacity-40 pointer-events-none' : ''}>
          <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Taxas por bairro <span className="normal-case font-normal text-slate-400">(taxa 0 = frete grátis nesse bairro)</span></label>
          <div className="space-y-2">
            {(form.deliveryNeighborhoods || []).map((nb, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={nb.name}
                  onChange={e => {
                    const arr = [...form.deliveryNeighborhoods];
                    arr[i] = { ...arr[i], name: e.target.value };
                    setForm(f => ({ ...f!, deliveryNeighborhoods: arr }));
                  }}
                  className="input-field flex-1 py-1.5 text-sm" placeholder="Nome do bairro"
                />
                <input
                  type="text" inputMode="numeric" value={numToCurrency(nb.fee)}
                  onChange={e => {
                    const arr = [...form.deliveryNeighborhoods];
                    arr[i] = { ...arr[i], fee: parseCurrency(e.target.value) };
                    setForm(f => ({ ...f!, deliveryNeighborhoods: arr }));
                  }}
                  className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-emerald-400 text-center"
                  placeholder="R$ 0,00"
                />
                {nb.fee === 0 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Grátis</span>}
                <button onClick={() => setForm(f => ({ ...f!, deliveryNeighborhoods: f!.deliveryNeighborhoods.filter((_, j) => j !== i) }))}
                  className="p-1.5 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setForm(f => ({ ...f!, deliveryNeighborhoods: [...(f!.deliveryNeighborhoods || []), { name: '', fee: 0 }] }))}
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-1"
            >
              <Plus className="w-4 h-4" /> Adicionar bairro
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Fidelidade */}
      <SectionCard icon={Gift} title="Programa de fidelidade" description="Recompense clientes frequentes automaticamente">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Ativar programa de fidelidade</span>
          <div
            onClick={() => setForm(f => ({ ...f!, loyaltyEnabled: !f!.loyaltyEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer ${form.loyaltyEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.loyaltyEnabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        {form.loyaltyEnabled && (
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Pedidos necessários para ganhar recompensa</label>
              <input
                type="number" min={2} max={100} value={form.loyaltyOrdersNeeded}
                onChange={e => setForm(f => ({ ...f!, loyaltyOrdersNeeded: Number(e.target.value) }))}
                className="input-field w-32"
              />
              <p className="text-[11px] text-slate-400 mt-1">Ex: 10 = a cada 10 pedidos o cliente ganha a recompensa</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Descrição da recompensa</label>
              <input
                type="text" value={form.loyaltyReward}
                onChange={e => setForm(f => ({ ...f!, loyaltyReward: e.target.value }))}
                className="input-field" placeholder="Ex: Hambúrguer grátis, 20% de desconto..."
              />
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Cashback (% do pedido)</label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={50} step={0.5}
                value={form.cashbackPercent ?? 0}
                onChange={e => setForm(f => ({ ...f!, cashbackPercent: Number(e.target.value) }))}
                className="input-field w-28"
                placeholder="0"
              />
              <span className="text-sm text-slate-500">% do total de cada pedido concluído</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">0 = cashback desativado. O saldo acumulado é exibido no portal do cliente.</p>
          </div>
          {(form.cashbackPercent ?? 0) > 0 && (
            <div className="flex items-start justify-between gap-4 pt-2 border-t border-slate-100">
              <div>
                <span className="text-sm font-medium text-slate-700">Permitir resgate pelo cliente</span>
                <p className="text-xs text-slate-400 mt-0.5">O cliente aplica o cashback como desconto direto no checkout, sem precisar entrar em contato</p>
              </div>
              <div
                onClick={() => setForm(f => ({ ...f!, cashbackEnabled: !f!.cashbackEnabled }))}
                className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0 ${form.cashbackEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.cashbackEnabled ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Cardápio público */}
      <SectionCard icon={Link2} title="Cardápio público" description="Comportamento do cardápio exibido para os clientes">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Ocultar itens esgotados</span>
            <p className="text-xs text-slate-400 mt-0.5">Itens com estoque zerado não aparecem no cardápio público. Quando desativado, aparecem marcados como "Esgotado"</p>
          </div>
          <div
            onClick={() => setForm(f => ({ ...f!, hideOutOfStock: !f!.hideOutOfStock }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0 ${form.hideOutOfStock ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.hideOutOfStock ? 'translate-x-5' : ''}`} />
          </div>
        </div>
      </SectionCard>

      {/* Impressão automática */}
      <SectionCard icon={Printer} title="Impressão automática" description="Imprimir cupom automaticamente quando chegar um novo pedido">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Imprimir pedidos automaticamente</span>
            <p className="text-xs text-slate-400 mt-0.5">Quando ativado, cada novo pedido é impresso automaticamente na impressora padrão do computador</p>
          </div>
          <div
            onClick={() => setForm(f => ({ ...f!, autoPrint: !f!.autoPrint }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0 ${form.autoPrint ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.autoPrint ? 'translate-x-5' : ''}`} />
          </div>
        </div>
        {form.autoPrint && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 space-y-1.5">
            <p className="font-bold">Para imprimir sem abrir o diálogo do navegador:</p>
            <p>1. Feche o Chrome</p>
            <p>2. Crie um atalho do Chrome com o parâmetro: <span className="font-mono bg-blue-100 px-1 rounded">--kiosk-printing</span></p>
            <p>3. Certifique-se que a impressora térmica está configurada como <strong>impressora padrão</strong> no Windows</p>
            <p className="text-blue-500 mt-1">Dica: clique com o botão direito na área de trabalho → Novo → Atalho → cole o caminho do Chrome com a flag</p>
          </div>
        )}
      </SectionCard>

      {/* Permissões da equipe */}
      <SectionCard icon={Users} title="Permissões da equipe" description="Controle o que cada membro pode fazer no sistema">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-medium text-slate-700">Garçom pode dar desconto na comanda</span>
            <p className="text-xs text-slate-400 mt-0.5">Quando ativado, o garçom vê o botão de desconto ao visualizar as comandas das mesas</p>
          </div>
          <div
            onClick={() => setForm(f => ({ ...f!, waiterDiscountEnabled: !f!.waiterDiscountEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center cursor-pointer flex-shrink-0 ${form.waiterDiscountEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.waiterDiscountEnabled ? 'translate-x-5' : ''}`} />
          </div>
        </div>
      </SectionCard>

      <button onClick={save} disabled={saving} className={`btn-primary px-8 py-3 disabled:opacity-60 ${saved ? '!bg-emerald-600' : ''}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo com sucesso!' : 'Salvar configurações'}
      </button>

      {/* Seção Meu Plano */}
      {plan && (
        <SectionCard icon={Crown} title="Meu Plano" description="Informações da sua assinatura">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Plano atual</p>
              <p className="font-bold text-slate-900 text-base capitalize">{plan.planName}</p>
              <p className={`text-xs font-semibold mt-0.5 ${plan.status === 'active' ? 'text-emerald-600' : plan.status === 'trial' ? 'text-amber-600' : 'text-red-600'}`}>
                {plan.status === 'active' ? 'Ativo' : plan.status === 'trial' ? 'Período de teste' : plan.status === 'cancelled' ? 'Cancelado' : plan.status}
              </p>
            </div>
            {plan.nextBillingAt && (
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                  {plan.status === 'trial' ? 'Teste encerra em' : plan.status === 'cancelled' ? 'Acesso até' : 'Próxima cobrança'}
                </p>
                <p className="font-bold text-slate-900 text-sm">
                  {new Date(plan.nextBillingAt).toLocaleDateString('pt-BR')}
                </p>
                {plan.daysRemaining > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{plan.daysRemaining} dia{plan.daysRemaining !== 1 ? 's' : ''} restante{plan.daysRemaining !== 1 ? 's' : ''}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => navigate('/planos')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              {plan.status === 'trial' ? 'Assinar agora' : 'Mudar plano'}
            </button>

            {plan.status === 'active' && !cancelConfirm && (
              <button
                onClick={() => setCancelConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-all"
              >
                <XCircle className="w-4 h-4" /> Cancelar assinatura
              </button>
            )}

            {cancelConfirm && (
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-800 font-semibold mb-2">
                  Confirmar cancelamento? Você poderá usar até o fim do período pago.
                </p>
                {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setCancelling(true);
                      setCancelError('');
                      try {
                        await db.cancelStripeSubscription();
                        setPlan(p => p ? { ...p, status: 'cancelled' } : p);
                        setCancelConfirm(false);
                      } catch (e: any) {
                        setCancelError(e?.message ?? 'Erro ao cancelar. Tente novamente.');
                      } finally {
                        setCancelling(false);
                      }
                    }}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                  <button
                    onClick={() => { setCancelConfirm(false); setCancelError(''); }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Você pode cancelar a qualquer momento sem custo. O acesso continua até o fim do período já pago.
          </p>
        </SectionCard>
      )}

      {/* Programa de indicação */}
      <ReferralSection slug={form?.slug ?? ''} />

      {/* Custom Domain */}
      <CustomDomainSection slug={form?.slug ?? ''} />

      {/* 2FA */}
      <TwoFactorSection />

      {/* Zona de perigo — LGPD */}
      <DeleteAccountSection />
    </div>
  );
}

function ReferralSection({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const referralUrl = slug ? `${window.location.origin}/?ref=${slug}` : '';

  const copy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SectionCard icon={Users} title="Programa de Indicação" description="Indique outros restaurantes e ganhe benefícios">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Compartilhe seu link de indicação. Quando um novo restaurante se cadastrar pelo seu link,
          ambos ganham desconto na próxima renovação.
        </p>
        {referralUrl ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={referralUrl}
              className="input-field flex-1 font-mono text-xs bg-slate-50"
            />
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Salve suas configurações com um slug para gerar o link de indicação.</p>
        )}
      </div>
    </SectionCard>
  );
}

function CustomDomainSection({ slug: _slug }: { slug: string }) {
  const [domain, setDomain] = useState(() => localStorage.getItem('zm_custom_domain') ?? '');
  const [copied, setCopied] = useState(false);
  const target = `${window.location.hostname}`;

  const save = () => {
    localStorage.setItem('zm_custom_domain', domain.trim());
    alert('Dominio salvo! Configure o registro CNAME no seu provedor de DNS conforme as instrucoes abaixo.');
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SectionCard icon={Globe} title="Dominio proprio" description="Aponte um dominio personalizado para o seu cardapio">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Dominio (ex: cardapio.seurestaurante.com.br)</label>
        <div className="flex gap-2">
          <input
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="input flex-1"
            placeholder="cardapio.seurestaurante.com.br"
          />
          <button onClick={save} className="btn-primary flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configuracao de DNS (CNAME)</p>
        <p className="text-xs text-slate-500 leading-relaxed">No painel do seu provedor de DNS (Registro.br, GoDaddy, Cloudflare, etc.), adicione o registro:</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div className="font-mono text-xs text-slate-700">
              <span className="text-slate-400">Tipo: </span>CNAME &nbsp;
              <span className="text-slate-400">Nome: </span>{domain || 'cardapio'} &nbsp;
              <span className="text-slate-400">Destino: </span>{target}
            </div>
            <button onClick={() => copy(`CNAME ${domain || 'cardapio'} ${target}`)} className="p-1 rounded-lg hover:bg-slate-100 flex-shrink-0">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">A propagacao do DNS pode levar ate 48 horas. Apos configurado, acesse <code className="bg-slate-100 px-1 rounded">{domain || 'seu-dominio'}</code> para ver o cardapio.</p>
      </div>
    </SectionCard>
  );
}

function TwoFactorSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'enrolling' | 'done'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [error, setError] = useState('');
  const [factors, setFactors] = useState<Array<{ id: string; status: string }>>([]);

  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.mfa.listFactors().then(({ data }) => {
        setFactors(data?.totp ?? []);
      });
    });
  }, []);

  const startEnroll = async () => {
    setStatus('loading');
    setError('');
    const { supabase } = await import('../lib/supabase');
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (err || !data) { setError(err?.message ?? 'Erro ao iniciar 2FA'); setStatus('idle'); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStatus('enrolling');
  };

  const verify = async () => {
    if (!code || code.length !== 6) return;
    setError('');
    const { supabase } = await import('../lib/supabase');
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setError('Erro ao iniciar desafio'); return; }
    const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (err) { setError('Codigo invalido. Tente novamente.'); return; }
    setStatus('done');
    setFactors(f => [...f, { id: factorId, status: 'verified' }]);
  };

  const removeFactor = async (id: string) => {
    if (!confirm('Desativar 2FA? Voce precisara reconfigurar se quiser reativar.')) return;
    const { supabase } = await import('../lib/supabase');
    await supabase.auth.mfa.unenroll({ factorId: id });
    setFactors(f => f.filter(x => x.id !== id));
    setStatus('idle');
  };

  const verified = factors.filter(f => f.status === 'verified');

  return (
    <SectionCard icon={Shield} title="Autenticacao em dois fatores (2FA)" description="Adicione uma camada extra de seguranca a sua conta">
      {status === 'done' ? (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">2FA ativado com sucesso!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Sua conta agora requer o aplicativo autenticador ao fazer login.</p>
          </div>
        </div>
      ) : verified.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-800 text-sm">2FA ativo</p>
              <p className="text-xs text-emerald-600 mt-0.5">Sua conta esta protegida com autenticacao em dois fatores.</p>
            </div>
            <button onClick={() => removeFactor(verified[0].id)} className="text-xs text-red-500 font-semibold hover:underline flex-shrink-0">Desativar</button>
          </div>
        </div>
      ) : status === 'enrolling' ? (
        <div className="space-y-4">
          <div className="text-sm text-slate-600 space-y-2">
            <p>1. Instale o <strong>Google Authenticator</strong> ou <strong>Authy</strong> no celular</p>
            <p>2. Escaneie o QR Code abaixo</p>
          </div>
          {qrCode && (
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white border-2 border-slate-200 rounded-xl p-3">
                <img src={qrCode} alt="QR Code 2FA" className="w-40 h-40" />
              </div>
              <details className="text-center">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Nao consegue escanear? Ver codigo manual</summary>
                <p className="text-xs font-mono bg-slate-100 rounded-lg px-3 py-2 mt-2 break-all select-all">{secret}</p>
              </details>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">3. Digite o codigo de 6 digitos</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input flex-1 font-mono text-center text-xl tracking-widest"
                placeholder="000000"
                maxLength={6}
              />
              <button onClick={verify} disabled={code.length !== 6} className="btn-primary">Verificar</button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <button onClick={() => setStatus('idle')} className="text-xs text-slate-400 hover:underline">Cancelar</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">O 2FA usa um aplicativo autenticador (Google Authenticator, Authy) para gerar codigos temporarios ao fazer login.</p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <button onClick={startEnroll} disabled={status === 'loading'} className="btn-primary flex items-center gap-2">
            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {status === 'loading' ? 'Aguarde...' : 'Ativar 2FA'}
          </button>
        </div>
      )}
    </SectionCard>
  );
}

function DeleteAccountSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'idle' | 'confirm' | 'typing' | 'deleting'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const CONFIRM_WORD = 'EXCLUIR';

  const handleDelete = async () => {
    if (!user) return;
    setStep('deleting');
    setError('');
    try {
      await db.deleteMyAccount();
      await logout();
      navigate('/');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao excluir conta. Tente novamente.');
      setStep('typing');
    }
  };

  return (
    <div className="card overflow-hidden border border-red-200">
      <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3 bg-red-50">
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-red-800 text-sm">Zona de Perigo</h3>
          <p className="text-xs text-red-500 mt-0.5">Ações irreversíveis — não podem ser desfeitas</p>
        </div>
      </div>
      <div className="px-6 py-5">
        {step === 'idle' && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Excluir minha conta</p>
              <p className="text-xs text-slate-500 mt-0.5">Remove permanentemente todos os dados: cardápio, pedidos, clientes, configurações. Conforme a LGPD (Lei 13.709/2018).</p>
            </div>
            <button
              onClick={() => setStep('confirm')}
              className="flex-shrink-0 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors"
            >
              Excluir conta
            </button>
          </div>
        )}

        {step !== 'idle' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-bold mb-1">Esta ação é permanente e irreversível.</p>
                <p>Todos os dados serão apagados: cardápio, pedidos, clientes, cupons, cashback, operadores e configurações. Não há como recuperar.</p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Digite <span className="font-mono text-red-600">{CONFIRM_WORD}</span> para confirmar
              </label>
              <input
                value={confirmText}
                onChange={e => { setConfirmText(e.target.value.toUpperCase()); setStep('typing'); }}
                className="input w-full font-mono"
                placeholder={CONFIRM_WORD}
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={confirmText !== CONFIRM_WORD || step === 'deleting'}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
              >
                {step === 'deleting' ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : <><Trash2 className="w-4 h-4" /> Excluir permanentemente</>}
              </button>
              <button
                onClick={() => { setStep('idle'); setConfirmText(''); setError(''); }}
                disabled={step === 'deleting'}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

