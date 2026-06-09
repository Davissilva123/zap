import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ArrowRight, AtSign, Lock, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com';

export default function LoginPage() {
  const { login, register: registerFn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLogin, setIsLogin] = useState(() => !new URLSearchParams(window.location.search).has('register'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    if (isLogin) {
      const err = await login(email, password);
      if (err) { setError(err); setSubmitting(false); return; }
    } else {
      const err = await registerFn(name, email, password);
      if (err) { setError(err); setSubmitting(false); return; }
    }
    // Super admin vai direto para o painel admin
    navigate(email.trim().toLowerCase() === SUPER_ADMIN_EMAIL ? '/admin' : '/dashboard');
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#0d1117] p-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">ZapMenu</span>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
            <span className="text-emerald-400 text-xs font-semibold tracking-wide">Cardápio digital inteligente</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Seu restaurante,<br />no mundo digital.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Crie seu cardápio digital, gere QR Codes e receba pedidos com pagamento via PIX — tudo em um só lugar.
          </p>
        </div>

        <p className="text-slate-600 text-xs">© 2025 ZapMenu. Todos os direitos reservados.</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Zap className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">ZapMenu</span>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {isLogin ? 'Entre com seus dados para acessar o painel' : 'Preencha os dados para começar'}
            </p>
          </div>

          <div className="card p-6">
            {/* Tabs */}
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${!isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field pl-10" placeholder="Seu nome" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">E-mail</label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field pl-10" placeholder="seu@email.com" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field pl-10" placeholder="••••••••" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar conta')}
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
