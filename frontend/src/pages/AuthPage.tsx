import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { Flame, AlertCircle } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Si ya está autenticado, redirigir al inicio
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

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
            Bienvenido a DealHunter
          </h1>
          <p className="text-xs text-slate-400">
            Inicia sesión con tu cuenta de Google para gestionar tu lista de deseos y recibir alertas de precio por correo.
          </p>
        </div>

        {/* Notificación de Error */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inicio de Sesión Exclusivo con Google */}
        <div className="space-y-3 pt-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-center text-slate-400">
            Acceso con Google
          </label>
          <GoogleLoginButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />
        </div>
      </div>
    </div>
  );
};
