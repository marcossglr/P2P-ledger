import React, { useState, memo } from 'react';
import { Copy, Check, X, Loader2 } from 'lucide-react';

/**
 * Componente unificado y reutilizable para el renderizado del Libro de Órdenes P2P
 * Utilizado de forma idéntica en:
 * - OperationsDashboard.jsx (showFullDate=false: muestra solo la hora de hoy)
 * - HistoryOperationsView.jsx (showFullDate=true: muestra fecha y hora completa)
 */
function OperationsTable({
  orders = [],
  selectedOrder = null,
  onSelectOrder,
  showFullDate = false,
  loading = false,
  tableSearch = '',
  onClearSearch,
  emptyMessage = 'No se encontraron operaciones con los filtros seleccionados.',
}) {
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  const handleCopyOrderNumber = async (orderNumber) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrderId(orderNumber);
      setTimeout(() => setCopiedOrderId(null), 1500);
    } catch {
      // Fallback silencioso si el portapapeles está bloqueado
    }
  };

  const fmtFiat = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtUsdt = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtRate = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  const extractTimeOnly = (fullDateStr) => {
    if (!fullDateStr) return '—';
    const parts = fullDateStr.split(' ');
    return parts.length > 1 ? parts[1] : fullDateStr;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th className="py-2.5 px-3 font-medium align-middle whitespace-nowrap">
              {showFullDate ? 'Fecha y Hora' : 'Hora (Hoy)'}
            </th>
            <th className="py-2.5 px-2 font-medium align-middle whitespace-nowrap">ID Orden</th>
            <th className="py-2.5 px-2 font-medium align-middle whitespace-nowrap">Tipo</th>
            <th className="py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Cantidad USDT</th>
            <th className="py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Comisión (USDT)</th>
            <th className="py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Tasa Unitaria</th>
            <th className="py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Total Fiat</th>
            <th className="py-2.5 px-2 font-medium align-middle whitespace-nowrap">Método de Pago</th>
            <th className="py-2.5 pr-3 pl-2 font-medium align-middle whitespace-nowrap">Contraparte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-xs">
          {orders.map((o) => {
            const isSelected = selectedOrder?.id === o.id;
            return (
              <tr
                key={o.id}
                onClick={() => onSelectOrder && onSelectOrder(o)}
                title="Clic para ver detalle completo de la orden"
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-800/70'
                    : o.order_status === 'CANCELLED'
                    ? 'bg-rose-950/10 opacity-55 hover:bg-rose-950/20'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <td
                  className="py-2.5 px-3 tabular-nums text-[11px] text-slate-400 align-middle whitespace-nowrap"
                  title={o.order_date}
                >
                  {showFullDate ? o.order_date : extractTimeOnly(o.order_date)}
                </td>
                <td className="py-2.5 px-2 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyOrderNumber(o.order_number);
                    }}
                    title={`Clic para copiar ID completo: ${o.order_number}`}
                    className="group -ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    <span className="font-mono">#{o.order_number.slice(-8)}</span>
                    {copiedOrderId === o.order_number ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity" />
                    )}
                  </button>
                </td>
                <td className="py-2.5 px-2 font-sans align-middle whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        o.order_status === 'CANCELLED'
                          ? 'bg-slate-800/80 text-slate-400 border border-slate-700/60 line-through'
                          : o.order_type === 'COMPRA'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {o.order_type}
                    </span>
                    {o.order_status === 'CANCELLED' && (
                      <span className="inline-flex items-center rounded-md bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        CANCELADA
                      </span>
                    )}
                    {o.order_status === 'IN_PROGRESS' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 animate-pulse" title="Orden en proceso (pendiente de pago / liberación)">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        PROCESANDO
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className={`py-2.5 px-2 text-right tabular-nums font-semibold align-middle whitespace-nowrap ${
                    o.order_status === 'CANCELLED'
                      ? 'line-through text-slate-500'
                      : o.order_status === 'IN_PROGRESS'
                      ? 'text-sky-300'
                      : o.order_type === 'COMPRA'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {o.order_status !== 'CANCELLED' && (o.order_type === 'COMPRA' ? '+' : '-')}
                  {fmtUsdt(o.crypto_amount)}{' '}
                  <span className="text-[10px] font-normal text-slate-400">{o.asset}</span>
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap">
                  {o.commission_usdt > 0 ? (
                    <span className="text-slate-400">-{fmtUsdt(o.commission_usdt)}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-slate-300 align-middle whitespace-nowrap">
                  {fmtRate(o.unit_price)}
                </td>
                <td
                  className={`py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap ${
                    o.order_status === 'CANCELLED' ? 'line-through text-slate-500' : 'text-slate-300 font-medium'
                  }`}
                >
                  {fmtFiat(o.fiat_amount)}{' '}
                  <span className="text-[10px] text-slate-400">{o.fiat_currency}</span>
                </td>
                <td className="py-2.5 px-2 font-sans text-slate-300 align-middle max-w-[140px] truncate" title={o.pay_method}>
                  <span className="truncate block">{o.pay_method || '—'}</span>
                </td>
                <td className="py-2.5 pr-3 pl-2 font-sans text-slate-300 align-middle max-w-[130px] truncate" title={o.counterparty}>
                  <span className="truncate block font-medium">{o.counterparty || '—'}</span>
                </td>
              </tr>
            );
          })}
          {!loading && orders.length === 0 && (
            <tr>
              <td colSpan={9} className="py-8 text-center font-sans text-sm text-slate-500">
                {tableSearch.trim() ? (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      No se encontró ninguna orden que coincida con &ldquo;{tableSearch.trim()}&rdquo;
                    </p>
                    {onClearSearch && (
                      <button
                        type="button"
                        onClick={onClearSearch}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Limpiar búsqueda</span>
                      </button>
                    )}
                  </div>
                ) : (
                  emptyMessage
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(OperationsTable);
