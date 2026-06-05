import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ChefHat, ArrowRight, AtSign, Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, register: registerFn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

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
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 gradient-mesh px-4">
      <div className="w-full max-w-[420px] animate-slide-up">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white mb-5 shadow-glow">
            <ChefHat className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cardápio Digital</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Gerencie seu menu com QR Code</p>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-elevated border border-slate-200/50 p-8">
          {/* Tabs */}
          <div className="flex bg-slate-100/80 rounded-xl p-1 mb-7">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isLogin ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${!isLogin ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Nome</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field pl-10" placeholder="Seu nome" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">E-mail</label>
              <div className="relative">
                <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field pl-10" placeholder="seu@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field pl-10" placeholder="••••••" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50/80 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-100/80 animate-scale-in">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar conta')}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {isLogin && (
            <p className="text-[11px] text-slate-400 text-center mt-5 font-medium">
              Demo: joao@exemplo.com / 123456
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
