import React from 'react';
import { useServerStatus } from '../context/ServerStatusContext';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ServerWakeBanner: React.FC = () => {
  const { isAwake, isChecking, dbStatus, checkHealth } = useServerStatus();

  if (isAwake && dbStatus === 'connected') {
    return null; // Todo en orden, no mostrar banner
  }

  return (
    <div className="bg-amber-950/80 border-b border-amber-600/40 text-amber-200 px-4 py-2.5 text-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isAwake ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>
            {!isAwake ? (
              <>
                <strong className="font-semibold text-amber-300">Despertando servidor backend en Render:</strong> El servicio gratuito puede tomar entre 30 y 50 segundos en arrancar en frío...
              </>
            ) : (
              <>
                <strong className="font-semibold text-amber-300">Base de datos en espera:</strong> Conectando con PostgreSQL en Neon.tech...
              </>
            )}
          </span>
        </div>

        <button
          onClick={() => checkHealth()}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded text-xs font-medium border border-amber-500/40 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Verificando...' : 'Reintentar ahora'}
        </button>
      </div>
    </div>
  );
};
