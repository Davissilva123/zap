import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { Supplier } from '../lib/types';
import { Truck, Plus, Edit2, Trash2, X, Save, Search, Phone, Mail, ToggleLeft, ToggleRight } from 'lucide-react';

const empty = (): Partial<Supplier> => ({ name: '', email: '', phone: '', cnpj: '', address: '', contactName: '', notes: '', active: true });

function fmtCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>(empty());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    if (!user) return;
    setSuppliers(await db.getSuppliers(user.id));
  };

  useEffect(() => { load(); }, [user]);

  const open = (s?: Supplier) => { setForm(s ? { ...s } : empty()); setModal(true); };
  const close = () => { setModal(false); setForm(empty()); };

  const save = async () => {
    if (!user || !form.name?.trim()) return;
    setSaving(true);
    const saved = await db.upsertSupplier(user.id, form as Supplier & { name: string });
    setSuppliers(prev => {
      const exists = prev.find(s => s.id === saved.id);
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    setSaving(false);
    close();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir fornecedor?')) return;
    await db.deleteSupplier(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const filtered = suppliers.filter(s => {
    if (!showInactive && !s.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.cnpj.includes(q) || s.phone.includes(q);
    }
    return true;
  });

  const set = (k: keyof Supplier, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Truck size={22} className="text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Fornecedores</h1>
            <p className="text-sm text-slate-500">{suppliers.filter(s => s.active).length} ativos</p>
          </div>
        </div>
        <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Novo fornecedor
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou telefone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={() => setShowInactive(s => !s)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border ${showInactive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          {showInactive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} Inativos
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Truck size={40} className="opacity-20" />
          <p className="text-sm">{suppliers.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum resultado'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Fornecedor</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-slate-600">Contato</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-slate-600">CNPJ</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Status</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800 truncate max-w-[140px] sm:max-w-none">{s.name}</p>
                      {s.contactName && <p className="text-xs text-slate-500 truncate">{s.contactName}</p>}
                      <div className="sm:hidden mt-1 space-y-0.5">
                        {s.phone && <div className="flex items-center gap-1 text-xs text-slate-600"><Phone size={10} />{s.phone}</div>}
                        {s.email && <div className="flex items-center gap-1 text-xs text-slate-500 truncate"><Mail size={10} /><span className="truncate">{s.email}</span></div>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3">
                    <div className="space-y-0.5">
                      {s.phone && <div className="flex items-center gap-1 text-xs text-slate-600"><Phone size={11} />{s.phone}</div>}
                      {s.email && <div className="flex items-center gap-1 text-xs text-slate-600"><Mail size={11} />{s.email}</div>}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-600">{s.cnpj ? fmtCNPJ(s.cnpj) : '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => open(s)} className="p-1.5 text-slate-400 hover:text-emerald-600"><Edit2 size={14} /></button>
                      <button onClick={() => del(s.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">{form.id ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nome *</label>
                <input value={form.name ?? ''} onChange={e => set('name', e.target.value)}
                  placeholder="Distribuidora XYZ"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Telefone</label>
                  <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="(11) 99999-9999"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">E-mail</label>
                  <input value={form.email ?? ''} onChange={e => set('email', e.target.value)} type="email" placeholder="contato@fornecedor.com"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">CNPJ</label>
                  <input value={form.cnpj ?? ''} onChange={e => set('cnpj', e.target.value.replace(/\D/g, ''))}
                    placeholder="00.000.000/0001-00" maxLength={18}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Contato</label>
                  <input value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value)} placeholder="Nome do responsável"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Endereço</label>
                <input value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro, cidade"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Observações</label>
                <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Ativo</span>
                <button onClick={() => set('active', !form.active)} className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.active ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={close} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name?.trim()}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 flex items-center gap-2">
                <Save size={14} />{saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

