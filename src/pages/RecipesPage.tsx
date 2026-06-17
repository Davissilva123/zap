import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { MenuItem, RecipeIngredient, Supplier } from '../lib/types';
import { BookOpen, Plus, Trash2, Save, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { parseCurrency, numToCurrency } from '../lib/masks';

const UNITS = ['g', 'kg', 'ml', 'L', 'un', 'cx', 'pct', 'col', 'xíc'];

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

interface IngForm {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  unitCost: string;
  supplierId: string;
}

const emptyIng = (): IngForm => ({ name: '', quantity: '', unit: 'g', unitCost: '', supplierId: '' });

export default function RecipesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Record<string, RecipeIngredient[]>>({});
  const [editForms, setEditForms] = useState<Record<string, IngForm[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    db.getMenuItems(user.id).then(setItems);
    db.getSuppliers(user.id).then(setSuppliers);
  }, [user]);

  const toggleExpand = async (itemId: string) => {
    if (expanded === itemId) { setExpanded(null); return; }
    setExpanded(itemId);
    if (!ingredients[itemId]) {
      const ings = await db.getRecipeIngredients(itemId);
      setIngredients(prev => ({ ...prev, [itemId]: ings }));
      setEditForms(prev => ({
        ...prev,
        [itemId]: ings.map(i => ({ id: i.id, name: i.name, quantity: String(i.quantity), unit: i.unit, unitCost: String(i.unitCost), supplierId: i.supplierId ?? '' })),
      }));
    }
  };

  const addRow = (itemId: string) => {
    setEditForms(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), emptyIng()] }));
  };

  const removeRow = async (itemId: string, idx: number) => {
    const form = editForms[itemId]?.[idx];
    if (form?.id) await db.deleteRecipeIngredient(form.id);
    setEditForms(prev => ({ ...prev, [itemId]: prev[itemId].filter((_, i) => i !== idx) }));
    setIngredients(prev => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter(i => i.id !== form?.id) }));
  };

  const updateRow = (itemId: string, idx: number, field: keyof IngForm, value: string) => {
    setEditForms(prev => ({
      ...prev,
      [itemId]: prev[itemId].map((row, i) => i === idx ? { ...row, [field]: value } : row),
    }));
  };

  const save = async (itemId: string) => {
    if (!user) return;
    setSaving(itemId);
    const forms = editForms[itemId] ?? [];
    await Promise.all(
      forms
        .filter(f => f.name.trim() && parseFloat(f.quantity) > 0)
        .map(f => db.upsertRecipeIngredient(user.id, {
          id: f.id,
          menuItemId: itemId,
          name: f.name.trim(),
          quantity: parseFloat(f.quantity),
          unit: f.unit,
          unitCost: parseFloat(f.unitCost) || 0,
          supplierId: f.supplierId || null,
        }))
    );
    const updated = await db.getRecipeIngredients(itemId);
    setIngredients(prev => ({ ...prev, [itemId]: updated }));
    setSaving(null);
  };

  const totalCost = (itemId: string) => {
    const ings = ingredients[itemId] ?? [];
    return ings.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  };

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={22} className="text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Fichas Técnicas</h1>
            <p className="text-sm text-slate-500">Ingredientes e custo de produção por item</p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          As fichas técnicas complementam o CMV. Cadastre os ingredientes de cada item para ter o custo de produção real e comparar com o preço de venda.
        </p>
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar item do cardápio..."
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(item => {
          const isOpen = expanded === item.id;
          const cost = totalCost(item.id);
          const margin = item.price > 0 ? ((item.price - cost) / item.price) * 100 : 0;
          const forms = editForms[item.id] ?? [];

          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="text-sm text-slate-500">Preço: {fmt(item.price)}</p>
                </div>
                {ingredients[item.id] !== undefined && (
                  <div className="flex items-center gap-4 text-sm mr-4">
                    <span className="text-slate-500">Custo: <strong className="text-slate-800">{fmt(cost)}</strong></span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${margin >= 60 ? 'bg-green-100 text-green-700' : margin >= 35 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      Margem: {margin.toFixed(0)}%
                    </span>
                  </div>
                )}
                {isOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm mb-3 min-w-[540px]">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Ingrediente</th>
                        <th className="text-left pb-2 font-medium w-24">Qtd</th>
                        <th className="text-left pb-2 font-medium w-20">Un</th>
                        <th className="text-left pb-2 font-medium w-28">Custo/un</th>
                        <th className="text-left pb-2 font-medium w-32">Fornecedor</th>
                        <th className="text-left pb-2 font-medium w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {forms.map((row, idx) => {
                        const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0);
                        return (
                          <tr key={idx}>
                            <td className="py-1.5 pr-2">
                              <input value={row.name} onChange={e => updateRow(item.id, idx, 'name', e.target.value)}
                                placeholder="ex: Farinha de trigo"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input value={row.quantity} onChange={e => updateRow(item.id, idx, 'quantity', e.target.value)}
                                type="number" min="0" step="any"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={row.unit} onChange={e => updateRow(item.id, idx, 'unit', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <input value={numToCurrency(parseFloat(row.unitCost) || 0)} onChange={e => updateRow(item.id, idx, 'unitCost', String(parseCurrency(e.target.value)))}
                                type="text" inputMode="numeric" placeholder="R$ 0,00"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={row.supplierId} onChange={e => updateRow(item.id, idx, 'supplierId', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
                                <option value="">—</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2 text-xs font-medium text-slate-600 whitespace-nowrap">
                              {fmt(rowTotal)}
                            </td>
                            <td className="py-1.5">
                              <button onClick={() => removeRow(item.id, idx)} className="text-red-400 hover:text-red-600 p-0.5">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>{/* /overflow-x-auto */}

                  <div className="flex items-center justify-between">
                    <button onClick={() => addRow(item.id)} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                      <Plus size={15} /> Adicionar ingrediente
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">Custo total: <strong>{fmt(forms.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unitCost) || 0), 0))}</strong></span>
                      <button
                        onClick={() => save(item.id)}
                        disabled={saving === item.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
                      >
                        <Save size={14} />
                        {saving === item.id ? 'Salvando...' : 'Salvar ficha'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

