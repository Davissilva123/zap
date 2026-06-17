import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import type { Coupon } from '../lib/types';
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, Copy, Check } from 'lucide-react';
import { parseCurrency, numToCurrency } from '../lib/masks';

const emptyForm = { code: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: '10', minOrder: '0', maxUses: '', expiresAt: '' };

export default function CouponsPage() {
  const { user } = useAuth();
  const restaurantId = useRestaurantId();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => { if (restaurantId) db.getCoupons(restaurantId).then(setCoupons); };
  useEffect(() => { load(); }, [restaurantId]);
  if (!user) return null;

  const save = async () => {
    if (!form.code.trim() || !form.discountValue || !restaurantId) return;
    setSaving(true);
    try {
      await db.addCoupon(restaurantId, {
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minOrder: parseFloat(form.minOrder) || 0,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        active: true,
        expiresAt: form.expiresAt || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c: Coupon) => {
    await db.updateCoupon(c.id, { active: !c.active });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return;
    await db.deleteCoupon(id);
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmtDiscount = (c: Coupon) =>
    c.discountType === 'percent' ? `${c.discountValue}% off` : `R$ ${c.discountValue.toFixed(2).replace('.', ',')} off`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cupons de desconto</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{coupons.length} cupons cadastrados</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo cupom
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <h3 className="font-semibold text-slate-900 text-sm">Novo cupom</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Código *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="input w-full font-mono tracking-widest" placeholder="PROMO10" maxLength={20} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tipo</label>
              <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'fixed' }))} className="input w-full">
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                {form.discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'} *
              </label>
              <input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                className="input w-full" placeholder="10" min="0" step={form.discountType === 'percent' ? '1' : '0.01'} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Pedido mínimo</label>
              <input type="text" inputMode="numeric" value={numToCurrency(parseFloat(form.minOrder) || 0)} onChange={e => setForm(f => ({ ...f, minOrder: String(parseCurrency(e.target.value)) }))}
                className="input w-full" placeholder="R$ 0,00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Usos máximos</label>
              <input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                className="input w-full" placeholder="∞ ilimitado" min="1" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Validade (opcional)</label>
            <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="input" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Criar cupom'}</button>
          </div>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="card p-16 text-center">
          <Tag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum cupom ainda</p>
          <p className="text-slate-400 text-sm mt-1">Crie cupons para promoções e fidelizar clientes</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {coupons.map(c => (
            <div key={c.id} className={`card p-4 flex items-center gap-4 ${!c.active ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono font-bold text-slate-900 text-base tracking-widest">{c.code}</code>
                  <button onClick={() => copyCode(c.code)} className="p-1 rounded hover:bg-slate-100 transition-colors" title="Copiar código">
                    {copied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <span className="badge bg-emerald-50 text-emerald-700">{fmtDiscount(c)}</span>
                  {!c.active && <span className="badge bg-red-50 text-red-500">Inativo</span>}
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                  {c.minOrder > 0 && <span>Mín. R$ {c.minOrder.toFixed(2).replace('.', ',')}</span>}
                  <span>{c.usesCount} usos{c.maxUses !== null ? ` / ${c.maxUses}` : ''}</span>
                  {c.expiresAt && <span>Expira {new Date(c.expiresAt).toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(c)} title={c.active ? 'Desativar' : 'Ativar'} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  {c.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </button>
                <button onClick={() => del(c.id)} className="p-2 rounded-xl hover:bg-red-50 transition-colors text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
