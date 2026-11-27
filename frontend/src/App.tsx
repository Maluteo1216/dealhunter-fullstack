import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ServerStatusProvider, useServerStatus } from './context/ServerStatusContext';
import { ServerWakeBanner } from './components/ServerWakeBanner';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { GameDetailPage } from './pages/GameDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { SyncAdminPage } from './pages/SyncAdminPage';
import { AuthPage } from './pages/AuthPage';

const ServerStatusBadge: React.FC = () => {
  const { isAwake } = useServerStatus();

  return (
    <div
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-lg text-xs font-semibold select-none"
      title={isAwake ? 'Servidor conectado' : 'Servidor iniciando o desconectado'}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          isAwake
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
            : 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.7)] animate-pulse'
        }`}
      />
      <span className={isAwake ? 'text-emerald-300' : 'text-orange-300'}>
        {isAwake ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white">
      <Navbar />
      <ServerWakeBanner />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:slug" element={<GameDetailPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/sync" element={<SyncAdminPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <ServerStatusBadge />

      <footer className="bg-slate-900 border-t border-slate-800 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <p className="flex items-center gap-1.5 text-slate-400">
            Datos de ofertas impulsados por{' '}
            <a
              href="https://www.cheapshark.com/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline font-medium"
            >
              CheapShark API
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ServerStatusProvider>
      <AuthProvider>
        <Router>
          <AppLayout />
        </Router>
      </AuthProvider>
    </ServerStatusProvider>
  );
};

export default App;
