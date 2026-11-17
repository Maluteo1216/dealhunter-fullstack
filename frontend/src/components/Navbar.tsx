import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PriceAlert } from '../types';
import {
  Flame,
  Heart,
  RefreshCw,
  Bell,
  LogOut,
  User,
  Compass,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated) {
      api
        .getAlerts()
        .then((alerts: PriceAlert[]) => {
          const unread = alerts.filter((a) => !a.is_read).length;
          setUnreadAlerts(unread);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
              Deal<span className="text-brand-400">Hunter</span>
            </span>
            <span className="block text-[10px] text-slate-400 -mt-1 font-medium uppercase tracking-wider">
              Price Tracker
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isActive('/')
                ? 'bg-slate-800 text-brand-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            Explorar Ofertas
          </Link>

          <Link
            to="/wishlist"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition relative ${
              isActive('/wishlist')
                ? 'bg-slate-800 text-brand-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Heart className="w-4 h-4" />
            Mi Wishlist
            {unreadAlerts > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-rose-600 rounded-full animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Link>

          <Link
            to="/sync"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isActive('/sync')
                ? 'bg-slate-800 text-brand-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizador API
          </Link>
        </nav>

        {/* User Auth Controls */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/wishlist"
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Notificaciones de precios"
              >
                <Bell className="w-5 h-5" />
                {unreadAlerts > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900" />
                )}
              </Link>

              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-semibold text-xs">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-slate-200 leading-tight">
                    {user.username}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-lg shadow-brand-600/20"
              >
                <User className="w-4 h-4" />
                Iniciar Sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
