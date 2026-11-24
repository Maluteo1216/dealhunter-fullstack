import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
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
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isCollapsed, toggleSidebar, mobileOpen, setMobileOpen, toggleMobile } = useSidebar();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

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
  }, [location.pathname, setMobileOpen]);

  const isActive = (path: string) => location.pathname === path;

  // Renderizador del contenido para escritorio
  const renderDesktopContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Parte Superior: Botón Llama y Enlaces */}
      <div className="space-y-6">
        {/* Cabecera con botón de llama para alternar colapsado */}
        <div
          className={`flex items-center pb-4 border-b border-slate-800/80 transition-all duration-300 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
            {/* Botón interactivo de la Llama: alternar colapso con animación */}
            <button
              onClick={toggleSidebar}
              type="button"
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-md shadow-brand-500/20 hover:scale-110 active:scale-95 transition-all duration-300 shrink-0 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-brand-400"
              title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              aria-label="Alternar barra lateral"
            >
              <Flame className="w-5 h-5 text-white transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            </button>

            {/* Texto de Marca (visible solo cuando no está colapsado) */}
            {!isCollapsed && (
              <Link to="/" className="text-left overflow-hidden transition-all duration-300 min-w-0">
                <span className="text-lg font-bold tracking-tight text-white flex items-center gap-0.5 leading-tight truncate">
                  Deal<span className="text-brand-400">Hunter</span>
                </span>
                <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider truncate">
                  Price Tracker
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Sección de Navegación Principal */}
        <div className="space-y-1.5">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-opacity duration-300">
              Navegación
            </div>
          )}

          {/* Explorar Ofertas */}
          <Link
            to="/"
            title="Explorar Ofertas"
            className={`flex items-center ${
              isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
            } rounded-xl text-sm font-medium transition-all duration-200 group relative ${
              isActive('/')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  isActive('/') ? 'text-brand-400 scale-110' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!isCollapsed && <span>Explorar Ofertas</span>}
            </div>
          </Link>

          {/* Mi Wishlist */}
          <Link
            to="/wishlist"
            title="Mi Wishlist"
            className={`flex items-center ${
              isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
            } rounded-xl text-sm font-medium transition-all duration-200 group relative ${
              isActive('/wishlist')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3 relative">
              <Heart
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  isActive('/wishlist')
                    ? 'text-rose-400 fill-rose-500/20 scale-110'
                    : 'text-slate-400 group-hover:text-rose-400'
                }`}
              />
              {!isCollapsed && <span>Mi Wishlist</span>}

              {/* Indicador de alertas en modo colapsado */}
              {isCollapsed && unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
              )}
            </div>

            {/* Contador de alertas en modo expandido */}
            {!isCollapsed && unreadAlerts > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-rose-200 bg-rose-500/20 border border-rose-500/30 rounded-full animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Link>

          {/* Sincronizador API (EXCLUSIVO PARA ADMINISTRADOR) */}
          {user?.is_admin && (
            <Link
              to="/sync"
              title="Sincronizador API (Admin)"
              className={`flex items-center ${
                isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                isActive('/sync')
                  ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    isActive('/sync') ? 'text-brand-400 scale-110' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex items-center gap-1.5">
                    <span>Sincronizador API</span>
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                      Admin
                    </span>
                  </div>
                )}
              </div>
            </Link>
          )}
        </div>

        {/* Info card sutil en el sidebar */}
        {!isCollapsed ? (
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs transition-opacity duration-300">
            <div className="flex items-center gap-2 mb-1 text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CheapShark Live</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Multi-tienda oficial: Steam, Epic Games, GOG y Humble Store integradas.
            </p>
          </div>
        ) : (
          <div className="flex justify-center" title="CheapShark API Conectada">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Parte Inferior: Perfil de Usuario y Sesión */}
      <div className="pt-4 border-t border-slate-800/80">
        {isAuthenticated && user ? (
          !isCollapsed ? (
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
                  <div className="text-sm font-semibold text-slate-200 truncate flex items-center gap-1">
                    <span>{user.username}</span>
                    {user.is_admin && (
                      <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
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
            <div className="flex flex-col items-center gap-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  title={`${user.username} (${user.email})`}
                  className="w-9 h-9 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div
                  title={`${user.username} (${user.email})`}
                  className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center font-semibold text-xs"
                >
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )
        ) : !isCollapsed ? (
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition shadow-md shadow-brand-600/20"
          >
            <User className="w-4 h-4" />
            <span>Iniciar Sesión</span>
          </Link>
        ) : (
          <Link
            to="/auth"
            title="Iniciar Sesión"
            className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition shadow-md shadow-brand-600/20"
          >
            <User className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );

  // Renderizador para el drawer móvil
  const renderMobileContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white leading-tight flex items-center gap-0.5">
                Deal<span className="text-brand-400">Hunter</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Price Tracker
              </span>
            </div>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive('/')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4 text-brand-400" />
              <span>Explorar Ofertas</span>
            </div>
          </Link>

          <Link
            to="/wishlist"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive('/wishlist')
                ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Mi Wishlist</span>
            </div>
            {unreadAlerts > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-rose-200 bg-rose-500/20 border border-rose-500/30 rounded-full animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </Link>

          {user?.is_admin && (
            <Link
              to="/sync"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive('/sync')
                  ? 'bg-brand-500/15 text-brand-300 font-semibold border border-brand-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-brand-400" />
                <div className="flex items-center gap-1.5">
                  <span>Sincronizador API</span>
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    Admin
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

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
                <div className="text-sm font-semibold text-slate-200 truncate flex items-center gap-1">
                  <span>{user.username}</span>
                  {user.is_admin && (
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
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
            onClick={() => setMobileOpen(false)}
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
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleMobile}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-md shadow-brand-500/20 group active:scale-95 transition"
            title="Abrir menú"
          >
            <Flame className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          </button>
          <Link to="/">
            <span className="text-base font-bold text-white leading-tight">
              Deal<span className="text-brand-400">Hunter</span>
            </span>
            <span className="block text-[9px] text-slate-400 font-medium uppercase tracking-wider">
              Price Tracker
            </span>
          </Link>
        </div>

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
            onClick={toggleMobile}
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
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-5 flex flex-col h-full z-10 shadow-2xl">
            {renderMobileContent()}
          </aside>
        </div>
      )}

      {/* 3. Sidebar Fijo de Escritorio (>= md): Ancho dinámico w-64 o w-20 con animación fluida */}
      <aside
        className={`hidden md:flex fixed top-0 bottom-0 left-0 bg-slate-900 border-r border-slate-800 z-30 flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 p-3' : 'w-64 p-5'
        }`}
      >
        {renderDesktopContent()}
      </aside>
    </>
  );
};
