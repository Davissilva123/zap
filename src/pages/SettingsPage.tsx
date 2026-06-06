import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { uploadImage } from '../lib/upload';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { RestaurantSettings, PaymentMethod } from '../lib/types';
import { Save, Check, Store, QrCode, Palette, Link2, CreditCard, AlertTriangle, MessageCircle, ImagePlus, Loader2, X, Clock, Truck, Plus, Trash2 } from 'lucide-react';
import type { DeliveryNeighborhood, DayHours } from '../lib/types';

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

function ImageUploadField({ label, preview, onFileChange, onRemove, inputRef, hint }: {
  label: string; preview: string; onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void; inputRef: React.RefObject<HTMLInputElement | null>; hint?: string;
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
  const [form, setForm] = useState<RestaurantSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f!, phone: e.target.value }))} className="input-field" />
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
            <span>Sem as credenciais XGate os clientes não poderão pagar via PIX.</span>
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

      {/* Horário de funcionamento */}
      <SectionCard icon={Clock} title="Horário de funcionamento" description="Defina os dias e horários em que o restaurante está aberto">
        {(['0','1','2','3','4','5','6'] as const).map(day => {
          const labels = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
          const hours: DayHours = form.openingHours?.[day] ?? { open: false, from: '09:00', to: '22:00' };
          const setDay = (h: DayHours) => setForm(f => ({ ...f!, openingHours: { ...f!.openingHours, [day]: h } }));
          return (
            <div key={day} className="flex items-center gap-3">
              <div
                onClick={() => setDay({ ...hours, open: !hours.open })}
                className={`w-10 h-5 rounded-full flex items-center cursor-pointer flex-shrink-0 transition-colors ${hours.open ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm mx-0.5 transition-transform ${hours.open ? 'translate-x-5' : ''}`} />
              </div>
              <span className={`text-sm w-20 flex-shrink-0 ${hours.open ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>{labels[Number(day)]}</span>
              {hours.open ? (
                <div className="flex items-center gap-2 flex-1">
                  <input type="time" value={hours.from} onChange={e => setDay({ ...hours, from: e.target.value })}
                    className="input-field py-1.5 text-sm" />
                  <span className="text-slate-400 text-sm">até</span>
                  <input type="time" value={hours.to} onChange={e => setDay({ ...hours, to: e.target.value })}
                    className="input-field py-1.5 text-sm" />
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

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Taxa de entrega padrão (R$)</label>
          <input type="number" min={0} step={0.5} value={form.deliveryFee}
            onChange={e => setForm(f => ({ ...f!, deliveryFee: Number(e.target.value) }))}
            className="input-field w-36" placeholder="0,00" />
          <p className="text-[11px] text-slate-400 mt-1">Usada quando nenhum bairro abaixo bater</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Taxas por bairro</label>
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
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5">
                  <span className="text-xs text-slate-400">R$</span>
                  <input
                    type="number" min={0} step={0.5} value={nb.fee}
                    onChange={e => {
                      const arr = [...form.deliveryNeighborhoods];
                      arr[i] = { ...arr[i], fee: Number(e.target.value) };
                      setForm(f => ({ ...f!, deliveryNeighborhoods: arr }));
                    }}
                    className="w-16 text-sm outline-none text-center"
                  />
                </div>
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

      <button onClick={save} disabled={saving} className={`btn-primary px-8 py-3 disabled:opacity-60 ${saved ? '!bg-emerald-600' : ''}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo com sucesso!' : 'Salvar configurações'}
      </button>
    </div>
  );
}
