import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Combo, ComboItem, MenuItem } from '../lib/types';
import { Plus, Trash2, Pencil, X, Check, Loader2, Package2, ToggleLeft, ToggleRight } from 'lucide-react';

const emptyCombo: Omit<Combo, 'id' | 'userId' | 'createdAt'> = {
  name: '', emoji: '🍱', description: '', price: 0, active: true, items: [],
};

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

export default function CombosPage() {
  const { user } = useAuth();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCombo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    const [c, m] = await Promise.all([db.getCombos(user.id), db.getMenuItems(user.id)]);
    setCombos(c);
    setMenuItems(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyCombo);
    setError('');
    setShowForm(true);
  };

  const openEdit = (c: Combo) => {
    setEditingId(c.id);
    setForm({ name: c.name, emoji: c.emoji, description: c.description, price: c.price, active: c.active, items: c.items });
    setError('');
    setShowForm(true);
  };

  const addItem = (item: MenuItem) => {
    const existing = form.items.find(i => i.menuItemId === item.id);
    if (existing) {
      setForm(f => ({ ...f, items: f.items.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i) }));
    } else {
      const ci: ComboItem = { menuItemId: item.id, name: item.name, emoji: item.emoji, quantity: 1 };
      setForm(f => ({ ...f, items: [...f.items, ci] }));
    }
  };

  const removeItem = (menuItemId: string) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.menuItemId !== menuItemId) }));
  };

  const changeQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) return removeItem(menuItemId);
    setForm(f => ({ ...f, items: f.items.map(i => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i) }));
  };

  const save = async () => {
    if (!user || !form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) await db.updateCombo(editingId, form);
      else await db.addCombo(user.id, form);
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Combo) => {
    await db.updateCombo(c.id, { active: !c.active });
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir este combo?')) return;
    await db.deleteCombo(id);
    await load();
  };

  if (!user) return null;

  const comboItemsTotal = form.items.reduce((s, ci) => {
    const item = menuItems.find(m => m.id === ci.menuItemId);
    return s + (item?.price ?? 0) * ci.quantity;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Combos e Kits</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Agrupe itens com preco especial para aumentar o ticket medio</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo combo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">{editingId ? 'Editar combo' : 'Novo combo'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Emoji</label>
              <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="input w-full text-xl" maxLength={2} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome do combo *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="Ex: Combo Familia, Kit Lanche..." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Descricao</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input w-full" placeholder="Descricao opcional..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Preco do combo (R$)</label>
            <input type="number" min="0" step="0.01" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="input w-full" placeholder="0,00" />
            {comboItemsTotal > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Valor individual dos itens: R$ {fmt(comboItemsTotal)}
                {form.price > 0 && form.price < comboItemsTotal && (
                  <span className="text-emerald-600 font-semibold"> (desconto de R$ {fmt(comboItemsTotal - form.price)})</span>
                )}
              </p>
            )}
          </div>

          {/* Items selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Itens do combo</label>

            {form.items.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.items.map(ci => {
                  const item = menuItems.find(m => m.id === ci.menuItemId);
                  return (
                    <div key={ci.menuItemId} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      <span>{ci.emoji}</span>
                      <span className="flex-1 text-sm font-medium text-slate-700">{ci.name}</span>
                      <span className="text-xs text-slate-400">R$ {fmt((item?.price ?? 0) * ci.quantity)}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(ci.menuItemId, ci.quantity - 1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">-</button>
                        <span className="w-6 text-center text-sm font-bold">{ci.quantity}</span>
                        <button onClick={() => changeQty(ci.menuItemId, ci.quantity + 1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">+</button>
                      </div>
                      <button onClick={() => removeItem(ci.menuItemId)} className="p-1 rounded-lg hover:bg-red-50 text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {menuItems.filter(m => m.available && !form.items.find(i => i.menuItemId === m.id)).map(item => (
                <button key={item.id} onClick={() => addItem(item)} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left text-sm">
                  <span>{item.emoji}</span>
                  <span className="flex-1 truncate text-slate-700">{item.name}</span>
                  <Plus className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex items-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar combo'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : combos.length === 0 ? (
        <div className="card p-16 text-center">
          <Package2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum combo criado</p>
          <p className="text-slate-400 text-sm mt-1">Combos aparecem no cardapio com destaque especial</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {combos.map(c => (
            <div key={c.id} className={`card p-4 space-y-3 ${!c.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{c.emoji}</span>
                  <div>
                    <p className="font-bold text-slate-900">{c.name}</p>
                    {c.description && <p className="text-xs text-slate-400 truncate">{c.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                  <button onClick={() => toggle(c)} className="p-1.5 rounded-lg hover:bg-slate-100">
                    {c.active ? <ToggleRight className="w-4.5 h-4.5 text-emerald-500" /> : <ToggleLeft className="w-4.5 h-4.5 text-slate-400" />}
                  </button>
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {c.items.map(ci => (
                  <span key={ci.menuItemId} className="px-2 py-0.5 bg-slate-100 rounded-lg text-xs text-slate-600">
                    {ci.emoji} {ci.name} {ci.quantity > 1 ? `x${ci.quantity}` : ''}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-xs text-slate-400">{c.items.length} iten{c.items.length !== 1 ? 's' : ''}</span>
                <span className="text-lg font-black text-emerald-600">R$ {fmt(c.price)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
