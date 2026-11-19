import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { PriceAlert } from '../types';
import {
  Flame,
  Heart,
  RefreshCw,
  Compass,
  LogOut,
  User,
  Menu,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Cargar contador de alertas no leídas
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

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  // Renderizador del contenido del menú de navegación
  const navContent = (
    <div className="flex flex-col h-full justify-between">
      {/* Parte Superior: Marca y Enlaces */}
      <div className="space-y-6">
        {/* Logo y Nombre en la parte superior izquierda */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition shrink-0">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-0.5 leading-tight">
                Deal<span className="text-brand-400">Hunter</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Price Tracker
              </span>
            </div>
          </Link>

          {/* Botón cerrar para vista móvil */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sección de Navegación Principal */}
        <div className="space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navegación
          </div>

          {/* Explorar Ofertas */}
          <Link
            to="/"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition group ${
              isActive('/')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass
                className={`w-4 h-4 transition ${
                  isActive('/') ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Explorar Ofertas</span>
            </div>
          </Link>

          {/* Mi Wishlist */}
          <Link
            to="/wishlist"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition group ${
              isActive('/wishlist')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Heart
                className={`w-4 h-4 transition ${
                  isActive('/wishlist')
                    ? 'text-rose-400 fill-rose-500/20'
                    : 'text-slate-400 group-hover:text-rose-400'
                }`}
              />
              <span>Mi Wishlist</span>
            </div>
            {unreadAlerts > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-rose-200 bg-rose-500/20 border border-rose-500/30 rounded-full animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Link>

          {/* Sincronizador API */}
          <Link
            to="/sync"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition group ${
              isActive('/sync')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <RefreshCw
                className={`w-4 h-4 transition ${
                  isActive('/sync') ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span>Sincronizador API</span>
            </div>
          </Link>
        </div>

        {/* Info card sutil en el sidebar */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 mb-1 text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CheapShark Live</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Multi-tienda oficial: Steam, Epic Games, GOG y Humble Store integradas.
          </p>
        </div>
      </div>

      {/* Parte Inferior: Perfil de Usuario y Sesión */}
      <div className="pt-4 border-t border-slate-800/80">
        {isAuthenticated && user ? (
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-9 h-9 rounded-full border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center font-semibold text-xs shrink-0">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold text-slate-200 truncate">
                  {user.username}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-md shadow-brand-600/20"
          >
            <User className="w-4 h-4" />
            <span>Iniciar Sesión</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Header Móvil (< md): Barra superior compacta con logo y botón hamburguesa */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white leading-tight">
              Deal<span className="text-brand-400">Hunter</span>
            </span>
            <span className="block text-[9px] text-slate-400 font-medium uppercase tracking-wider">
              Price Tracker
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated && unreadAlerts > 0 && (
            <Link
              to="/wishlist"
              className="p-2 text-rose-400 hover:bg-slate-800 rounded-lg relative"
              title="Alertas de precios"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* 2. Drawer Móvil con Backdrop */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop oscurecido */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Panel Lateral Desplegable */}
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-5 flex flex-col h-full z-10 shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}

      {/* 3. Sidebar Fijo de Escritorio (>= md): Izquierda fija con ancho w-64 */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-30 flex-col p-5">
        {navContent}
      </aside>
    </>
  );
};
