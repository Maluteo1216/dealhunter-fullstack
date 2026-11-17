import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PriceHistoryPoint } from '../types';
import { History } from 'lucide-react';

interface PriceHistoryChartProps {
  history: PriceHistoryPoint[];
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm">Aún no hay suficientes registros históricos para este videojuego.</p>
        <p className="text-xs text-slate-500 mt-1">Conforme se sincronicen más ofertas, se generará la curva temporal de precios.</p>
      </div>
    );
  }

  // Formatear datos para la gráfica
  const chartData = history.map((pt) => {
    const date = new Date(pt.recorded_at);
    return {
      date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      fullDate: date.toLocaleString('es-ES'),
      precio: pt.sale_price,
      precioRegular: pt.regular_price,
      tienda: pt.store_name,
      descuento: pt.discount_percentage,
    };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-brand-400" />
          <h3 className="text-base font-semibold text-slate-200">
            Evolución Histórica de Precios
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">Moneda: USD ($)</span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
                      <p className="text-slate-400 mb-1">{data.fullDate}</p>
                      <p className="font-semibold text-slate-200">{data.tienda}</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-brand-400 font-bold text-sm">
                          ${data.precio.toFixed(2)} USD
                        </span>
                        {data.precioRegular > data.precio && (
                          <span className="text-slate-500 line-through">
                            ${data.precioRegular.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {data.descuento > 0 && (
                        <span className="text-emerald-400 font-medium block mt-0.5">
                          Descuento: -{Math.round(data.descuento)}%
                        </span>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
            <Line
              type="monotone"
              dataKey="precio"
              name="Precio en Oferta"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={{ fill: '#22c55e', r: 3 }}
              activeDot={{ r: 6, fill: '#4ade80' }}
            />
            <Line
              type="stepAfter"
              dataKey="precioRegular"
              name="Precio Regular MSRP"
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
