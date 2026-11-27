import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PriceAlert } from '../types';
import {
  Flame,
  Heart,
  RefreshCw,
  LogOut,
  ChevronDown,
  LogIn,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar contador de alertas de wishlist no leídas
  useEffect(() => {
    if (isAuthenticated) {
      api
        .getAlerts()
        .then((alerts: PriceAlert[]) => {
          const unread = alerts.filter((a) => !a.is_read).length;
          setUnreadAlerts(unread);
        })
        .catch(() => {});
    } else {
      setUnreadAlerts(0);
    }
  }, [isAuthenticated, location.pathname]);

  // Cerrar dropdown al cambiar de ruta
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Arriba a la Izquierda: Título y Logo de la Página */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform duration-200">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center">
              Deal<span className="text-brand-400">Hunter</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-none">
              Price Tracker
            </span>
          </div>
        </Link>

        {/* Arriba a la Derecha: Cuenta de Usuario con Dropdown */}
        <div className="relative" ref={dropdownRef}>
          {isAuthenticated && user ? (
            <>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                {/* Avatar con Burbuja Flotante de Notificaciones */}
                <div className="relative shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center font-semibold text-xs">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {unreadAlerts > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-extrabold ring-2 ring-slate-900 shadow-md"
                      title={`${unreadAlerts} notificaciones de wishlist sin leer`}
                    >
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </span>
                  )}
                </div>

                <span className="hidden sm:inline text-sm font-medium text-slate-200 max-w-[140px] truncate">
                  {user.username}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Menú Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 py-2 z-50 overflow-hidden">
                  {/* Cabecera del Dropdown */}
                  <div className="px-4 py-3 border-b border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {user.username}
                      </span>
                      {user.is_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {user.email}
                    </div>
                  </div>

                  {/* Opciones */}
                  <div className="py-1.5">
                    <Link
                      to="/wishlist"
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white transition"
                    >
                      <span className="flex items-center gap-2.5">
                        <Heart className="w-4 h-4 text-rose-400" />
                        <span>Mi Wishlist</span>
                      </span>
                      {unreadAlerts > 0 && (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {unreadAlerts}
                        </span>
                      )}
                    </Link>

                    {user.is_admin && (
                      <Link
                        to="/sync"
                        className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white transition"
                      >
                        <span className="flex items-center gap-2.5">
                          <RefreshCw className="w-4 h-4 text-brand-400" />
                          <span>Sincronizar API</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                          Admin
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Cerrar Sesión */}
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition shadow-md shadow-brand-600/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
