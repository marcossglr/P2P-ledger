import React, { useState, useCallback, memo } from 'react';
import { Copy, Check, X, Loader2 } from 'lucide-react';
import { fmtTime, fmtDateTime, fmtAmount, fmtRate } from '../utils/formatters';
import { Button, Badge } from './ui';

/**
 * Indicador visual del tipo y estado de la orden
 */
const OrderStatusBadges = memo(function OrderStatusBadges({ orderType, orderStatus }) {
  const isCancelled = orderStatus === 'CANCELLED';
  const isInProgress = orderStatus === 'IN_PROGRESS';
  const isBuy = orderType === 'COMPRA';

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant={
          isCancelled
            ? 'default'
            : isBuy
            ? 'emerald'
            : 'rose'
        }
        size="sm"
        className={isCancelled ? 'line-through opacity-60' : ''}
      >
        {orderType}
      </Badge>
      {isCancelled && (
        <Badge variant="default" size="xs">
          CANCELADA
        </Badge>
      )}
      {isInProgress && (
        <Badge
          variant="blue"
          size="xs"
          className="animate-pulse gap-1"
          title="Orden en proceso (pendiente de pago / liberación)"
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          PROCESANDO
        </Badge>
      )}
    </div>
  );
});

/**
 * Skeleton loader de filas para evitar Layout Shifts durante cargas iniciales
 */
const TableSkeletonRows = memo(function TableSkeletonRows({ rowCount = 5, showFullDate = false }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse border-b border-slate-800/40">
          <td className="py-3 px-3">
            <div className={`h-3.5 rounded bg-slate-800/70 ${showFullDate ? 'w-28' : 'w-14'}`} />
          </td>
          <td className="py-3 px-2">
            <div className="h-3.5 w-16 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 px-2">
            <div className="h-5 w-14 rounded-full bg-slate-800/70" />
          </td>
          <td className="py-3 px-2 text-right">
            <div className="ml-auto h-3.5 w-20 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 px-2 text-right">
            <div className="ml-auto h-3.5 w-12 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 px-2 text-right">
            <div className="ml-auto h-3.5 w-16 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 px-2 text-right">
            <div className="ml-auto h-3.5 w-24 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 px-2">
            <div className="h-3.5 w-20 rounded bg-slate-800/70" />
          </td>
          <td className="py-3 pr-3 pl-2">
            <div className="h-3.5 w-20 rounded bg-slate-800/70" />
          </td>
        </tr>
      ))}
    </>
  );
});

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

  const handleCopyOrderNumber = useCallback(async (e, orderNumber) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrderId(orderNumber);
      setTimeout(() => setCopiedOrderId((curr) => (curr === orderNumber ? null : curr)), 1500);
    } catch {
      // Fallback silencioso si los permisos de portapapeles están bloqueados
    }
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] table-fixed text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
            <th className={`py-2.5 px-3 font-medium align-middle whitespace-nowrap ${showFullDate ? 'w-[140px]' : 'w-[100px]'}`}>
              {showFullDate ? 'Fecha y Hora' : 'Hora (Hoy)'}
            </th>
            <th className="w-[105px] py-2.5 px-2 font-medium align-middle whitespace-nowrap">ID Orden</th>
            <th className="w-[100px] py-2.5 px-2 font-medium align-middle whitespace-nowrap">Tipo</th>
            <th className="w-[125px] py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Cantidad USDT</th>
            <th className="w-[110px] py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Comisión (USDT)</th>
            <th className="w-[110px] py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Tasa Unitaria</th>
            <th className="w-[130px] py-2.5 px-2 font-medium align-middle text-right whitespace-nowrap">Total Fiat</th>
            <th className="w-[130px] py-2.5 px-2 font-medium align-middle whitespace-nowrap">Método de Pago</th>
            <th className="min-w-[130px] py-2.5 pr-3 pl-2 font-medium align-middle whitespace-nowrap">Contraparte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-xs">
          {/* 1. Estado de carga inicial con Skeleton */}
          {loading && orders.length === 0 && (
            <TableSkeletonRows rowCount={5} showFullDate={showFullDate} />
          )}

          {/* 2. Listado de Órdenes */}
          {orders.map((o) => {
            const isSelected = selectedOrder?.id === o.id;
            const isCancelled = o.order_status === 'CANCELLED';
            const isInProgress = o.order_status === 'IN_PROGRESS';
            const isBuy = o.order_type === 'COMPRA';

            return (
              <tr
                key={o.id}
                onClick={() => onSelectOrder && onSelectOrder(o)}
                title="Clic para ver detalle completo de la orden"
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-800/70'
                    : isCancelled
                    ? 'bg-rose-950/10 opacity-55 hover:bg-rose-950/20'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Fecha / Hora */}
                <td
                  className="py-2.5 px-3 tabular-nums text-[11px] text-slate-400 align-middle whitespace-nowrap truncate"
                  title={fmtDateTime(o.order_date)}
                >
                  {showFullDate ? fmtDateTime(o.order_date) : fmtTime(o.order_date)}
                </td>

                {/* ID de Orden */}
                <td className="py-2.5 px-2 align-middle whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => handleCopyOrderNumber(e, o.order_number)}
                    title={`Clic para copiar ID completo: ${o.order_number}`}
                    className="group -ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                  >
                    <span className="font-mono">#{o.order_number?.slice(-8)}</span>
                    {copiedOrderId === o.order_number ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity" />
                    )}
                  </button>
                </td>

                {/* Tipo / Estado */}
                <td className="py-2.5 px-2 font-sans align-middle whitespace-nowrap">
                  <OrderStatusBadges orderType={o.order_type} orderStatus={o.order_status} />
                </td>

                {/* Cantidad USDT */}
                <td
                  className={`py-2.5 px-2 text-right tabular-nums font-semibold align-middle whitespace-nowrap ${
                    isCancelled
                      ? 'line-through text-slate-500'
                      : isInProgress
                      ? 'text-sky-300'
                      : isBuy
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {!isCancelled && (isBuy ? '+' : '-')}
                  {fmtAmount(o.crypto_amount, 2)}{' '}
                  <span className="text-[10px] font-normal text-slate-400">{o.asset}</span>
                </td>

                {/* Comisión USDT */}
                <td className="py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap">
                  {Number(o.commission_usdt) > 0 ? (
                    <span className="text-slate-400">-{fmtAmount(o.commission_usdt, 2)}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* Tasa Unitaria */}
                <td className="py-2.5 px-2 text-right tabular-nums text-slate-300 align-middle whitespace-nowrap">
                  {fmtRate(o.unit_price, 3)}
                </td>

                {/* Total Fiat */}
                <td
                  className={`py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap ${
                    isCancelled ? 'line-through text-slate-500' : 'text-slate-300 font-medium'
                  }`}
                >
                  {fmtAmount(o.fiat_amount, 2)}{' '}
                  <span className="text-[10px] text-slate-400">{o.fiat_currency}</span>
                </td>

                {/* Método de Pago */}
                <td className="py-2.5 px-2 font-sans text-slate-300 align-middle truncate" title={o.pay_method}>
                  <span className="truncate block">{o.pay_method || '—'}</span>
                </td>

                {/* Contraparte */}
                <td className="py-2.5 pr-3 pl-2 font-sans text-slate-300 align-middle truncate" title={o.counterparty}>
                  <span className="truncate block font-medium">{o.counterparty || '—'}</span>
                </td>
              </tr>
            );
          })}

          {/* 3. Estado Vacío (Sin resultados o sin operaciones) */}
          {!loading && orders.length === 0 && (
            <tr>
              <td colSpan={9} className="py-12 text-center font-sans text-sm text-slate-500">
                {tableSearch.trim() ? (
                  <div className="space-y-2">
                    <p className="text-slate-300">
                      No se encontró ninguna orden que coincida con &ldquo;{tableSearch.trim()}&rdquo;
                    </p>
                    {onClearSearch && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        icon={X}
                        onClick={onClearSearch}
                      >
                        Limpiar búsqueda
                      </Button>
                    )}
                  </div>
                ) : typeof emptyMessage === 'string' ? (
                  <div className="mx-auto max-w-md py-4 text-slate-400">
                    <p className="text-sm font-medium text-slate-300">{emptyMessage}</p>
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
