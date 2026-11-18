import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
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
} from 'lucide-react';

export const SyncAdminPage: React.FC = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [syncingRandom, setSyncingRandom] = useState<boolean>(false);
  const [syncingRandomServer, setSyncingRandomServer] = useState<boolean>(false);
  const [syncProgressText, setSyncProgressText] = useState<string>('');

  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const loadLogs = async () => {
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
    loadLogs();
  }, []);

  // Helper para obtener tiendas de CheapShark
  const fetchCheapSharkStores = async (): Promise<CheapSharkStore[]> => {
    try {
      const res = await fetch('https://www.cheapshark.com/api/1.0/stores');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('No se pudieron obtener tiendas externas:', e);
    }
    return [];
  };

  // 1. Descubrimiento Aleatorio Híbrido (Vía Cliente/Navegador con Auto-Enriquecimiento Multi-Tienda)
  const handleRandomSync = async () => {
    setSyncingRandom(true);
    setSyncStatus({ type: null, message: '' });

    try {
      const stores = await fetchCheapSharkStores();
      // Seleccionar una página aleatoria entre 1 y 25 y un criterio de ordenación al azar
      const randomPage = Math.floor(Math.random() * 25) + 1;
      const sortOptions = ['Deal Rating', 'Savings', 'Reviews', 'Metacritic', 'Release', 'recent'];
      const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

      setSyncProgressText(`Consultando CheapShark (Página aleatoria #${randomPage}, ordenado por ${randomSort})...`);

      const dealsResp = await fetch(
        `https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&pageNumber=${randomPage}&sortBy=${encodeURIComponent(
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
        `Persistiendo ${deals.length} juegos aleatorios y auto-enriqueciendo con Steam, Epic, GOG, Humble Bundle...`
      );

      // Enviamos a la API con autoEnrich = true
      const result = await api.ingestDeals({ deals, stores }, true);

      setSyncStatus({
        type: 'success',
        message: `¡Juegos aleatorios añadidos y auto-enriquecidos! Se procesaron ${result.processed} ofertas de la Página #${randomPage} (${randomSort}). Todos los títulos se han enriquecido con sus tiendas oficiales disponibles (Steam, Epic, GOG, Humble).`,
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

  // 2. Descubrimiento Aleatorio Nativo en Backend Go (Render)
  const handleRandomServerSync = async () => {
    setSyncingRandomServer(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgressText('El backend Go está seleccionando página aleatoria en CheapShark y auto-enriqueciendo juegos...');

    try {
      const res = await api.randomServerSync();
      setSyncStatus({
        type: 'success',
        message: `¡Servidor Go completó el descubrimiento aleatorio! Se descargaron ${res.result.deals_processed} ofertas de la Página #${res.result.page_number} (${res.result.sort_by}) y se auto-enriquecieron con Steam, Epic, GOG y Humble Store.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error en descubrimiento aleatorio desde el servidor.',
      });
      loadLogs();
    } finally {
      setSyncingRandomServer(false);
      setSyncProgressText('');
    }
  };

  const isBusy = syncingRandom || syncingRandomServer;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-400" />
          Centro de Sincronización Aleatoria
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Alimenta y amplía el catálogo descubriendo nuevos juegos al azar desde CheapShark y enriqueciéndolos automáticamente con sus tiendas oficiales (Steam, Epic Games, GOG, Humble Store).
        </p>
      </div>

      {/* Alerta de Estado */}
      {syncStatus.type && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition ${
            syncStatus.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          {syncStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
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
        <div className="bg-brand-950/30 border border-brand-500/40 text-brand-300 p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400 shrink-0" />
          <span>{syncProgressText}</span>
        </div>
      )}

      {/* Tarjeta Principal: Descubrimiento Aleatorio Auto-Enriquecido */}
      <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-brand-950/40 border border-purple-500/40 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Sincronización Exclusiva y Auto-Enriquecida
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                • Tiendas prioritarias: Steam, Epic, GOG, Humble
              </span>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Shuffle className="w-6 h-6 text-purple-400" />
              Descubrimiento Aleatorio con Pre-Enriquecimiento
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Elige aleatoriamente páginas del catálogo de CheapShark (páginas 1 a 25) y criterios al azar (Reviews, Metacritic, Savings, Release) para traer <strong>juegos nuevos e inéditos</strong> a la plataforma. Durante la misma inserción, consulta CheapShark para vincular automáticamente <strong>Steam, Epic Games Store, GOG y Humble Bundle</strong> si el juego está disponible en ellas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[280px]">
            <button
              onClick={handleRandomSync}
              disabled={isBusy}
              className="py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              {syncingRandom ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Descubriendo y Auto-Enriqueciendo...
                </>
              ) : (
                <>
                  <Shuffle className="w-4 h-4" />
                  🎲 60 Juegos al Azar Auto-Enriquecidos
                </>
              )}
            </button>

            <button
              onClick={handleRandomServerSync}
              disabled={isBusy}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-purple-200 border border-purple-500/30 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingRandomServer ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  Servidor Go en Proceso...
                </>
              ) : (
                <>
                  <Server className="w-3.5 h-3.5 text-purple-400" />
                  Ejecutar Aleatorio en Backend Go
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Historial de Auditoría (sync_logs) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" />
            Registro de Auditoría de Sincronizaciones (`sync_logs`)
          </h2>
          <button
            onClick={loadLogs}
            className="text-xs text-brand-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Actualizar
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl bg-slate-900 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Origen</th>
                <th className="py-3 px-4 text-center">Ofertas Procesadas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4">Detalle / Error</th>
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
                    Aún no se han ejecutado sincronizaciones. Haz clic en "60 Juegos al Azar Auto-Enriquecidos" para poblar el catálogo.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono">#{log.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {log.source.includes('random')
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
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
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
