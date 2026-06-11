import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { supabaseNoSession } from '../lib/supabaseNoSession';
import type { Operator } from '../lib/types';
import { Plus, Trash2, ToggleLeft, ToggleRight, Users, Shield, UtensilsCrossed, CreditCard, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, Send, Copy, Check, X, ChefHat, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../lib/planContext';
import { OPERATOR_LIMIT, PLAN_DISPLAY } from '../lib/planFeatures';

const ROLES: { value: Operator['role']; label: string; desc: string; icon: typeof Shield }[] = [
  { value: 'admin',   label: 'Admin',   desc: 'Acesso completo ao painel', icon: Shield },
  { value: 'waiter',  label: 'Garçom',  desc: 'Pedidos, mesas e cozinha', icon: UtensilsCrossed },
  { value: 'cashier', label: 'Caixa',   desc: 'Pagamentos e relatórios', icon: CreditCard },
  { value: 'kitchen', label: 'Cozinha', desc: 'Somente tela da cozinha (KDS)', icon: ChefHat },
];

const emptyForm = { email: '', name: '', role: 'waiter' as Operator['role'], notes: '', password: '' };

interface SuccessBanner { name: string; email: string; password: string }

export default function OperatorsPage() {
  const { user } = useAuth();
  const { planSlug } = usePlan();
  const navigate = useNavigate();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<SuccessBanner | null>(null);
  const [resetSent, setResetSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState('');

  const limit = OPERATOR_LIMIT[planSlug] ?? 2;
  const atLimit = limit !== -1 && operators.length >= limit;

  const load = () => { if (user) db.getOperators(user.id).then(setOperators); };
  useEffect(() => { load(); }, [user]);
  if (!user) return null;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  const save = async () => {
    if (atLimit) {
      setError(`Limite de ${limit} operador${limit !== 1 ? 'es' : ''} do plano ${PLAN_DISPLAY[planSlug]} atingido. Faça upgrade para adicionar mais.`);
      return;
    }
    if (!form.email.trim() || !form.name.trim()) { setError('Nome e e-mail são obrigatórios'); return; }
    if (form.password && form.password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres'); return; }
    setSaving(true);
    setError('');
    try {
      // 1. Create Supabase auth account (if password provided)
      if (form.password) {
        const { data, error: authErr } = await supabaseNoSession.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (authErr) {
          // Non-fatal: proceed but warn
          if (!authErr.message.toLowerCase().includes('already registered')) {
            setError('Aviso: não foi possível criar a conta de acesso — ' + authErr.message);
          }
        }
        // If identities is empty array, email is already registered
        if (data?.user && (data.user.identities?.length ?? 0) === 0) {
          setError('Este e-mail já tem uma conta. Use "Enviar link de acesso" abaixo.');
          setSaving(false);
          return;
        }
      }

      // 2. Save to operators table
      await db.addOperator(user.id, {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role,
        active: true,
        notes: form.notes,
      });

      if (form.password) setSuccess({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const sendAccessEmail = async (op: Operator) => {
    // Gera senha temporária
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const tempPwd = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      + 'A1';

    // Cria ou recria conta Auth com a senha temporária
    const { error: signupErr } = await supabaseNoSession.auth.signUp({
      email: op.email.trim().toLowerCase(),
      password: tempPwd,
    });
    if (signupErr && !signupErr.message.toLowerCase().includes('already registered')) {
      alert('Erro ao preparar conta: ' + signupErr.message);
      return;
    }

    // Recupera nome do restaurante para o e-mail
    const settings = user ? await import('../lib/db').then(m => m.db.getSettings(user.id)).catch(() => null) : null;

    // Chama Edge Function para enviar o e-mail com credenciais
    const { error: fnErr } = await supabase.functions.invoke('send-operator-email', {
      body: {
        name: op.name,
        email: op.email.trim().toLowerCase(),
        password: tempPwd,
        loginUrl: window.location.origin + '/login',
        restaurantName: settings?.name ?? '',
      },
    });

    if (fnErr) {
      alert('Erro ao enviar e-mail: ' + fnErr.message + '\n\nVerifique se a Edge Function foi publicada e o segredo RESEND_API_KEY está configurado.');
      return;
    }

    setResetSent(prev => ({ ...prev, [op.id]: true }));
  };

  const toggle = async (op: Operator) => { await db.updateOperator(op.id, { active: !op.active }); load(); };

  const del = async (id: string) => {
    if (!confirm('Remover este operador?')) return;
    await db.deleteOperator(id);
    load();
  };

  const roleInfo = (r: Operator['role']) => ROLES.find(x => x.value === r)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operadores</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            {limit === -1
              ? `${operators.length} operador${operators.length !== 1 ? 'es' : ''} cadastrado${operators.length !== 1 ? 's' : ''} — ilimitado`
              : `${operators.length} de ${limit} operador${limit !== 1 ? 'es' : ''} usados (Plano ${PLAN_DISPLAY[planSlug]})`}
          </p>
        </div>
        {atLimit ? (
          <button
            onClick={() => navigate('/upgrade?feature=operators')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl hover:bg-amber-100 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Limite atingido — Fazer upgrade
          </button>
        ) : (
          <button onClick={() => { setShowForm(s => !s); setError(''); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar operador
          </button>
        )}
      </div>

      {/* Barra de progresso do limite */}
      {limit !== -1 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Operadores utilizados</span>
            <span className={`text-xs font-bold ${atLimit ? 'text-red-600' : 'text-slate-700'}`}>
              {operators.length} / {limit}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${atLimit ? 'bg-red-500' : operators.length / limit >= 0.75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((operators.length / limit) * 100, 100)}%` }}
            />
          </div>
          {atLimit && (
            <p className="text-xs text-red-600 mt-2">
              Limite atingido.{' '}
              <button onClick={() => navigate('/upgrade?feature=operators')} className="underline font-semibold">
                Faça upgrade
              </button>{' '}
              para adicionar mais operadores.
            </p>
          )}
        </div>
      )}

      {/* Roles legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Success banner */}
      {success && (
        <div className="card p-5 border-2 border-emerald-200 bg-emerald-50/60 animate-scale-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold text-emerald-800 text-sm">Acesso criado para {success.name}!</span>
            </div>
            <button onClick={() => setSuccess(null)} className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-emerald-700 mt-2 mb-3">Passe as informações abaixo ao operador para o primeiro acesso:</p>
          <div className="space-y-2">
            {[{ label: 'URL de acesso', value: window.location.origin + '/login', key: 'url' }, { label: 'E-mail', value: success.email, key: 'email' }, { label: 'Senha', value: success.password, key: 'pwd' }].map(item => (
              <div key={item.key} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-emerald-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 flex-shrink-0">{item.label}</span>
                <span className="text-sm font-mono text-slate-800 flex-1 truncate">{item.value}</span>
                <button onClick={() => copy(item.value, item.key)} className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-500 flex-shrink-0">
                  {copied === item.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-emerald-100">
          <h3 className="font-semibold text-slate-900 text-sm">Novo operador</h3>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className={`p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all ${form.role === r.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <r.icon className={`w-4 h-4 mb-1 ${form.role === r.value ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <p className={`text-xs font-bold ${form.role === r.value ? 'text-emerald-700' : 'text-slate-700'}`}>{r.label}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Password field */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              Senha de acesso <span className="text-slate-400 normal-case font-normal">(recomendado)</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input w-full pr-10"
                placeholder="Mín. 6 caracteres"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3" />
              Defina uma senha para o operador e repasse verbalmente. Sem senha, o operador precisará se cadastrar sozinho.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observações</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input w-full" placeholder="Turno, horário, etc." />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              {saving ? 'Criando acesso...' : 'Criar acesso'}
            </button>
          </div>
        </div>
      )}

      {/* Operator list */}
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
            const hasAccess = !!op.userId;
            const sentReset = resetSent[op.id];
            return (
              <div key={op.id} className={`card p-4 flex items-center gap-4 ${!op.active ? 'opacity-50' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 relative">
                  <role.icon className="w-5 h-5 text-slate-500" />
                  {hasAccess && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{op.name}</span>
                    <span className="badge bg-slate-100 text-slate-500 text-[10px]">{role.label}</span>
                    {!op.active && <span className="badge bg-red-50 text-red-500 text-[10px]">Inativo</span>}
                    {hasAccess
                      ? <span className="badge bg-emerald-50 text-emerald-600 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5" /> Acesso ativo</span>
                      : <span className="badge bg-amber-50 text-amber-600 text-[10px]">Aguardando primeiro login</span>
                    }
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{op.email}</p>
                  {op.notes && <p className="text-xs text-slate-400">{op.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Send reset/access link */}
                  <button
                    onClick={() => sendAccessEmail(op)}
                    disabled={sentReset}
                    title={sentReset ? 'Link enviado!' : 'Enviar link de acesso por e-mail'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${sentReset ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {sentReset ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    {sentReset ? 'Enviado' : 'Enviar link'}
                  </button>
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

      {/* How-to panel */}
      <div className="card p-5 space-y-3 bg-blue-50/40 border-blue-100">
        <p className="text-sm font-semibold text-blue-900">Como funciona o acesso dos operadores</p>
        <ol className="space-y-2 text-xs text-blue-800">
          <li className="flex gap-2"><span className="font-bold text-blue-500 flex-shrink-0">1.</span> Cadastre o operador aqui definindo uma senha de acesso.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-500 flex-shrink-0">2.</span> Passe o e-mail, a senha e a URL do sistema para o operador.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-500 flex-shrink-0">3.</span> O operador acessa <strong>{window.location.origin}/login</strong> e entra com as credenciais.</li>
          <li className="flex gap-2"><span className="font-bold text-blue-500 flex-shrink-0">4.</span> O sistema detecta o role e mostra apenas as páginas permitidas para ele.</li>
        </ol>
        <p className="text-[10px] text-blue-600 border-t border-blue-100 pt-2">
          <strong>Dica:</strong> No Supabase → Authentication → Settings → desative "Confirm email" para que o operador acesse imediatamente sem precisar confirmar e-mail.
        </p>
      </div>
    </div>
  );
}
