import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SyncLog, CheapSharkDeal, CheapSharkStore } from '../types';
import {
  RefreshCw,
  Server,
  CloudDownload,
  CheckCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  Globe,
  Database,
  Loader2,
  Zap,
  ShoppingBag,
} from 'lucide-react';

export const SyncAdminPage: React.FC = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [syncingBrowser, setSyncingBrowser] = useState<boolean>(false);
  const [syncingMultiStore, setSyncingMultiStore] = useState<boolean>(false);
  const [syncingServer, setSyncingServer] = useState<boolean>(false);
  const [enriching, setEnriching] = useState<boolean>(false);
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

  // 1. Sincronización Rápida (1 o 2 páginas de ofertas generales)
  const handleBrowserSync = async (pagesToFetch: number = 2) => {
    setSyncingBrowser(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgressText('Obteniendo ofertas generales...');

    try {
      const stores = await fetchCheapSharkStores();
      const allDeals: CheapSharkDeal[] = [];

      for (let page = 0; page < pagesToFetch; page++) {
        setSyncProgressText(`Descargando página ${page + 1} de ofertas...`);
        const dealsResp = await fetch(
          `https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&pageNumber=${page}`
        );
        if (dealsResp.ok) {
          const pageDeals: CheapSharkDeal[] = await dealsResp.json();
          allDeals.push(...pageDeals);
        }
      }

      if (allDeals.length === 0) {
        throw new Error('CheapShark no retornó ofertas.');
      }

      setSyncProgressText(`Enviando ${allDeals.length} ofertas a PostgreSQL...`);
      const result = await api.ingestDeals({ deals: allDeals, stores });

      setSyncStatus({
        type: 'success',
        message: `¡Sincronización completada! Se procesaron ${result.processed} ofertas en la base de datos.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error durante la sincronización desde el cliente.',
      });
    } finally {
      setSyncingBrowser(false);
      setSyncProgressText('');
    }
  };

  // 2. Sincronización Masiva Multi-Tienda (Steam, Epic, Fanatical, GOG, GMG, Humble)
  const handleMultiStoreSync = async () => {
    setSyncingMultiStore(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgressText('Iniciando sincronización multi-tienda...');

    try {
      const stores = await fetchCheapSharkStores();

      const storeEndpoints = [
        { name: 'Ofertas Generales', url: 'https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60' },
        { name: 'Steam', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=60' },
        { name: 'Epic Games Store', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=25&pageSize=60' },
        { name: 'Fanatical', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=15&pageSize=60' },
        { name: 'GOG', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=7&pageSize=60' },
        { name: 'GreenManGaming', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=3&pageSize=60' },
        { name: 'Humble Store', url: 'https://www.cheapshark.com/api/1.0/deals?storeID=11&pageSize=60' },
      ];

      const allDeals: CheapSharkDeal[] = [];
      const seenDeals = new Set<string>();

      for (const st of storeEndpoints) {
        setSyncProgressText(`Consultando catálogo de ${st.name}...`);
        try {
          const res = await fetch(st.url);
          if (res.ok) {
            const deals: CheapSharkDeal[] = await res.json();
            for (const d of deals) {
              if (!seenDeals.has(d.dealID)) {
                seenDeals.add(d.dealID);
                allDeals.push(d);
              }
            }
          }
        } catch (e) {
          console.warn(`Error al consultar ${st.name}:`, e);
        }
      }

      if (allDeals.length === 0) {
        throw new Error('No se pudieron obtener ofertas de las tiendas.');
      }

      setSyncProgressText(`Persistiendo ${allDeals.length} ofertas multi-tienda en la base de datos...`);
      const result = await api.ingestDeals({ deals: allDeals, stores });

      // Ejecutar auto-enriquecimiento de los juegos para expandir sus tiendas
      setSyncProgressText('Enriqueciendo títulos principales con todas sus tiendas oficiales...');
      let enrichMsg = '';
      try {
        const enrichRes = await api.enrichCatalog();
        enrichMsg = ` Además se enriquecieron ${enrichRes.enriched_games} títulos con ${enrichRes.stores_added} precios de tiendas adicionales.`;
      } catch (e) {
        console.warn('Aviso durante enriquecimiento:', e);
      }

      setSyncStatus({
        type: 'success',
        message: `¡Sincronización multi-tienda completada! Se procesaron ${result.processed} ofertas a lo largo de 6 tiendas oficiales.${enrichMsg}`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error durante la sincronización multi-tienda.',
      });
    } finally {
      setSyncingMultiStore(false);
      setSyncProgressText('');
    }
  };

  // 3. Enriquecer catálogo existente con múltiples tiendas
  const handleEnrichCatalog = async () => {
    setEnriching(true);
    setSyncStatus({ type: null, message: '' });
    try {
      const res = await api.enrichCatalog();
      setSyncStatus({
        type: 'success',
        message: `¡Enriquecimiento exitoso! Se actualizaron ${res.enriched_games} videojuegos agregando ${res.stores_added} precios en múltiples tiendas (Steam, Epic, GOG, Fanatical, etc.).`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error al enriquecer el catálogo existente.',
      });
    } finally {
      setEnriching(false);
    }
  };

  // 4. Sincronización directa desde el servidor Go
  const handleServerSync = async () => {
    setSyncingServer(true);
    setSyncStatus({ type: null, message: '' });
    try {
      const res = await api.serverSync();
      setSyncStatus({
        type: 'success',
        message: `¡Servidor Go sincronizado exitosamente! Se procesaron ${res.processed} ofertas multi-tienda directamente desde el backend en Render.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error en sincronización nativa desde el servidor.',
      });
      loadLogs();
    } finally {
      setSyncingServer(false);
    }
  };

  const isBusy = syncingBrowser || syncingMultiStore || syncingServer || enriching;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-400" />
          Centro de Sincronización en Vivo
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Alimenta y actualiza el catálogo con ofertas reales y precios multi-tienda desde la API oficial de CheapShark.
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

      {/* Tarjetas de Acción de Sincronización */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Opción 1: Sincronización Masiva Multi-Tienda (Recomendada) */}
        <div className="bg-slate-900 border border-brand-500/40 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                <ShieldCheck className="w-3.5 h-3.5" /> Recomendado
              </span>
              <ShoppingBag className="w-5 h-5 text-brand-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              Sincronización Multi-Tienda Masiva
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Consulta de forma paralela <strong>Steam, Epic Games, GOG, Fanatical, GreenManGaming y Humble Store</strong> (300+ ofertas) garantizando que los juegos muestren comparativas de precios entre múltiples tiendas.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
            <button
              onClick={handleMultiStoreSync}
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 disabled:opacity-50"
            >
              {syncingMultiStore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando 6 Tiendas...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Sincronizar 6 Tiendas (300+ Ofertas)
                </>
              )}
            </button>

            <button
              onClick={() => handleBrowserSync(1)}
              disabled={isBusy}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              Sincronización Rápida (60 Ofertas)
            </button>
          </div>
        </div>

        {/* Opción 2: Enriquecimiento de Catálogo Existente */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Multi-Store Lookup
              </span>
              <Globe className="w-5 h-5 text-slate-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              Enriquecer Juegos Existentes
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toma los videojuegos existentes en tu base de datos y consulta la API individual de CheapShark para cada uno, extrayendo y registrando sus precios en <strong>todas las demás tiendas oficiales disponibles</strong>.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={handleEnrichCatalog}
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {enriching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enriqueciendo Títulos...
                </>
              ) : (
                <>
                  <CloudDownload className="w-4 h-4" />
                  Enriquecer Juegos Existentes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Opción 3: Sincronización Directa de Servidor (Go) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Backend Go Directo
              </span>
              <Server className="w-5 h-5 text-slate-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              Sincronización Nativa en Servidor
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ejecuta la sincronización multi-tienda directamente desde el servidor Go en Render, utilizando el encabezado descriptivo oficial requerido por CheapShark para evitar bloqueos HTTP 400.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={handleServerSync}
              disabled={isBusy}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingServer ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ejecutando en Servidor Go...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Disparar Sincronización en Go
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
                    Aún no se han ejecutado sincronizaciones. Haz clic en una de las opciones arriba.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono">#{log.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {log.source === 'browser_ingest' ? 'Cliente (Navegador)' : 'Servidor (Go)'}
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
