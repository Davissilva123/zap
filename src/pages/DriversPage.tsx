import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Driver } from '../lib/types';
import { Bike, Plus, Edit2, Trash2, Phone, X, Check, ToggleLeft, ToggleRight, Link, Copy } from 'lucide-react';

export default function DriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; driver: Driver | null }>({ open: false, driver: null });
  const [form, setForm] = useState({ name: '', phone: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const portalUrl = (token: string) => `${window.location.origin}/entregador/${token}`;

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(portalUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const load = async () => {
    if (!user) return;
    setDrivers(await db.getDrivers(user.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openCreate = () => {
    setForm({ name: '', phone: '', active: true });
    setError('');
    setModal({ open: true, driver: null });
  };

  const openEdit = (d: Driver) => {
    setForm({ name: d.name, phone: d.phone, active: d.active });
    setError('');
    setModal({ open: true, driver: d });
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal.driver) {
        await db.updateDriver(modal.driver.id, { name: form.name.trim(), phone: form.phone.trim(), active: form.active });
      } else {
        await db.createDriver(user.id, { name: form.name.trim(), phone: form.phone.trim(), active: form.active });
      }
      setModal({ open: false, driver: null });
      load();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este entregador?')) return;
    await db.deleteDriver(id);
    load();
  };

  const toggleActive = async (d: Driver) => {
    await db.updateDriver(d.id, { active: !d.active });
    setDrivers(prev => prev.map(x => x.id === d.id ? { ...x, active: !d.active } : x));
  };

  const active = drivers.filter(d => d.active);
  const inactive = drivers.filter(d => !d.active);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Entregadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{drivers.length} cadastrado{drivers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo entregador
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Bike className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum entregador cadastrado</p>
          <p className="text-slate-400 text-sm mt-1">Clique em "Novo entregador" para começar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Ativos ({active.length})</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map(d => <DriverCard key={d.id} driver={d} onEdit={openEdit} onDelete={remove} onToggle={toggleActive} onCopyLink={copyLink} copied={copiedId === d.id} />)}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Inativos ({inactive.length})</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map(d => <DriverCard key={d.id} driver={d} onEdit={openEdit} onDelete={remove} onToggle={toggleActive} onCopyLink={copyLink} copied={copiedId === d.id} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modal.driver ? 'Editar entregador' : 'Novo entregador'}
              </h2>
              <button onClick={() => setModal({ open: false, driver: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="Ex: Carlos Silva"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefone</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
                  placeholder="(11) 99999-9999"
                  type="tel"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-slate-700">Ativo</span>
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                  {form.active
                    ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                    : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                </button>
              </div>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setModal({ open: false, driver: null })} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverCard({ driver, onEdit, onDelete, onToggle, onCopyLink, copied }: {
  driver: Driver;
  onEdit: (d: Driver) => void;
  onDelete: (id: string) => void;
  onToggle: (d: Driver) => void;
  onCopyLink: (token: string, id: string) => void;
  copied: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${driver.active ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${driver.active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
          <Bike className={`w-5 h-5 ${driver.active ? 'text-emerald-500' : 'text-slate-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{driver.name}</p>
          {driver.phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{driver.phone}</span>
            </div>
          )}
          <button
            onClick={() => onToggle(driver)}
            className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${driver.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
          >
            {driver.active ? 'Ativo' : 'Inativo'}
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(driver)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(driver.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Portal link */}
      <button
        onClick={() => onCopyLink(driver.accessToken, driver.id)}
        className={`mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${copied ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
      >
        {copied ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="truncate">{copied ? 'Link copiado!' : 'Copiar link do portal'}</span>
      </button>
    </div>
  );
}
