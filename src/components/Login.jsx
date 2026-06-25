import { useState } from 'react';
import { supabase, isMock } from '../supabaseClient';
import { BookOpen, Key, Mail, ShieldAlert, Sparkles } from 'lucide-react';

export default function Login({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data?.user) {
          onAuthSuccess(data.user);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data?.user) {
          onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'editor@somosnoveli.cl',
        password: 'demo-password-123',
      });
      if (signInError) throw signInError;
      if (data?.user) {
        onAuthSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión de demostración.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-brand-700/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"></div>
      
      <div className="w-full max-w-md space-y-8 glass p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-2xl text-brand-400 mb-4 border border-brand-500/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white font-sans">
            Somos Noveli
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            CRM Administrativo para Editorial
          </p>
        </div>

        {isMock && (
          <div className="bg-brand-950/40 border border-brand-500/30 rounded-xl p-4 text-xs text-brand-200 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-brand-300 mb-1">¡Modo Demo Activo!</p>
              <p className="leading-relaxed">
                El CRM está corriendo con una base de datos local en tu navegador. Puedes ingresar con cualquier correo y contraseña inventados o presionar el botón de demo rápida.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/50 border border-red-500/30 text-red-200 rounded-xl p-4 text-xs flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 bg-slate-950/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  placeholder="ejemplo@somosnoveli.cl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 bg-slate-950/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-brand-600/30"
            >
              {loading ? 'Cargando...' : isSignUp ? 'Registrarse' : 'Iniciar Sesión'}
            </button>

            {isMock && (
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-slate-700 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800/50 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                Acceso Rápido Demo
              </button>
            )}
          </div>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-brand-400 hover:underline cursor-pointer transition-colors"
          >
            {isSignUp ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}
