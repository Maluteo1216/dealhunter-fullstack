import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { PriceHistoryPoint, StorePriceInfo } from '../types';
import { LineChart as LineChartIcon, Calendar, Trophy, Eye, EyeOff, Info } from 'lucide-react';

export type TimeRangeKey = '7d' | '30d' | '90d' | '365d' | 'all';

interface PriceHistoryChartProps {
  priceHistory: PriceHistoryPoint[];
  currentPrices: StorePriceInfo[];
  historicalLowPrice?: number;
}

interface StoreMeta {
  key: string; // store_slug or normalized name
  name: string;
  logo: string;
  color: string;
  currentPrice?: number;
}

// Paleta pastel de alto contraste consistente por tienda en toda la aplicación (estilo Keepa oscuro)
const CONSISTENT_STORE_COLORS: Record<string, string> = {
  steam: '#60a5fa', // Azul cielo pastel
  'epic-games-store': '#c084fc', // Violeta pastel
  gog: '#f472b6', // Rosa pastel
  'humble-store': '#fb7185', // Coral pastel
  fanatical: '#fb923c', // Naranja pastel
  greenmangaming: '#4ade80', // Verde menta pastel
  gamersgate: '#2dd4bf', // Turquesa pastel
  'ubisoft-connect': '#818cf8', // Índigo pastel
  'ea-app': '#facc15', // Ámbar pastel
  indiegala: '#a3e635', // Lima pastel
  gamesplanet: '#38bdf8', // Cian pastel
  wingamestore: '#e879f9', // Fucsia pastel
  dlgamer: '#fca5a5', // Salmón pastel
  noctre: '#67e8f9', // Agua pastel
};

const FALLBACK_COLORS = [
  '#93c5fd',
  '#d8b4fe',
  '#f9a8d4',
  '#fdba74',
  '#86efac',
  '#5eead4',
  '#fde047',
  '#fda4af',
  '#a5b4fc',
  '#6ee7b7',
];

function normalizeStoreKey(slug?: string, name?: string): string {
  if (slug && slug.trim() !== '') {
    return slug.trim().toLowerCase();
  }
  return (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getConsistentStoreColor(slug?: string, name?: string): string {
  const key = normalizeStoreKey(slug, name);
  if (CONSISTENT_STORE_COLORS[key]) {
    return CONSISTENT_STORE_COLORS[key];
  }
  // Hash determinístico para cualquier otra tienda de CheapShark
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

const TIME_RANGES: { key: TimeRangeKey; label: string; days?: number }[] = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '1 mes', days: 30 },
  { key: '90d', label: '3 meses', days: 90 },
  { key: '365d', label: '1 año', days: 365 },
  { key: 'all', label: 'Todo' },
];

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({
  priceHistory,
  currentPrices,
  historicalLowPrice,
}) => {
  const [range, setRange] = useState<TimeRangeKey>('30d');
  const [hiddenStores, setHiddenStores] = useState<Set<string>>(new Set());

  const toggleStoreVisibility = (storeKey: string) => {
    setHiddenStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeKey)) {
        next.delete(storeKey);
      } else {
        next.add(storeKey);
      }
      return next;
    });
  };

  // Construir catálogo unificado de tiendas presentes en la página del juego
  const storesList: StoreMeta[] = useMemo(() => {
    const map = new Map<string, StoreMeta>();

    for (const cp of currentPrices) {
      const key = normalizeStoreKey(cp.store_slug, cp.store_name);
      map.set(key, {
        key,
        name: cp.store_name,
        logo: cp.store_logo,
        color: getConsistentStoreColor(cp.store_slug, cp.store_name),
        currentPrice: cp.current_price,
      });
    }

    for (const ph of priceHistory) {
      const key = normalizeStoreKey(ph.store_slug, ph.store_name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: ph.store_name,
          logo: ph.store_logo,
          color: getConsistentStoreColor(ph.store_slug, ph.store_name),
        });
      }
    }

    return Array.from(map.values());
  }, [currentPrices, priceHistory]);

  // Preparar series de tiempo estilo Keepa (stepAfter) con dominio acorde al rango seleccionado
  const { chartData, domainStart, domainEnd, earliestRecordDate, yMax } = useMemo(() => {
    const now = Date.now();
    const selectedRange = TIME_RANGES.find((r) => r.key === range);

    // Agrupar eventos reales por tienda ordenados cronológicamente
    const eventsByStore = new Map<string, { ts: number; price: number }[]>();
    let earliestTs = now;

    for (const ph of priceHistory) {
      const key = normalizeStoreKey(ph.store_slug, ph.store_name);
      const ts = new Date(ph.recorded_at).getTime();
      if (isNaN(ts)) continue;
      if (ts < earliestTs) earliestTs = ts;
      if (!eventsByStore.has(key)) eventsByStore.set(key, []);
      eventsByStore.get(key)!.push({ ts, price: ph.sale_price });
    }

    // Asegurar que cada tienda presente en currentPrices tenga su precio actual reflejado
    for (const cp of currentPrices) {
      const key = normalizeStoreKey(cp.store_slug, cp.store_name);
      const ts = cp.last_updated ? new Date(cp.last_updated).getTime() : now;
      const validTs = isNaN(ts) ? now : Math.min(ts, now);
      if (validTs < earliestTs) earliestTs = validTs;

      if (!eventsByStore.has(key)) {
        eventsByStore.set(key, [{ ts: validTs, price: cp.current_price }]);
      } else {
        const arr = eventsByStore.get(key)!;
        arr.sort((a, b) => a.ts - b.ts);
        const last = arr[arr.length - 1];
        if (!last || Math.abs(last.price - cp.current_price) > 0.009 || last.ts < validTs - 60000) {
          arr.push({ ts: validTs, price: cp.current_price });
        }
      }
    }

    // Ordenar eventos de cada tienda
    eventsByStore.forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

    let winStart: number;
    if (selectedRange?.days) {
      winStart = now - selectedRange.days * 24 * 60 * 60 * 1000;
    } else {
      // 'all': iniciar en el punto más antiguo o hace 7 días si es reciente
      winStart = Math.min(earliestTs, now - 7 * 24 * 60 * 60 * 1000);
    }

    // Recolectar marcas de tiempo relevantes dentro de [winStart, now]
    const timestampSet = new Set<number>([now]);

    eventsByStore.forEach((arr) => {
      let hasPointBeforeStart = false;
      for (const ev of arr) {
        if (ev.ts <= winStart) {
          hasPointBeforeStart = true;
        } else if (ev.ts <= now) {
          timestampSet.add(ev.ts);
        }
      }
      if (hasPointBeforeStart) {
        timestampSet.add(winStart);
      }
    });

    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Construir puntos del gráfico haciendo forward-fill estilo Keepa (el precio vigente se mantiene hasta el siguiente cambio)
    let maxPriceObserved = historicalLowPrice || 0;
    const rows = sortedTimestamps.map((ts) => {
      const row: Record<string, number> = { timestamp: ts };
      storesList.forEach((st) => {
        const arr = eventsByStore.get(st.key);
        if (!arr || arr.length === 0) return;

        // Buscar el último precio registrado en o antes de `ts`
        let activePrice: number | undefined = undefined;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].ts <= ts) {
            activePrice = arr[i].price;
          } else {
            break;
          }
        }

        if (activePrice !== undefined) {
          row[st.key] = activePrice;
          if (activePrice > maxPriceObserved) {
            maxPriceObserved = activePrice;
          }
        }
      });
      return row;
    });

    const computedYMax = maxPriceObserved > 0 ? Math.ceil(maxPriceObserved * 1.15) : 60;

    return {
      chartData: rows,
      domainStart: winStart,
      domainEnd: now,
      earliestRecordDate: earliestTs,
      yMax: computedYMax,
    };
  }, [priceHistory, currentPrices, storesList, range, historicalLowPrice]);

  if (storesList.length === 0) {
    return null;
  }

  const formatXAxis = (ts: number) => {
    const d = new Date(ts);
    if (range === '7d') {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
    if (range === '365d' || range === 'all') {
      return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      {/* Cabecera y Selector de Rango Temporal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-brand-300" />
            Historial de Precios por Tienda
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Gráfica escalonada estilo Keepa · Registrado desde{' '}
              <strong className="text-slate-300">
                {new Date(earliestRecordDate).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </span>
          </p>
        </div>

        {/* Selector de Tiempo (7d, 1 mes, 3 meses, 1 año, Todo) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          {TIME_RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                range === item.key
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfica Recharts Estilo Keepa */}
      <div className="w-full h-72 sm:h-80 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={[domainStart, domainEnd]}
              tickFormatter={formatXAxis}
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              minTickGap={35}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={(val) => `$${val}`}
              stroke="#64748b"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const dateStr = new Date(Number(label)).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                // Ordenar entradas del tooltip de menor a mayor precio
                const sorted = [...payload].sort(
                  (a, b) => Number(a.value ?? 9999) - Number(b.value ?? 9999)
                );

                return (
                  <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl text-xs min-w-[210px]">
                    <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1.5 mb-2">
                      {dateStr}
                    </div>
                    <div className="space-y-1.5">
                      {sorted.map((entry) => {
                        const storeInfo = storesList.find((s) => s.key === entry.dataKey);
                        return (
                          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-slate-200 font-medium truncate">
                                {storeInfo?.name || entry.name}
                              </span>
                            </div>
                            <span className="font-bold text-white shrink-0">
                              ${Number(entry.value).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />

            {/* Línea de referencia de Mínimo Histórico estilo Keepa */}
            {historicalLowPrice !== undefined && historicalLowPrice !== null && (
              <ReferenceLine
                y={historicalLowPrice}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                label={{
                  value: `Mín. Histórico $${historicalLowPrice.toFixed(2)}`,
                  position: 'insideBottomRight',
                  fill: '#fbbf24',
                  fontSize: 10,
                }}
              />
            )}

            {/* Una línea escalonada por cada tienda con color consistente */}
            {storesList.map((st) => {
              if (hiddenStores.has(st.key)) return null;
              return (
                <Line
                  key={st.key}
                  type="stepAfter"
                  dataKey={st.key}
                  name={st.name}
                  stroke={st.color}
                  strokeWidth={2.25}
                  dot={{ r: 3.5, fill: st.color, strokeWidth: 1, stroke: '#0f172a' }}
                  activeDot={{ r: 5.5, fill: st.color, stroke: '#ffffff', strokeWidth: 1.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda Interactiva Consistente por Tienda (Estilo Keepa) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            Leyenda de Tiendas (clic para mostrar u ocultar línea)
          </span>
          {historicalLowPrice !== undefined && historicalLowPrice !== null && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
              <Trophy className="w-3.5 h-3.5" />
              Mínimo Histórico: ${historicalLowPrice.toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {storesList.map((st) => {
            const isHidden = hiddenStores.has(st.key);
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => toggleStoreVisibility(st.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                  isHidden
                    ? 'bg-slate-950/50 border-slate-800 text-slate-500 opacity-60'
                    : 'bg-slate-950 border-slate-700/80 text-slate-200 hover:border-slate-600'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0 shadow-sm"
                  style={{ backgroundColor: isHidden ? '#475569' : st.color }}
                />
                {st.logo && (
                  <img
                    src={st.logo}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <span>{st.name}</span>
                {st.currentPrice !== undefined && (
                  <span className="font-bold text-slate-100 ml-0.5">
                    ${st.currentPrice.toFixed(2)}
                  </span>
                )}
                {isHidden ? (
                  <EyeOff className="w-3 h-3 text-slate-500 ml-0.5" />
                ) : (
                  <Eye className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
          <Info className="w-3.5 h-3.5 shrink-0 text-slate-500" />
          <span>
            Cada tienda conserva el mismo color en toda la plataforma. Los puntos y escalones reflejan los cambios reales registrados desde que el juego fue incorporado al catálogo.
          </span>
        </p>
      </div>
    </div>
  );
};
