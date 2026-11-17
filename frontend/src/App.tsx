import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ServerStatusProvider } from './context/ServerStatusContext';
import { ServerWakeBanner } from './components/ServerWakeBanner';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { GameDetailPage } from './pages/GameDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { SyncAdminPage } from './pages/SyncAdminPage';
import { AuthPage } from './pages/AuthPage';

export const App: React.FC = () => {
  return (
    <ServerStatusProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white">
            <ServerWakeBanner />
            <Navbar />

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

            <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-500">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <p>
                  © {new Date().getFullYear()} DealHunter — Plataforma de Rastreo de Precios inspirada en IsThereAnyDeal.
                </p>
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
        </Router>
      </AuthProvider>
    </ServerStatusProvider>
  );
};

export default App;
