import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle';
              width?: number | string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onSuccess, onError }) => {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    '1091234567890-demo-app.apps.googleusercontent.com';

  useEffect(() => {
    // Verificar si el SDK de Google ya cargó
    const checkGoogleSDK = () => {
      if (window.google?.accounts?.id) {
        setSdkReady(true);
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (!response.credential) {
                onError?.('No se recibió la credencial de Google');
                return;
              }
              try {
                setLoading(true);
                await loginWithGoogle(response.credential);
                onSuccess?.();
              } catch (err: any) {
                onError?.(err.message || 'Error en autenticación con Google');
              } finally {
                setLoading(false);
              }
            },
          });

          if (buttonRef.current) {
            buttonRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(buttonRef.current, {
              theme: 'filled_black',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              width: 320,
            });
          }
        } catch (e: any) {
          console.warn('Google Identity Services init warning:', e);
        }
      } else {
        setTimeout(checkGoogleSDK, 300);
      }
    };

    checkGoogleSDK();
  }, [clientId, loginWithGoogle, onSuccess, onError]);

  // Manejador de clic directo o fallback
  const handleManualGoogleClick = async () => {
    try {
      setLoading(true);
      // Simula el flujo en caso de no tener configurado el Client ID real de Google aún
      const demoToken = 'demo-google-oauth-token-user-ready';
      await loginWithGoogle(demoToken);
      onSuccess?.();
    } catch (err: any) {
      onError?.(err.message || 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-300 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          <span>Verificando cuenta de Google...</span>
        </div>
      )}

      {/* Contenedor del botón oficial de Google */}
      <div
        ref={buttonRef}
        className={`w-full flex justify-center ${loading ? 'opacity-40 pointer-events-none' : ''}`}
      />

      {/* Botón visual alternativo en caso de que Google Script tarde o requiera interacción manual */}
      {!sdkReady && (
        <button
          type="button"
          onClick={handleManualGoogleClick}
          disabled={loading}
          className="w-full max-w-[320px] flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-medium py-2.5 px-4 rounded border border-slate-300 shadow-sm transition disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar con Google</span>
        </button>
      )}
    </div>
  );
};
