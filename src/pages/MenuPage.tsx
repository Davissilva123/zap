import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Category, MenuItem } from '../lib/types';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X } from 'lucide-react';

export default function MenuPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', emoji: '🍽️', categoryId: '', available: true });

  const load = () => {
    if (!user) return;
    setCategories(db.getCategories(user.id));
    setItems(db.getMenuItems(user.id));
  };

  useEffect(load, [user]);
  if (!user) return null;

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && i.categoryId !== filterCat) return false;
    return true;
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', description: '', price: '', emoji: '🍽️', categoryId: categories[0]?.id || '', available: true });
    setShowModal(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), emoji: item.emoji, categoryId: item.categoryId, available: item.available });
    setShowModal(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.price) return;
    const data = { name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), emoji: form.emoji, categoryId: form.categoryId, available: form.available };
    if (editItem) db.updateMenuItem(editItem.id, data);
    else db.addMenuItem(user.id, data);
    setShowModal(false);
    load();
  };

  const toggleAvailable = (item: MenuItem) => {
    db.updateMenuItem(item.id, { available: !item.available });
    load();
  };

  const deleteItem = (id: string) => {
    db.deleteMenuItem(id);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cardápio</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{items.length} itens em {categories.length} categorias</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar item..." className="input-field pl-10" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field sm:w-52">
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      {/* Items by category */}
      {categories.map(cat => {
        const catItems = filtered.filter(i => i.categoryId === cat.id);
        if (catItems.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{cat.emoji}</span>
              <h3 className="font-semibold text-slate-800 text-[15px]">{cat.name}</h3>
              <span className="badge bg-slate-100 text-slate-500 text-[11px] py-0.5">{catItems.length}</span>
            </div>
            <div className="card overflow-hidden divide-y divide-slate-100">
              {catItems.map(item => (
                <div key={item.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group ${!item.available ? 'opacity-50' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                    {item.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                      {!item.available && <span className="badge bg-red-50 text-red-500 text-[10px] py-0.5">Indisponível</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                  </div>
                  <span className="text-base font-bold text-emerald-600 flex-shrink-0">
                    R$ {item.price.toFixed(2).replace('.', ',')}
                  </span>
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleAvailable(item)} title={item.available ? 'Desativar' : 'Ativar'} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                      {item.available
                        ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                        : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Nenhum item encontrado</p>
          <button onClick={openAdd} className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold transition-colors mt-1">
            + Adicionar item
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{editItem ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3">
                <div className="w-16">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Emoji</label>
                  <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="input-field text-center text-lg px-2" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Ex: Risoto de Cogumelos" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Ingredientes, detalhes..." />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Preço (R$)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" placeholder="0,00" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Categoria</label>
                  <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="input-field">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center ${form.available ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  onClick={() => setForm(f => ({ ...f, available: !f.available }))}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-transform duration-200 ${form.available ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">{form.available ? 'Disponível no cardápio' : 'Indisponível'}</span>
              </label>
            </div>
            <div className="px-6 pb-5">
              <button onClick={save} className="btn-primary w-full py-3">
                {editItem ? 'Salvar alterações' : 'Adicionar item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
