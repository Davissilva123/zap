import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Promotion, Category } from '../lib/types';
import { Plus, Trash2, Pencil, X, Check, Loader2, Clock, ToggleLeft, ToggleRight, Zap } from 'lucide-react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const emptyPromo: Omit<Promotion, 'id' | 'userId' | 'createdAt'> = {
  name: '', daysOfWeek: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '19:00',
  discountPercent: 20, targetType: 'all', targetId: null, active: true,
};

export default function PromotionsPage() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPromo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    const [p, c] = await Promise.all([db.getPromotions(user.id), db.getCategories(user.id)]);
    setPromos(p);
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openAdd = () => { setEditingId(null); setForm(emptyPromo); setError(''); setShowForm(true); };
  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setForm({ name: p.name, daysOfWeek: p.daysOfWeek, startTime: p.startTime, endTime: p.endTime, discountPercent: p.discountPercent, targetType: p.targetType, targetId: p.targetId, active: p.active });
    setError(''); setShowForm(true);
  };

  const toggleDay = (d: number) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d].sort(),
    }));
  };

  const save = async () => {
    if (!user || !form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) await db.updatePromotion(editingId, form);
      else await db.addPromotion(user.id, form);
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Promotion) => {
    await db.updatePromotion(p.id, { active: !p.active });
    await load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir esta promocao?')) return;
    await db.deletePromotion(id);
    await load();
  };

  if (!user) return null;

  function isActiveNow(p: Promotion): boolean {
    const now = new Date();
    const day = now.getDay();
    const time = now.toTimeString().slice(0, 5);
    return p.active && p.daysOfWeek.includes(day) && time >= p.startTime && time <= p.endTime;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Promocoes Automaticas</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Descontos por horario — happy hour, almoco, etc.</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova promocao
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">{editingId ? 'Editar promocao' : 'Nova promocao'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome da promocao *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="Ex: Happy Hour, Almoco Especial..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${form.daysOfWeek.includes(i) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-500 hover:border-emerald-400'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Inicio</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Fim</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Desconto (%)</label>
              <input type="number" min="1" max="99" value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: Number(e.target.value) }))} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Aplicar em</label>
            <div className="flex gap-2">
              {(['all', 'category'] as Array<Promotion['targetType']>).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, targetType: t, targetId: null }))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${form.targetType === t ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}>
                  {t === 'all' ? 'Todo o cardapio' : 'Uma categoria'}
                </button>
              ))}
            </div>
            {form.targetType === 'category' && (
              <select value={form.targetId ?? ''} onChange={e => setForm(f => ({ ...f, targetId: e.target.value || null }))} className="input w-full mt-2">
                <option value="">Selecione a categoria...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary flex items-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar promocao'}
            </button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="card p-4 bg-amber-50/60 border-amber-100">
        <p className="text-xs font-bold text-amber-800 mb-1">Como funciona</p>
        <p className="text-xs text-amber-700">As promocoes aplicam desconto automatico nos itens do cardapio durante o horario configurado. O cliente ve o preco promocional diretamente no cardapio digital.</p>
      </div>

      {/* List */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : promos.length === 0 ? (
        <div className="card p-16 text-center">
          <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma promocao cadastrada</p>
          <p className="text-slate-400 text-sm mt-1">Crie promocoes por horario como happy hour e almoco especial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(p => {
            const active = isActiveNow(p);
            return (
              <div key={p.id} className={`card p-4 ${!p.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-emerald-500' : p.active ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      <Zap className={`w-4.5 h-4.5 ${active ? 'text-white' : p.active ? 'text-amber-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{p.name}</p>
                        {active && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full animate-pulse">AO VIVO</span>}
                      </div>
                      <p className="text-xs text-slate-500">
                        {p.daysOfWeek.map(d => DAYS[d]).join(', ')} · {p.startTime} – {p.endTime} · {p.discountPercent}% off
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.targetType === 'all' ? 'Todo o cardapio' : `Categoria: ${categories.find(c => c.id === p.targetId)?.name ?? p.targetId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-3.5 h-3.5 text-slate-400" /></button>
                    <button onClick={() => toggle(p)} className="p-1.5 rounded-lg hover:bg-slate-100">
                      {p.active ? <ToggleRight className="w-4.5 h-4.5 text-emerald-500" /> : <ToggleLeft className="w-4.5 h-4.5 text-slate-400" />}
                    </button>
                    <button onClick={() => del(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
