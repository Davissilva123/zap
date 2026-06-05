import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Category } from '../lib/types';
import { Plus, Pencil, Trash2, X, FolderOpen } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '📁' });

  const load = () => {
    if (!user) return;
    setCategories(db.getCategories(user.id));
  };

  useEffect(load, [user]);

  if (!user) return null;

  const openAdd = () => {
    setEditCat(null);
    setForm({ name: '', emoji: '📁' });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setForm({ name: cat.name, emoji: cat.emoji });
    setShowModal(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (editCat) {
      db.updateCategory(editCat.id, { name: form.name.trim(), emoji: form.emoji });
    } else {
      db.addCategory(user.id, form.name.trim(), form.emoji);
    }
    setShowModal(false);
    load();
  };

  const deleteCat = (id: string) => {
    if (!confirm('Ao apagar a categoria, todos os itens nela serão removidos. Continuar?')) return;
    db.deleteCategory(id);
    load();
  };

  const itemCount = (catId: string) => db.getMenuItems(user.id).filter(i => i.categoryId === catId).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Categorias</h1>
          <p className="text-slate-500 mt-1 text-sm">Organize os itens do seu cardápio</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-base font-medium">Nenhuma categoria criada</p>
          <button onClick={openAdd} className="mt-3 text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-colors">Criar primeira categoria</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="card-hover p-5 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-2xl group-hover:bg-slate-100/80 transition-colors">
                    {cat.emoji}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-[15px]">{cat.name}</h3>
                    <p className="text-sm text-slate-400 mt-0.5">{itemCount(cat.id)} {itemCount(cat.id) === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(cat)} className="p-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </button>
                  <button onClick={() => deleteCat(cat.id)} className="p-2 rounded-lg hover:bg-red-50/80 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-elevated w-full max-w-md p-7 z-10 animate-scale-in">
            <div className="flex items-center justify-between mb-7">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{editCat ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-slate-100/80 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-16">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Emoji</label>
                  <input type="text" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="input-field text-center text-xl px-2" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nome</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Ex: Sobremesas" />
                </div>
              </div>
              <button onClick={save} className="btn-primary w-full py-3.5 text-[15px]">
                {editCat ? 'Salvar alterações' : 'Criar categoria'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
