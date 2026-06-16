import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Category } from '../lib/types';
import { Plus, Pencil, Trash2, X, FolderOpen, Clock, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableCard({
  cat,
  count,
  onEdit,
  onDelete,
}: {
  cat: Category;
  count: number;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="card-hover p-5 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-slate-200/60 transition-colors">
            {cat.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm truncate">{cat.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {count} {count === 1 ? 'item' : 'itens'}
              {cat.availableFrom && cat.availableTo ? ` · ${cat.availableFrom}–${cat.availableTo}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(cat)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Pencil className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => onDelete(cat.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', emoji: '📁', availableFrom: '', availableTo: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const openAdd = () => { setEditCat(null); setForm({ name: '', emoji: '📁', availableFrom: '', availableTo: '' }); setShowModal(true); };
  const openEdit = (cat: Category) => { setEditCat(cat); setForm({ name: cat.name, emoji: cat.emoji, availableFrom: cat.availableFrom || '', availableTo: cat.availableTo || '' }); setShowModal(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editCat) await db.updateCategory(editCat.id, { name: form.name.trim(), emoji: form.emoji, availableFrom: form.availableFrom || undefined, availableTo: form.availableTo || undefined });
    else await db.addCategory(user.id, form.name.trim(), form.emoji, form.availableFrom || undefined, form.availableTo || undefined);
    setShowModal(false);
    load();
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Ao apagar a categoria, todos os itens nela serão removidos. Continuar?')) return;
    await db.deleteCategory(id);
    load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCategories(prev => {
      const oldIdx = prev.findIndex(c => c.id === active.id);
      const newIdx = prev.findIndex(c => c.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      reordered.forEach((cat, idx) => db.updateCategory(cat.id, { order: idx }));
      return reordered;
    });
  };

  const COMMON_EMOJIS = ['📁','🍕','🍔','🌮','🍣','🍝','🥗','🍗','🍺','☕','🍰','🥤','🍟','🥩','🥐','🍜','🍱','🌶️','🍤','🍦'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Categorias</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Organize os itens do seu cardápio · arraste para reordenar</p>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map(c => c.id)} strategy={rectSortingStrategy}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(cat => (
                <SortableCard
                  key={cat.id}
                  cat={cat}
                  count={itemCounts[cat.id] ?? 0}
                  onEdit={openEdit}
                  onDelete={deleteCat}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{editCat ? 'Editar Categoria' : 'Nova Categoria'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Emoji</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.emoji === e ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'hover:bg-slate-100'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  value={form.emoji}
                  onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                  maxLength={2}
                  placeholder="ou cole seu emoji"
                  className="input w-full text-center text-2xl h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome *</label>
                <input
                  autoFocus={!editCat}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="Ex: Pizzas, Bebidas, Sobremesas"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Horário de disponibilidade
                </label>
                <p className="text-xs text-slate-400 mb-2">Deixe vazio para sempre disponível</p>
                <div className="flex items-center gap-2">
                  <input type="time" value={form.availableFrom} onChange={e => setForm(f => ({ ...f, availableFrom: e.target.value }))} className="input flex-1 text-sm" />
                  <span className="text-slate-400 text-sm">até</span>
                  <input type="time" value={form.availableTo} onChange={e => setForm(f => ({ ...f, availableTo: e.target.value }))} className="input flex-1 text-sm" />
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Cancelar</button>
              <button onClick={save} disabled={!form.name.trim()} className="flex-1 btn-primary disabled:opacity-40">
                {editCat ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
