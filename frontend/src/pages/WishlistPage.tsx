import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { WishlistItem, PriceAlert } from '../types';
import {
  Heart,
  Bell,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  MailCheck,
} from 'lucide-react';

export const WishlistPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTargetPrice, setNewTargetPrice] = useState<string>('');

  const loadData = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [wData, aData] = await Promise.all([
        api.getWishlist(),
        api.getAlerts(),
      ]);
      setWishlist(wData);
      setAlerts(aData);
    } catch (err) {
      console.error('Error al cargar datos de wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const handleRemove = async (gameId: number) => {
    if (!confirm('¿Deseas remover este juego de tu lista de deseos?')) return;
    try {
      await api.removeFromWishlist(gameId);
      setWishlist((prev) => prev.filter((item) => item.game_id !== gameId));
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleUpdatePrice = async (gameId: number) => {
    const priceNum = parseFloat(newTargetPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Por favor ingresa un precio válido (desde $0.00 en adelante)');
      return;
    }

    try {
      await api.addToWishlist(gameId, priceNum);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar');
    }
  };

  const handleMarkAlertRead = async (alertId: number) => {
    try {
      await api.markAlertRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
    } catch (err) {
      console.error('Error al marcar alerta como leída:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Heart className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Tu Lista de Deseos</h2>
          <p className="text-sm text-slate-400 mb-6">
            Inicia sesión o regístrate para guardar juegos, definir tu precio ideal y recibir alertas cuando bajen de precio.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-brand-600/20"
          >
            Iniciar Sesión / Registro
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Flecha de regreso */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al catálogo
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Heart className="w-8 h-8 text-rose-500 fill-current" />
            Mi Lista de Deseos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitoreo activo de juegos favoritos y precios objetivo.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
        >
          <Sparkles className="w-4 h-4 text-brand-400" />
          Explorar más ofertas
        </Link>
      </div>

      {/* Bandeja de Alertas Disparadas */}
      {alerts.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Alertas de Descuento Recientes
              </h2>
            </div>
            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              {alerts.filter((a) => !a.is_read).length} sin leer
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                  alert.is_read
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                    : 'bg-amber-950/20 border-amber-600/40 text-amber-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {alert.game_title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {alert.store_name}
                    </span>
                    {alert.email_sent && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <MailCheck className="w-3 h-3" />
                        Correo enviado
                      </span>
                    )}
                  </div>
                  <p className="text-xs">{alert.message}</p>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(alert.triggered_at).toLocaleString('es-ES')}
                  </span>
                </div>

                {!alert.is_read && (
                  <button
                    onClick={() => handleMarkAlertRead(alert.id)}
                    className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 text-xs font-medium shrink-0 transition"
                    title="Marcar como leída"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Juegos Trackeados */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400 mb-2" />
          <p className="text-sm text-slate-400">Cargando tu lista de deseos...</p>
        </div>
      ) : wishlist.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Heart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-200 mb-2">Tu lista está vacía</h3>
          <p className="text-sm text-slate-400 mb-6">
            Agrega juegos desde el explorador haciendo clic en el icono del corazón o en la ficha de detalle para fijar tu precio objetivo.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition"
          >
            Buscar videojuegos en oferta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlist.map((item) => {
            const hasMetTarget =
              item.current_best_price !== undefined &&
              item.current_best_price !== null &&
              item.current_best_price <= item.target_price;

            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  {/* Imagen y Estado */}
                  <div className="relative aspect-[16/9] bg-slate-950 overflow-hidden flex items-center justify-center">
                    {item.game_cover ? (
                      <>
                        <img
                          src={item.game_cover}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-125 pointer-events-none select-none"
                        />
                        <img
                          src={item.game_cover}
                          alt={item.game_title}
                          className="relative z-0 max-w-full max-h-full object-contain p-1.5 drop-shadow select-none"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-bold">
                        {item.game_title}
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5">
                      {hasMetTarget ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs backdrop-blur-sm">
                          <CheckCircle className="w-3.5 h-3.5" />
                          ¡Objetivo Cumplido!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-300 font-medium text-xs">
                          Esperando descuento
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemove(item.game_id)}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-950/70 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                      title="Eliminar de Wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contenido */}
                  <div className="p-4 space-y-3">
                    <Link
                      to={`/game/${item.game_slug}`}
                      className="text-base font-bold text-slate-100 hover:text-brand-400 line-clamp-1 transition"
                    >
                      {item.game_title}
                    </Link>

                    {/* Precios Comparativos */}
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 block">Mejor Precio Actual</span>
                        {item.current_best_price !== undefined && item.current_best_price !== null ? (
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-bold text-sm text-brand-400">
                              ${item.current_best_price.toFixed(2)}
                            </span>
                            {item.store_name && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[70px]">
                                ({item.store_name})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-medium">Sin stock</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 block">Precio Objetivo</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newTargetPrice}
                              onChange={(e) => setNewTargetPrice(e.target.value)}
                              className="w-16 px-1.5 py-0.5 bg-slate-900 border border-brand-500 rounded text-xs text-white"
                            />
                            <button
                              onClick={() => handleUpdatePrice(item.game_id)}
                              className="px-1.5 py-0.5 bg-brand-600 text-white rounded text-[10px] font-bold"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="font-bold text-sm text-amber-300">
                              ${item.target_price.toFixed(2)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setNewTargetPrice(item.target_price.toString());
                              }}
                              className="text-[10px] text-brand-400 hover:underline"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer de Tarjeta */}
                <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-slate-800/60 mt-2">
                  <Link
                    to={`/game/${item.game_slug}`}
                    className="text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    Ver comparador
                  </Link>

                  {item.product_url && (
                    <a
                      href={item.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition"
                    >
                      <span>Ir a la tienda</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
