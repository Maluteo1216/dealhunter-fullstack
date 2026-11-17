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
} from 'lucide-react';

export const SyncAdminPage: React.FC = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [syncingBrowser, setSyncingBrowser] = useState<boolean>(false);
  const [syncingServer, setSyncingServer] = useState<boolean>(false);
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

  // Sincronización Híbrida desde el Navegador (Evade Bloqueo Cloudflare de Render)
  const handleBrowserSync = async (pagesToFetch: number = 2) => {
    setSyncingBrowser(true);
    setSyncStatus({ type: null, message: '' });

    try {
      // 1. Obtener lista oficial de tiendas de CheapShark
      let stores: CheapSharkStore[] = [];
      try {
        const storesResp = await fetch('https://www.cheapshark.com/api/1.0/stores');
        if (storesResp.ok) {
          stores = await storesResp.json();
        }
      } catch (e) {
        console.warn('No se pudo obtener tiendas externas, se usarán las del sistema:', e);
      }

      // 2. Obtener ofertas reales paginadas de CheapShark desde el navegador del cliente
      const allDeals: CheapSharkDeal[] = [];
      for (let page = 0; page < pagesToFetch; page++) {
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

      // 3. Enviar al backend en Go para ejecución transaccional
      const result = await api.ingestDeals({
        deals: allDeals,
        stores,
      });

      setSyncStatus({
        type: 'success',
        message: `¡Sincronización exitosa! Se procesaron ${result.processed} ofertas y se actualizaron tiendas e históricos en PostgreSQL.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Error durante la sincronización desde el cliente.',
      });
    } finally {
      setSyncingBrowser(false);
    }
  };

  // Sincronización directa desde el servidor Go
  const handleServerSync = async () => {
    setSyncingServer(true);
    setSyncStatus({ type: null, message: '' });
    try {
      const res = await api.serverSync();
      setSyncStatus({
        type: 'success',
        message: `Servidor sincronizado: ${res.processed} ofertas procesadas directamente por Go.`,
      });
      loadLogs();
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message:
          err.message ||
          'El servidor en la nube fue bloqueado por Cloudflare (403). Usa la sincronización del navegador recomendada.',
      });
      loadLogs();
    } finally {
      setSyncingServer(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-400" />
          Centro de Sincronización en Vivo
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Alimenta y actualiza el catálogo con datos oficiales en tiempo real desde la API pública de CheapShark.
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

      {/* Tarjetas de Acción de Sincronización */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opción 1: Sincronización desde Navegador (Recomendada / Anti-Cloudflare) */}
        <div className="bg-slate-900 border border-brand-500/40 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                <ShieldCheck className="w-3.5 h-3.5" /> Recomendado
              </span>
              <Globe className="w-5 h-5 text-brand-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              Sincronización Híbrida (Vía Cliente)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              El navegador solicita las ofertas a CheapShark sin restricciones de red ni bloqueos de Cloudflare y las transmite a la API de Go para almacenarlas en PostgreSQL en transacciones ACID.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-2">
            <button
              onClick={() => handleBrowserSync(1)}
              disabled={syncingBrowser || syncingServer}
              className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 disabled:opacity-50"
            >
              {syncingBrowser ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sincronizando 60 ofertas...
                </>
              ) : (
                <>
                  <CloudDownload className="w-4 h-4" />
                  Sincronizar 60 Ofertas
                </>
              )}
            </button>

            <button
              onClick={() => handleBrowserSync(2)}
              disabled={syncingBrowser || syncingServer}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition disabled:opacity-50"
              title="Obtiene 2 páginas de ofertas (120 juegos)"
            >
              Descargar 120 Ofertas
            </button>
          </div>
        </div>

        {/* Opción 2: Sincronización Directa de Servidor */}
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
              Ejecuta una petición HTTP directa desde Go hacia CheapShark utilizando headers completos de navegador. En servidores cloud (como Render) puede enfrentar retos anti-bot de Cloudflare.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={handleServerSync}
              disabled={syncingBrowser || syncingServer}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncingServer ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ejecutando en Go...
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
                    Aún no se han ejecutado sincronizaciones. Haz clic en "Sincronizar Ofertas" arriba.
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
