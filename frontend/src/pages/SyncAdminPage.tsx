import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SyncLog, CheapSharkDeal, CheapSharkStore } from '../types';
import {
  RefreshCw,
  Server,
  CheckCircle,
  AlertTriangle,
  History,
  Loader2,
  Shuffle,
  Sparkles,
  ShieldAlert,
  ArrowLeft,
  Trash2,
  Layers,
  CheckCheck,
} from 'lucide-react';

export const SyncAdminPage: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [syncingRandom, setSyncingRandom] = useState<boolean>(false);
  const [syncing300, setSyncing300] = useState<boolean>(false);
  const [syncingRandomServer, setSyncingRandomServer] = useState<boolean>(false);
  const [cleaningDeals, setCleaningDeals] = useState<boolean>(false);
  const [syncProgressText, setSyncProgressText] = useState<string>('');

  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const loadLogs = async () => {
    if (!isAuthenticated || !user?.is_admin) return;
    setLoadingLogs(true);
    try {
      const data = await api.getSyncLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error al cargar logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.is_admin) {
      loadLogs();
    }
  }, [isAuthenticated, user?.is_admin]);

  // Tiendas permitidas: Steam (1), Epic Games Store (25), GOG (7) y Humble Store (11)
  const ALLOWED_STORE_IDS = ['1', '25', '7', '11'];
  const ALLOWED_STORE_QUERY = '1,25,7,11';

  // Helper para obtener tiendas oficiales permitidas de CheapShark
  const fetchCheapSharkStores = async (): Promise<CheapSharkStore[]> => {
    try {
      const res = await fetch('https://www.cheapshark.com/api/1.0/stores');
      if (res.ok) {
        const allStores: CheapSharkStore[] = await res.json();
        return allStores.filter((s) => ALLOWED_STORE_IDS.includes(s.storeID));
      }
    } catch (e) {
      console.warn('No se pudieron obtener tiendas externas:', e);
    }
    return [];
  };

  // 1. Descubrimiento Aleatorio: 60 Juegos al Azar (solo Steam, Epic, GOG y Humble)
  const handleRandomSync = async () => {
    setSyncingRandom(true);
    setSyncStatus({ type: null, message: '' });

    try {
      const stores = await fetchCheapSharkStores();
      const randomPage = Math.floor(Math.random() * 25) + 1;
      const sortOptions = ['Deal Rating', 'Savings', 'Reviews', 'Metacritic', 'Release', 'recent'];
      const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

      setSyncProgressText(`Consultando CheapShark para Steam, Epic, GOG y Humble (Página #${randomPage}, ${randomSort})...`);

      const dealsResp = await fetch(
        `https://www.cheapshark.com/api/1.0/deals?storeID=${ALLOWED_STORE_QUERY}&onSale=1&pageSize=60&pageNumber=${randomPage}&sortBy=${encodeURIComponent(
          randomSort
        )}`
      );

      if (!dealsResp.ok) {
        throw new Error(`CheapShark retornó código ${dealsResp.status}`);
      }

      const deals: CheapSharkDeal[] = await dealsResp.json();
      if (!deals || deals.length === 0) {
        throw new Error(`No se encontraron ofertas en la página aleatoria #${randomPage}`);
      }

      setSyncProgressText(
        `Persistiendo ${deals.length} juegos aleatorios y auto-enriqueciendo con Steam, Epic, GOG, Humble Store...`
      );

      const result = await api.ingestDeals({ deals, stores }, true);

      setSyncStatus({
        type: 'success',
        message: `¡Juegos aleatorios añadidos y auto-enriquecidos! Se procesaron ${result.processed} ofertas de la Página #${randomPage} (${randomSort}) y se enriquecieron ${result.enriched || 0} títulos multi-tienda.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error durante el descubrimiento aleatorio.',
      });
    } finally {
      setSyncingRandom(false);
      setSyncProgressText('');
    }
  };

  // 2. Descubrimiento Aleatorio Masivo: 300 Juegos al Azar (5 páginas de 60)
  const handleRandomSync300 = async () => {
    setSyncing300(true);
    setSyncStatus({ type: null, message: '' });

    try {
      const stores = await fetchCheapSharkStores();
      const sortOptions = ['Deal Rating', 'Savings', 'Reviews', 'Metacritic', 'Release', 'recent'];
      const totalPages = 5;
      let totalProcessed = 0;
      let totalEnriched = 0;

      // Elegir páginas aleatorias sin duplicados
      const usedPages = new Set<number>();
      while (usedPages.size < totalPages) {
        usedPages.add(Math.floor(Math.random() * 25) + 1);
      }
      const pageList = Array.from(usedPages);

      for (let i = 0; i < pageList.length; i++) {
        const pageNum = pageList[i];
        const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

        setSyncProgressText(
          `Lote ${i + 1} de ${totalPages}: Descargando 60 ofertas (Steam, Epic, GOG, Humble) de Página #${pageNum}...`
        );

        const dealsResp = await fetch(
          `https://www.cheapshark.com/api/1.0/deals?storeID=${ALLOWED_STORE_QUERY}&onSale=1&pageSize=60&pageNumber=${pageNum}&sortBy=${encodeURIComponent(
            randomSort
          )}`
        );

        if (!dealsResp.ok) {
          console.warn(`Error en lote ${i + 1}: código ${dealsResp.status}`);
          continue;
        }

        const deals: CheapSharkDeal[] = await dealsResp.json();
        if (deals && deals.length > 0) {
          setSyncProgressText(
            `Lote ${i + 1} de ${totalPages}: Persistiendo y enriqueciendo ${deals.length} juegos en PostgreSQL...`
          );
          const res = await api.ingestDeals({ deals, stores }, true);
          totalProcessed += res.processed;
          totalEnriched += res.enriched || 0;
        }

        // Breve pausa para respetar rate-limits de CheapShark
        await new Promise((r) => setTimeout(r, 200));
      }

      setSyncStatus({
        type: 'success',
        message: `¡Sincronización masiva completada! Se procesaron ${totalProcessed} ofertas en 5 lotes y se enriquecieron ${totalEnriched} videojuegos con sus tiendas clave (Steam, Epic, GOG, Humble).`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error durante la sincronización masiva de 300 juegos.',
      });
    } finally {
      setSyncing300(false);
      setSyncProgressText('');
    }
  };

  // 3. Descubrimiento Masivo Nativo en Backend Go (Render)
  const handleRandomServerSync = async (count: number = 60) => {
    setSyncingRandomServer(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgressText(`El backend Go está seleccionando ${count} ofertas en CheapShark y auto-enriqueciendo juegos...`);

    try {
      const res = await api.randomServerSync(count);
      setSyncStatus({
        type: 'success',
        message: `¡Servidor Go completó la sincronización! Se descargaron ${res.result.deals_processed} ofertas y se auto-enriquecieron con Steam, Epic, GOG y Humble Store.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error en descubrimiento desde el servidor.',
      });
      loadLogs();
    } finally {
      setSyncingRandomServer(false);
      setSyncProgressText('');
    }
  };

  // 4. Mantenimiento: Limpiar y Actualizar Ofertas Caducadas
  const handleCleanupExpiredDeals = async () => {
    setCleaningDeals(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgressText('Consultando CheapShark para actualizar precios y desactivar ofertas caducadas en la base de datos...');

    try {
      const res = await api.cleanupExpiredDeals();
      setSyncStatus({
        type: 'success',
        message: `¡Mantenimiento exitoso! ${res.deals_updated} ofertas actualizadas con precios vigentes y ${res.deals_deactivated} ofertas caducadas fueron retiradas del catálogo.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error al actualizar y limpiar ofertas.',
      });
    } finally {
      setCleaningDeals(false);
      setSyncProgressText('');
    }
  };

  const isBusy = syncingRandom || syncing300 || syncingRandomServer || cleaningDeals;

  // Verificación de Acceso de Administrador
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-300 mb-3" />
        <p className="text-slate-400 text-sm">Verificando credenciales de administrador...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_admin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-300">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Acceso Restringido (403)</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              El Centro de Sincronización API es de uso exclusivo para la cuenta del <strong>Administrador</strong> de DealHunter.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 text-left space-y-1">
            <div className="font-semibold text-slate-300">¿Eres el administrador?</div>
            <p>
              Asegúrate de haber iniciado sesión con el correo configurado en <code className="text-brand-300">ADMIN_EMAIL</code> en el backend.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {!isAuthenticated ? (
              <Link
                to="/auth"
                className="py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm rounded-xl transition"
              >
                Iniciar Sesión con Google
              </Link>
            ) : null}
            <Link
              to="/"
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Catálogo Público
            </Link>
          </div>
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
            <RefreshCw className="w-8 h-8 text-brand-300" />
            Centro de Sincronización y Mantenimiento
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Panel administrativo exclusivo para descubrir nuevos títulos y revalidar ofertas en tiempo real desde CheapShark API.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold self-start sm:self-auto">
          <CheckCheck className="w-4 h-4" />
          <span>Sesión de Administrador: {user.email}</span>
        </div>
      </div>

      {/* Alerta de Estado */}
      {syncStatus.type && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition ${
            syncStatus.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          {syncStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <span className="font-semibold block">
              {syncStatus.type === 'success' ? 'Operación Exitosa' : 'Aviso de Sincronización'}
            </span>
            <span className="opacity-90">{syncStatus.message}</span>
          </div>
        </div>
      )}

      {/* Indicador de Progreso en Vivo */}
      {syncProgressText && (
        <div className="bg-brand-950/30 border border-brand-500/40 text-brand-300 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-medium animate-pulse shadow-md">
          <Loader2 className="w-4 h-4 animate-spin text-brand-300 shrink-0" />
          <span>{syncProgressText}</span>
        </div>
      )}

      {/* Tarjeta 1: Descubrimiento y Población de Juegos (60 y 300 títulos) */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl space-y-6">
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              Descubrimiento Aleatorio con Pre-Enriquecimiento
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              • Tiendas prioritarias: Steam, Epic Games, GOG, Humble Store
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shuffle className="w-6 h-6 text-indigo-300" />
            Poblar Catálogo con Títulos Nuevos
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Explora páginas del catálogo de CheapShark al azar para traer <strong>juegos nunca antes vistos</strong>. En la misma inserción, consulta CheapShark para vincular automáticamente <strong>Steam, Epic Games, GOG y Humble Bundle</strong> si el juego está disponible en ellas.
          </p>
        </div>

        {/* Acciones de Sincronización */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Botón 1: 60 Juegos */}
          <button
            onClick={handleRandomSync}
            disabled={isBusy}
            className="py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 disabled:opacity-50"
          >
            {syncingRandom ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sincronizando 60...
              </>
            ) : (
              <>
                <Shuffle className="w-4 h-4" />
                <span>🎲 60 Juegos al Azar</span>
              </>
            )}
          </button>

          {/* Botón 2: 300 Juegos */}
          <button
            onClick={handleRandomSync300}
            disabled={isBusy}
            className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {syncing300 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sincronizando 300...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <span>⚡ 300 Juegos al Azar (5 Lotes)</span>
              </>
            )}
          </button>

          {/* Botón 3: Ejecutar en Backend Go */}
          <button
            onClick={() => handleRandomServerSync(300)}
            disabled={isBusy}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncingRandomServer ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-brand-300" />
                Servidor Go en Proceso...
              </>
            ) : (
              <>
                <Server className="w-4 h-4 text-brand-300" />
                <span>Ejecutar 300 en Go</span>
              </>
            )}
          </button>

          {/* Botón 4: Mantenimiento y Limpieza de Ofertas Caducadas */}
          <button
            onClick={handleCleanupExpiredDeals}
            disabled={isBusy}
            className="py-3 px-4 bg-slate-800/80 hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            title="Verifica en CheapShark si las ofertas activas en la BD ya vencieron o cambiaron de precio"
          >
            {cleaningDeals ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-rose-300" />
                Limpiando Caducadas...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>🧹 Limpiar Ofertas Caducadas</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Historial de Auditoría (sync_logs) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-brand-300" />
            Registro de Auditoría de Sincronizaciones (`sync_logs`)
          </h2>
          <button
            onClick={loadLogs}
            disabled={loadingLogs}
            className="text-xs text-brand-300 hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl bg-slate-900 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Origen / Tarea</th>
                <th className="py-3 px-4 text-center">Ofertas Procesadas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4">Detalle / Resultado</th>
                <th className="py-3 px-4 text-right">Fecha de Ejecución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingLogs ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Cargando registros...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Aún no se han registrado ejecuciones. Usa los botones superiores para sincronizar ofertas.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono">#{log.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {log.source.includes('maintenance') || log.source.includes('cleanup')
                        ? 'Limpieza / Mantenimiento'
                        : log.source.includes('random')
                        ? 'Descubrimiento Aleatorio'
                        : log.source === 'browser_ingest'
                        ? 'Cliente (Navegador)'
                        : 'Servidor (Go)'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-100">
                      {log.deals_processed}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs">
                      {log.error_message || 'Completado sin anomalías'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {new Date(log.executed_at).toLocaleString('es-ES')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
