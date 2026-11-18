import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { GameDetail } from '../types';
import { StoreTable } from '../components/StoreTable';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  ExternalLink,
  Flame,
  Globe2,
  Heart,
  Loader2,
  Trophy,
  DollarSign,
  Info,
  RefreshCw,
} from 'lucide-react';

export const GameDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Widget de Wishlist
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [wishlistSuccess, setWishlistSuccess] = useState<boolean>(false);
  const [wishlistLoading, setWishlistLoading] = useState<boolean>(false);
  const [isSearchingStores, setIsSearchingStores] = useState<boolean>(false);

  const handleEnrichGame = async () => {
    if (!slug) return;
    setIsSearchingStores(true);
    try {
      await api.enrichSingleGame(slug);
      const data = await api.getGameBySlug(slug);
      setDetail(data);
    } catch (err: any) {
      alert(err.message || 'No se pudieron buscar más tiendas para este juego');
    } finally {
      setIsSearchingStores(false);
    }
  };

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    api
      .getGameBySlug(slug)
      .then((data) => {
        setDetail(data);
        if (data.current_prices.length > 0) {
          const minPrice = Math.min(...data.current_prices.map((p) => p.current_price));
          // Sugerir como precio objetivo el precio más bajo actual o un 20% menos
          setTargetPrice((minPrice * 0.8).toFixed(2));
        } else {
          setTargetPrice('9.99');
        }
      })
      .catch((err) => {
        setError(err.message || 'No se pudo cargar la información del videojuego');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  const handleSaveWishlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Debes iniciar sesión con tu cuenta para configurar alertas de precio');
      return;
    }

    if (!detail) return;

    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Por favor ingresa un precio objetivo válido mayor a cero');
      return;
    }

    try {
      setWishlistLoading(true);
      await api.addToWishlist(detail.game.id, priceNum);
      setWishlistSuccess(true);
      setTimeout(() => setWishlistSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Error al guardar alerta');
    } finally {
      setWishlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-3" />
        <p className="text-slate-400 font-medium text-sm">Cargando precios y comparativa...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10">
          <Flame className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Videojuego no encontrado</h2>
          <p className="text-slate-400 mb-6">{error || 'El juego que buscas no está disponible en la base de datos.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const { game, current_prices, price_history } = detail;
  const bestCurrentPrice = current_prices.length > 0 ? current_prices[0] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Botón de regreso */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a todas las ofertas
      </Link>

      {/* Cabecera Principal del Videojuego */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row gap-8 items-start shadow-xl">
        {/* Portada */}
        <div className="w-full lg:w-96 aspect-[16/9] lg:aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative group">
          {game.cover_image_url ? (
            <img
              src={game.cover_image_url}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600 font-bold">
              {game.title}
            </div>
          )}
        </div>

        {/* Información y Mejor Precio */}
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {game.title}
            </h1>
            {game.publisher_name && (
              <p className="text-sm text-slate-400">
                Distribuidor / Editor: <strong className="text-slate-200">{game.publisher_name}</strong>
              </p>
            )}
          </div>

          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
            {game.description ||
              'Monitoriza y compara en tiempo real el precio de este videojuego a través de tiendas digitales oficiales, asegurando el mejor descuento disponible.'}
          </p>

          {/* Mínimo Histórico */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {game.historical_low_price !== undefined && game.historical_low_price !== null && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>
                  Mínimo Histórico Registrado: ${game.historical_low_price.toFixed(2)} USD
                  {game.historical_low_date && (
                    <span className="text-amber-400/80 font-normal ml-1">
                      ({new Date(game.historical_low_date).toLocaleDateString('es-ES')})
                    </span>
                  )}
                </span>
              </div>
            )}

            {game.steam_app_id && (
              <a
                href={`https://store.steampowered.com/app/${game.steam_app_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              >
                <span>Ficha en Steam Store</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Widget de Alerta / Wishlist */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-w-lg">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-brand-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Configurar Alerta de Precio (Wishlist)
                </h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Te notificaremos cuando el juego baje o alcance este precio en cualquiera de las tiendas.
              </p>

              <form onSubmit={handleSaveWishlist} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.50"
                    placeholder="Ej. 14.99"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={wishlistLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-brand-600/20 disabled:opacity-50"
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  {wishlistLoading ? 'Guardando...' : 'Guardar Alerta'}
                </button>
              </form>

              {wishlistSuccess && (
                <div className="mt-2 text-xs text-brand-400 font-medium flex items-center gap-1.5 animate-fadeIn">
                  <CheckCircle className="w-3.5 h-3.5" />
                  ¡Alerta guardada! Te avisaremos si el precio cumple tu objetivo.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nota Informativa de Precios Regionales Obligatoria */}
      <div className="bg-sky-950/40 border border-sky-800/50 rounded-xl p-4 text-sky-200 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-semibold text-sky-300">
            Aviso de Precios y Ajuste Regional (US MSRP):
          </strong>
          <p className="text-sky-200/90 leading-relaxed">
            Los precios y descuentos mostrados están expresados en <strong>Dólares Estadounidenses (US MSRP)</strong> provistos por CheapShark API. Al hacer clic en <em>"Ir a la oferta"</em> y acceder a la tienda oficial desde tu país (por ejemplo, en Latinoamérica), la tienda puede aplicar automáticamente su tasa de precio regional, manteniendo o mejorando el porcentaje de descuento indicado.
          </p>
        </div>
      </div>

      {/* Tabla Comparativa de Tiendas Oficiales */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-brand-400" />
            <h2 className="text-xl font-bold text-slate-100">
              Comparativa de Precios en Tiendas Oficiales
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              ({current_prices.length} tiendas disponibles)
            </span>
          </div>

          <button
            onClick={handleEnrichGame}
            disabled={isSearchingStores}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 hover:text-brand-300 text-xs font-semibold border border-slate-700 transition disabled:opacity-50 self-start sm:self-auto"
            title="Consulta CheapShark API en tiempo real para encontrar ofertas en otras tiendas oficiales"
          >
            {isSearchingStores ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Buscando tiendas en CheapShark...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Buscar en Más Tiendas
              </>
            )}
          </button>
        </div>

        <StoreTable
          prices={current_prices}
          historicalLowPrice={game.historical_low_price}
        />
      </div>

      {/* Gráfica de Serie Temporal (Recharts) */}
      <div className="space-y-4">
        <PriceHistoryChart history={price_history} />
      </div>
    </div>
  );
};
