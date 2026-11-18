import React, { useEffect, useState, useTransition } from 'react';
import { api } from '../api/client';
import { Game, Store } from '../types';
import { GameCard } from '../components/GameCard';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Flame,
  Percent,
  DollarSign,
  Store as StoreIcon,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [minDiscount, setMinDiscount] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<string>('discount');
  const [page, setPage] = useState<number>(1);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(search);
        setPage(1);
      });
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Cargar lista de tiendas al montar
  useEffect(() => {
    api
      .getStores()
      .then(setStores)
      .catch((err) => console.warn('No se pudieron cargar las tiendas:', err));
  }, []);

  // Cargar lista de IDs en lista de deseos del usuario
  const loadWishlistIds = async () => {
    if (!isAuthenticated) {
      setWishlistIds(new Set());
      return;
    }
    try {
      const items = await api.getWishlist();
      setWishlistIds(new Set(items.map((it) => it.game_id)));
    } catch {
      // Ignorar si no está autenticado
    }
  };

  useEffect(() => {
    loadWishlistIds();
  }, [isAuthenticated]);

  // Cargar catálogo de ofertas
  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await api.getGames({
        search: debouncedSearch || undefined,
        store: selectedStore || undefined,
        min_discount: minDiscount,
        max_price: maxPrice,
        sort,
        page,
        limit: 18,
      });
      setGames(res.games || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error('Error al cargar juegos:', err);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [debouncedSearch, selectedStore, minDiscount, maxPrice, sort, page]);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedStore('');
    setMinDiscount(undefined);
    setMaxPrice(undefined);
    setSort('discount');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    Boolean(selectedStore) ||
    minDiscount !== undefined ||
    maxPrice !== undefined ||
    sort !== 'discount';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 md:p-10 mb-8 overflow-hidden shadow-2xl">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Monitoreo en Tiempo Real vía CheapShark API
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Encuentra las mejores ofertas de videojuegos.
          </h1>
          <p className="mt-3 text-base text-slate-300">
            Compara precios entre Steam, Epic Games, GOG, Fanatical y más. Registra alertas y no vuelvas a pagar de más.
          </p>
        </div>
      </div>

      {/* Controles Principales: Búsqueda y Botón Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Barra de Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título (ej. Cyberpunk, Witcher, Elden Ring, Resident Evil)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Ordenamiento */}
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
            >
              <option value="discount">Mayor Descuento (%)</option>
              <option value="price">Menor Precio ($)</option>
              <option value="price_desc">Mayor Precio ($)</option>
              <option value="newest">Más Recientes</option>
              <option value="title">Título (A-Z)</option>
            </select>

            {/* Alternar Filtros Avanzados */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                showFilters || hasActiveFilters
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filtros</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-brand-400" />
              )}
            </button>
          </div>
        </div>

        {/* Panel Desplegable de Filtros */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Filtro de Tienda */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <StoreIcon className="w-3.5 h-3.5 text-brand-400" /> Tienda Digital
              </label>
              <select
                value={selectedStore}
                onChange={(e) => {
                  setSelectedStore(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="">Todas las tiendas</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.external_store_id}>
                    {s.name} ({s.deals_count} ofertas)
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Descuento Mínimo */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-brand-400" /> Descuento Mínimo
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Todos', value: undefined },
                  { label: '>25%', value: 25 },
                  { label: '>50%', value: 50 },
                  { label: '>75%', value: 75 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMinDiscount(minDiscount === item.value ? undefined : item.value);
                      setPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded border transition ${
                      minDiscount === item.value
                        ? 'bg-brand-600 border-brand-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro de Precio Máximo */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-brand-400" /> Precio Máximo
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Todos', value: undefined },
                  { label: '<$5', value: 5 },
                  { label: '<$10', value: 10 },
                  { label: '<$20', value: 20 },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMaxPrice(maxPrice === item.value ? undefined : item.value);
                      setPage(1);
                    }}
                    className={`py-1.5 text-xs font-medium rounded border transition ${
                      maxPrice === item.value
                        ? 'bg-brand-600 border-brand-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón Restaurar Filtros */}
            {hasActiveFilters && (
              <div className="sm:col-span-3 flex justify-end">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium py-1 px-2 rounded hover:bg-rose-950/30 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer todos los filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chips de Filtros Activos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 font-medium">Filtros activos:</span>
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                Título: "{debouncedSearch}"
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="hover:text-rose-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStore && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                Tienda: {stores.find((s) => s.external_store_id === selectedStore)?.name || selectedStore}
                <button onClick={() => { setSelectedStore(''); setPage(1); }} className="hover:text-rose-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {minDiscount !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                Descuento: &gt;{minDiscount}%
                <button onClick={() => { setMinDiscount(undefined); setPage(1); }} className="hover:text-rose-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {maxPrice !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                Precio: &lt;${maxPrice}
                <button onClick={() => { setMaxPrice(undefined); setPage(1); }} className="hover:text-rose-400 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-rose-400 hover:text-rose-300 font-semibold underline text-xs ml-auto"
            >
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      {/* Resultados y Conteo */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Flame className="w-5 h-5 text-brand-400" />
          Ofertas Destacadas
          <span className="text-xs font-normal text-slate-400">
            ({total} títulos encontrados)
          </span>
        </h2>
      </div>

      {/* Grid de Videojuegos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-80 rounded-xl bg-slate-900 border border-slate-800 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="w-full aspect-[16/9] bg-slate-800 rounded-lg" />
              <div className="space-y-2 mt-4">
                <div className="h-4 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="h-8 bg-slate-800 rounded w-full mt-4" />
            </div>
          ))}
        </div>
      ) : games.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isWishlisted={wishlistIds.has(game.id)}
              onWishlistToggled={loadWishlistIds}
            />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">
            No se encontraron videojuegos
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Intenta cambiar los términos de búsqueda o ajusta los filtros aplicados.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-semibold transition"
          >
            Limpiar Filtros
          </button>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          <span className="text-sm text-slate-400 px-2 font-medium">
            Página <strong className="text-slate-200">{page}</strong> de{' '}
            <strong className="text-slate-200">{totalPages}</strong>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
