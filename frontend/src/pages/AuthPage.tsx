import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { Flame, Lock, Mail, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya está autenticado, redirigir
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        if (!username.trim()) {
          throw new Error('El nombre de usuario es obligatorio');
        }
        await register(username, email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = () => {
    navigate('/');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-400 flex items-center justify-center mx-auto shadow-md shadow-brand-500/20">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {isLoginMode ? 'Bienvenido a DealHunter' : 'Crear Cuenta en DealHunter'}
          </h1>
          <p className="text-xs text-slate-400">
            {isLoginMode
              ? 'Accede a tu lista de deseos y recibe alertas de precio'
              : 'Empieza a rastrear y comparar ofertas de videojuegos en segundos'}
          </p>
        </div>

        {/* Notificación de Error */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sección de Login Obligatorio con Google */}
        <div className="space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-center text-slate-400">
            Acceso Rápido con Google
          </label>
          <GoogleLoginButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Divisor */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider font-semibold">
            o con correo
          </span>
          <div className="border-t border-slate-800 w-full" />
        </div>

        {/* Formulario Tradicional */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre de Usuario
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="ej. gamerpro_99"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </form>

        {/* Alternar entre Login y Registro */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError(null);
            }}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
          >
            {isLoginMode
              ? '¿No tienes cuenta? Regístrate aquí'
              : '¿Ya tienes una cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};
