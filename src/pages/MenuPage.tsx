import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import { uploadImage } from '../lib/upload';
import type { Category, MenuItem } from '../lib/types';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X, ImagePlus, Loader2, ChevronDown, Settings2 } from 'lucide-react';
import ItemGroupsEditor from '../components/ItemGroupsEditor';

export default function MenuPage() {
  const { user } = useAuth();
  const restaurantId = useRestaurantId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showGroupsFor, setShowGroupsFor] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', emoji: '🍽️', categoryId: '', available: true, imageUrl: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!restaurantId) return;
    const [cats, its] = await Promise.all([db.getCategories(restaurantId), db.getMenuItems(restaurantId)]);
    setCategories(cats);
    setItems(its);
  };

  useEffect(() => { load(); }, [restaurantId]);
  if (!user) return null;

  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && i.categoryId !== filterCat) return false;
    return true;
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', description: '', price: '', emoji: '🍽️', categoryId: categories[0]?.id || '', available: true, imageUrl: '' });
    setImageFile(null);
    setImagePreview('');
    setShowModal(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ name: item.name, description: item.description, price: String(item.price), emoji: item.emoji, categoryId: item.categoryId, available: item.available, imageUrl: item.imageUrl || '' });
    setImageFile(null);
    setImagePreview(item.imageUrl || '');
    setShowModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    setForm(f => ({ ...f, imageUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!form.name.trim() || !form.price) return;
    setUploading(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const uploaded = await uploadImage(imageFile, 'items');
        if (uploaded) imageUrl = uploaded;
      }
      const data = { name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), emoji: form.emoji, imageUrl, categoryId: form.categoryId, available: form.available };
      if (editItem) await db.updateMenuItem(editItem.id, data);
      else if (restaurantId) await db.addMenuItem(restaurantId, data);
      setShowModal(false);
      load();
    } finally {
      setUploading(false);
    }
  };

  const toggleAvailable = async (item: MenuItem) => {
    await db.updateMenuItem(item.id, { available: !item.available });
    load();
  };

  const deleteItem = async (id: string) => {
    await db.deleteMenuItem(id);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cardápio</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{items.length} itens em {categories.length} categorias</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

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
                <div key={item.id} className={`group ${!item.available ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        : item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{item.name}</span>
                        {!item.available && <span className="badge bg-red-50 text-red-600 text-[10px] py-0.5 font-bold">Esgotado</span>}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                      <span className="sm:hidden text-xs font-bold text-emerald-600 mt-0.5">R$ {item.price.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <span className="hidden sm:block text-base font-bold text-emerald-600 flex-shrink-0">R$ {item.price.toFixed(2).replace('.', ',')}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button onClick={() => toggleAvailable(item)} title={item.available ? 'Marcar como Esgotado' : 'Marcar como Disponível'}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${item.available ? 'hover:bg-slate-100 text-slate-500' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                        {item.available ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-red-400" />}
                        <span className="hidden sm:inline">{item.available ? 'Disponível' : 'Esgotado'}</span>
                      </button>
                      <button onClick={() => setShowGroupsFor(showGroupsFor === item.id ? null : item.id)} title="Adicionais/Complementos" className={`p-2 rounded-lg hover:bg-slate-100 transition-colors ${showGroupsFor === item.id ? 'bg-emerald-50' : ''}`}>
                        <Settings2 className={`w-4 h-4 ${showGroupsFor === item.id ? 'text-emerald-500' : 'text-slate-400'}`} />
                      </button>
                      <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                  {showGroupsFor === item.id && (
                    <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pt-3 pb-2 flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5" /> Adicionais / Complementos
                      </p>
                      <ItemGroupsEditor menuItemId={item.id} />
                    </div>
                  )}
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
              {/* Image upload */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Foto do Produto</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-100">
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <button onClick={removeImage} className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors">
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-[13px] font-medium">Clique para adicionar foto</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>

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
              <button onClick={save} disabled={uploading} className="btn-primary w-full py-3 disabled:opacity-60">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : editItem ? 'Salvar alterações' : 'Adicionar item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
