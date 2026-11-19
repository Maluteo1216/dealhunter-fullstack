import React from 'react';
import { StorePriceInfo } from '../types';
import { ExternalLink, Check, ShoppingBag } from 'lucide-react';

interface StoreTableProps {
  prices: StorePriceInfo[];
  historicalLowPrice?: number;
}

export const StoreTable: React.FC<StoreTableProps> = ({ prices, historicalLowPrice }) => {
  if (prices.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-600" />
        <p className="font-medium text-slate-300">No hay precios registrados actualmente para este título.</p>
        <p className="text-xs text-slate-500 mt-1">Usa el botón de sincronización para actualizar ofertas desde CheapShark API.</p>
      </div>
    );
  }

  // Ordenar tiendas de menor a mayor precio
  const sortedPrices = [...prices].sort((a, b) => a.current_price - b.current_price);

  return (
    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="py-3.5 px-4">Tienda Oficial</th>
            <th className="py-3.5 px-4 text-center">Descuento</th>
            <th className="py-3.5 px-4 text-right">Precio Regular</th>
            <th className="py-3.5 px-4 text-right">Precio Oferta</th>
            <th className="py-3.5 px-4 text-center">Estado</th>
            <th className="py-3.5 px-4 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-sm">
          {sortedPrices.map((item, index) => {
            const isBestDeal = index === 0;
            const isHistoric =
              historicalLowPrice !== undefined && item.current_price <= historicalLowPrice;

            return (
              <tr
                key={item.store_product_id}
                className={`hover:bg-slate-800/40 transition ${
                  isBestDeal ? 'bg-brand-500/5' : ''
                }`}
              >
                {/* Store Name and Logo */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                      {item.store_logo ? (
                        <img
                          src={item.store_logo}
                          alt={item.store_name}
                          className="w-full h-full object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">
                          {item.store_name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-200 block">
                        {item.store_name}
                      </span>
                      {isBestDeal && (
                        <span className="text-[11px] font-medium text-brand-300">
                          Mejor precio actual
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Discount */}
                <td className="py-3.5 px-4 text-center">
                  {item.discount_percentage > 0 ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      -{Math.round(item.discount_percentage)}%
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs">0%</span>
                  )}
                </td>

                {/* Regular Price */}
                <td className="py-3.5 px-4 text-right text-slate-400 line-through">
                  ${item.regular_price.toFixed(2)}
                </td>

                {/* Sale Price */}
                <td className="py-3.5 px-4 text-right">
                  <span className="font-bold text-base text-slate-100">
                    ${item.current_price.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">USD</span>
                </td>

                {/* Status Badges */}
                <td className="py-3.5 px-4 text-center">
                  {isHistoric ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Check className="w-3 h-3" /> Mínimo histórico
                    </span>
                  ) : item.is_on_sale ? (
                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      En oferta
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
                      Precio estándar
                    </span>
                  )}
                </td>

                {/* Action CTA */}
                <td className="py-3.5 px-4 text-right">
                  <a
                    href={item.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-sm transition"
                  >
                    <span>Ir a la oferta</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
