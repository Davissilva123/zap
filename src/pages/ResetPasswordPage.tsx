import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Zap, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    // Supabase processa o token do hash da URL automaticamente
    // e dispara o evento PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true);
      }
    });

    // Fallback: verifica se já existe sessão ativa (token já processado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // Se após 8s ainda não tiver sessão, o link é inválido/expirado
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setInvalidLink(true);
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (err) {
      setError('Erro ao atualizar a senha. O link pode ter expirado — solicite um novo.');
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/login'), 3000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-xl tracking-tight">ZapMenu</span>
        </div>

        <div className="card p-6">
          {done ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-900 mb-2">Senha redefinida com sucesso!</p>
              <p className="text-sm text-slate-500">Redirecionando para o login...</p>
            </div>
          ) : invalidLink ? (
            <div className="text-center py-6">
              <p className="font-bold text-slate-900 mb-2">Link inválido ou expirado</p>
              <p className="text-sm text-slate-500 mb-5">
                Este link de recuperação não é mais válido. Solicite um novo.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full py-3 text-sm"
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-900 mb-1">Redefinir senha</h1>
              <p className="text-sm text-slate-500 mb-6">
                Digite e confirme sua nova senha abaixo.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input-field pl-10 pr-10 w-full"
                      placeholder="Mínimo 6 caracteres"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="input-field pl-10 pr-10 w-full"
                      placeholder="Repita a nova senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !sessionReady || !password || !confirm}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : sessionReady ? 'Salvar nova senha' : 'Verificando link...'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Lembrou a senha?{' '}
          <button onClick={() => navigate('/login')} className="text-emerald-600 hover:underline font-medium">
            Voltar ao login
          </button>
        </p>
      </div>
    </div>
  );
}
