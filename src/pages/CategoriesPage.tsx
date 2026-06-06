import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Category } from '../lib/types';
import { Plus, Pencil, Trash2, X, FolderOpen } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '📁' });

  const load = async () => {
    if (!user) return;
    const [cats, its] = await Promise.all([db.getCategories(user.id), db.getMenuItems(user.id)]);
    setCategories(cats);
    const counts: Record<string, number> = {};
    cats.forEach(c => { counts[c.id] = its.filter(i => i.categoryId === c.id).length; });
    setItemCounts(counts);
  };

  useEffect(() => { load(); }, [user]);
  if (!user) return null;

  const openAdd = () => { setEditCat(null); setForm({ name: '', emoji: '📁' }); setShowModal(true); };
  const openEdit = (cat: Category) => { setEditCat(cat); setForm({ name: cat.name, emoji: cat.emoji }); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editCat) await db.updateCategory(editCat.id, { name: form.name.trim(), emoji: form.emoji });
    else await db.addCategory(user.id, form.name.trim(), form.emoji);
    setShowModal(false);
    load();
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Ao apagar a categoria, todos os itens nela serão removidos. Continuar?')) return;
    await db.deleteCategory(id);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Categorias</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Organize os itens do seu cardápio</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Nenhuma categoria criada</p>
          <p className="text-sm text-slate-400 mb-4">Crie categorias para organizar seu cardápio</p>
          <button onClick={openAdd} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Criar primeira categoria
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(cat => {
            const count = itemCounts[cat.id] ?? 0;
            return (
              <div key={cat.id} className="card-hover p-5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-slate-200/60 transition-colors">
                      {cat.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{cat.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{count} {count === 1 ? 'item' : 'itens'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </button>
                    <button onClick={() => deleteCat(cat.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{editCat ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3">
                <div className="w-16">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Emoji</label>
                  <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="input-field text-center text-xl px-2" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Ex: Sobremesas" autoFocus />
                </div>
              </div>
              <button onClick={save} className="btn-primary w-full py-3">
                {editCat ? 'Salvar alterações' : 'Criar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
