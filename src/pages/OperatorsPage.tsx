import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Operator } from '../lib/types';
import { Plus, Trash2, ToggleLeft, ToggleRight, Users, Shield, UtensilsCrossed, CreditCard } from 'lucide-react';

const ROLES: { value: Operator['role']; label: string; desc: string; icon: typeof Shield }[] = [
  { value: 'admin', label: 'Admin', desc: 'Acesso completo ao sistema', icon: Shield },
  { value: 'waiter', label: 'Garçom', desc: 'Visualiza pedidos e cardápio', icon: UtensilsCrossed },
  { value: 'cashier', label: 'Caixa', desc: 'Gerencia pedidos e pagamentos', icon: CreditCard },
];

const emptyForm = { email: '', name: '', role: 'waiter' as Operator['role'], notes: '' };

export default function OperatorsPage() {
  const { user } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => { if (user) db.getOperators(user.id).then(setOperators); };
  useEffect(() => { load(); }, [user]);
  if (!user) return null;

  const save = async () => {
    if (!form.email.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      await db.addOperator(user.id, { email: form.email.trim().toLowerCase(), name: form.name.trim(), role: form.role, active: true, notes: form.notes });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  };

  const toggle = async (op: Operator) => {
    await db.updateOperator(op.id, { active: !op.active });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Remover este operador?')) return;
    await db.deleteOperator(id);
    load();
  };

  const roleInfo = (r: Operator['role']) => ROLES.find(x => x.value === r)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operadores</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Gerencie quem tem acesso ao sistema</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar operador
        </button>
      </div>

      {/* Roles info */}
      <div className="grid grid-cols-3 gap-3">
        {ROLES.map(r => (
          <div key={r.value} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <r.icon className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-800 text-sm">{r.label}</span>
            </div>
            <p className="text-xs text-slate-400">{r.desc}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <h3 className="font-semibold text-slate-900 text-sm">Novo operador</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="João Silva" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">E-mail *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input w-full" placeholder="joao@exemplo.com" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Função *</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.role === r.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <r.icon className={`w-4 h-4 mb-1 ${form.role === r.value ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <p className={`text-xs font-bold ${form.role === r.value ? 'text-emerald-700' : 'text-slate-700'}`}>{r.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observações</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input w-full" placeholder="Turno, horário, etc." />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </div>
      )}

      {operators.length === 0 ? (
        <div className="card p-16 text-center">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum operador cadastrado</p>
          <p className="text-slate-400 text-sm mt-1">Adicione garçons, caixas e outros colaboradores</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {operators.map(op => {
            const role = roleInfo(op.role);
            return (
              <div key={op.id} className={`card p-4 flex items-center gap-4 ${!op.active ? 'opacity-50' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <role.icon className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{op.name}</span>
                    <span className="badge bg-slate-100 text-slate-500 text-[10px]">{role.label}</span>
                    {!op.active && <span className="badge bg-red-50 text-red-500 text-[10px]">Inativo</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{op.email}</p>
                  {op.notes && <p className="text-xs text-slate-400">{op.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggle(op)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                    {op.active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button onClick={() => del(op.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-4 bg-amber-50/50 border-amber-100">
        <p className="text-sm font-semibold text-amber-800 mb-1">Sobre acesso dos operadores</p>
        <p className="text-xs text-amber-700">Operadores cadastrados aqui usam o login normal do sistema. Para acesso separado por operador, cada um precisa de uma conta Supabase própria. Em breve: link de convite automático.</p>
      </div>
    </div>
  );
}
