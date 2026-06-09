import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { Users, Plus, Trash2, Power, RefreshCw, Shield, Lock, X } from 'lucide-react';

type Member = { id: string; email: string; name: string; role: string; active: boolean; createdAt: string };

export default function AdminTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'limited' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const load = async () => {
    setLoading(true);
    try { setMembers(await db.getAdminTeam()); }
    catch (e: any) { alert('Erro ao carregar equipe: ' + (e?.message ?? e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.email.trim()) { setFormError('E-mail é obrigatório'); return; }
    if (!form.name.trim()) { setFormError('Nome é obrigatório'); return; }
    setFormLoading(true);
    try {
      await db.upsertAdminTeamMember(form.email.trim(), form.name.trim(), form.role);
      setForm({ email: '', name: '', role: 'limited' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message ?? 'Erro ao salvar');
    } finally { setFormLoading(false); }
  };

  const handleToggle = async (member: Member) => {
    setActionLoading(member.email);
    try { await db.toggleAdminTeamMember(member.email); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.email);
    try { await db.deleteAdminTeamMember(deleteTarget.email); setDeleteTarget(null); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Equipe</h1>
          <p className="text-slate-500 text-sm mt-0.5">Operadores com acesso ao painel administrativo</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setShowForm(true); setFormError(''); }} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Adicionar operador
          </button>
        </div>
      </div>

      {/* Permission info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Acesso Total</p>
            <p className="text-xs text-slate-500 mt-0.5">Mesmas permissões do super admin. Pode bloquear restaurantes e acessar todas as abas.</p>
          </div>
        </div>
        <div className="card p-4 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Acesso Limitado</p>
            <p className="text-xs text-slate-500 mt-0.5">Não pode bloquear restaurantes. Sem acesso a Cobranças, Planos & Cupons e Pág. Marketing.</p>
          </div>
        </div>
      </div>

      {/* Members list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-900">
            {members.length} operador{members.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {loading ? (
          <div className="p-14 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum operador cadastrado</p>
            <p className="text-slate-400 text-xs mt-1">Adicione operadores para dar acesso ao painel</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {members.map(m => {
              const busy = actionLoading === m.email;
              return (
                <div key={m.id} className={`px-5 py-4 flex items-center gap-3 ${!m.active ? 'opacity-50' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4.5 h-4.5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{m.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.role === 'full'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {m.role === 'full' ? 'Acesso Total' : 'Limitado'}
                      </span>
                      {!m.active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Adicionado em {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(m)}
                      disabled={busy}
                      title={m.active ? 'Desativar' : 'Ativar'}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        m.active
                          ? 'hover:bg-amber-50 text-amber-500'
                          : 'hover:bg-emerald-50 text-emerald-500'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      disabled={busy}
                      title="Remover"
                      className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in p-6">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Adicionar operador</h3>
            <p className="text-xs text-slate-500 text-center mb-5">O operador deve primeiro criar uma conta no sistema com este e-mail.</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="operador@email.com"
                  className="input w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do operador"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nível de acesso</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="input w-full"
                >
                  <option value="limited">Limitado — sem bloquear, sem Cobranças/Planos/Marketing</option>
                  <option value="full">Acesso Total — mesmas permissões do super admin</option>
                </select>
              </div>

              {formError && (
                <p className="text-sm text-red-600 font-medium">{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  {formLoading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Plus className="w-4 h-4" /> Adicionar</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Remover operador</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              <strong>{deleteTarget.name}</strong> perderá o acesso ao painel imediatamente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {actionLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Trash2 className="w-4 h-4" /> Remover</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
