import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../types';
import { ExternalLink, Flame, Trophy, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface GameCardProps {
  game: Game;
  isWishlisted?: boolean;
  onWishlistToggled?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, isWishlisted = false, onWishlistToggled }) => {
  const { isAuthenticated } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [isWishlisting, setIsWishlisting] = useState(false);
  const [localWishlisted, setLocalWishlisted] = useState<boolean | null>(null);

  const effectiveWishlisted = localWishlisted !== null ? localWishlisted : isWishlisted;

  const bestDeal = game.best_deal;
  const isHistoricalLow =
    bestDeal?.is_historical_low ||
    (game.historical_low_price !== undefined &&
      bestDeal !== undefined &&
      bestDeal.current_price <= game.historical_low_price);

  const handleQuickWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      alert('Inicia sesión para gestionar este juego en tu lista de deseos');
      return;
    }

    try {
      setIsWishlisting(true);
      if (effectiveWishlisted) {
        await api.removeFromWishlist(game.id);
        setLocalWishlisted(false);
      } else {
        const targetPrice = bestDeal ? bestDeal.current_price : 9.99;
        await api.addToWishlist(game.id, targetPrice);
        setLocalWishlisted(true);
      }
      onWishlistToggled?.();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar lista de deseos');
    } finally {
      setIsWishlisting(false);
    }
  };

  return (
    <div className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/50 flex flex-col">
      {/* Cover Image Container */}
      <Link to={`/game/${game.slug}`} className="relative aspect-[16/9] overflow-hidden bg-slate-950 flex items-center justify-center block group">
        {game.cover_image_url && !imageError ? (
          <>
            {/* Fondo ambiental desenfocado con los tonos de la carátula */}
            <img
              src={game.cover_image_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-md opacity-25 scale-125 pointer-events-none select-none"
            />
            {/* Portada íntegra y nítida sin recortes ni zoom forzado */}
            <img
              src={game.cover_image_url}
              alt={game.title}
              onError={() => setImageError(true)}
              className="relative z-0 max-w-full max-h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300 drop-shadow select-none"
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-500">
            <Flame className="w-10 h-10 mb-2 text-slate-700" />
            <span className="text-xs text-center font-medium line-clamp-2">{game.title}</span>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
          {bestDeal && bestDeal.discount_percentage > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
              -{Math.round(bestDeal.discount_percentage)}%
            </span>
          )}

          {isHistoricalLow && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
              <Trophy className="w-3 h-3" />
              Mínimo Histórico
            </span>
          )}
        </div>

        {/* Wishlist Button Overlay */}
        <button
          onClick={handleQuickWishlist}
          disabled={isWishlisting}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md transition z-10 ${
            effectiveWishlisted
              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'bg-slate-950/70 text-slate-400 hover:text-rose-300 hover:bg-slate-900 border border-slate-800'
          }`}
          title={effectiveWishlisted ? "Remover de Wishlist" : "Guardar en Wishlist"}
        >
          <Heart className={`w-4 h-4 ${effectiveWishlisted ? 'fill-current text-rose-400' : ''}`} />
        </button>

        {/* Store Badge */}
        {bestDeal && (
          <div className="absolute bottom-2 left-2.5 flex items-center gap-1.5 px-2 py-1 bg-slate-950/90 backdrop-blur-sm rounded-md border border-slate-800 text-[11px] text-slate-300">
            {bestDeal.store_logo && (
              <img
                src={bestDeal.store_logo}
                alt={bestDeal.store_name}
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <span className="font-medium truncate max-w-[100px]">{bestDeal.store_name}</span>
            {game.stores_count && game.stores_count > 1 && (
              <span className="text-[10px] text-brand-300 font-semibold ml-1 bg-brand-500/15 px-1.5 py-0.5 rounded border border-brand-500/25">
                +{game.stores_count - 1} tiendas
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Game Info */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <Link
            to={`/game/${game.slug}`}
            className="text-base font-semibold text-slate-100 hover:text-brand-300 line-clamp-1 transition"
            title={game.title}
          >
            {game.title}
          </Link>

          {game.publisher_name && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              {game.publisher_name}
            </div>
          )}

          {game.genres && game.genres.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {game.genres.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/70"
                >
                  {g.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {game.description || 'Consulta los precios y descuentos en tiempo real en las principales tiendas digitales.'}
            </p>
          )}
        </div>

        {/* Pricing Section */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            {bestDeal ? (
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-brand-300">
                  ${bestDeal.current_price.toFixed(2)}
                </span>
                {bestDeal.regular_price > bestDeal.current_price && (
                  <span className="text-xs text-slate-500 line-through">
                    ${bestDeal.regular_price.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-500">Sin oferta activa</span>
            )}
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider">USD MSRP</span>
          </div>

          <div className="flex items-center gap-1.5">
            {bestDeal?.product_url && (
              <a
                href={bestDeal.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-brand-300 hover:bg-slate-800 rounded-lg transition"
                title="Ir a la tienda oficial"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <Link
              to={`/game/${game.slug}`}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-brand-600 hover:text-white text-xs font-medium text-slate-200 border border-slate-700/60 transition"
            >
              {game.stores_count && game.stores_count > 1 ? `Ver ${game.stores_count} tiendas` : 'Ver tiendas'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
