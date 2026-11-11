import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Copy,
  Check,
  X,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Search,
} from 'lucide-react';
import { fmtTime, fmtDateTime, fmtAmount, fmtRate } from '../../utils/formatters';
import { Button, Badge, Input } from '../ui';
import TablePaginator from './TablePaginator';

/**
 * Esquema declarativo de columnas para evitar duplicación entre thead, skeleton y anchos
 */
const COLUMNS_CONFIG = [
  {
    key: 'order_date',
    labelShort: 'Hora (Hoy)',
    labelFull: 'Fecha y Hora',
    widthShort: 'w-[100px]',
    widthFull: 'w-[140px]',
    align: 'left',
    type: 'date',
    skeletonWidth: 'w-16',
    skeletonWidthFull: 'w-24',
    padding: 'px-3',
  },
  {
    key: 'order_number',
    labelShort: 'ID Orden',
    widthShort: 'w-[105px]',
    align: 'left',
    type: 'string',
    skeletonWidth: 'w-14',
    padding: 'px-2',
  },
  {
    key: 'order_type',
    labelShort: 'Tipo',
    widthShort: 'w-[100px]',
    align: 'left',
    type: 'string',
    skeletonWidth: 'w-14',
    padding: 'px-2',
  },
  {
    key: 'crypto_amount',
    labelShort: 'Cantidad USDT',
    widthShort: 'w-[125px]',
    align: 'right',
    type: 'number',
    skeletonWidth: 'w-20',
    padding: 'px-2',
  },
  {
    key: 'commission_usdt',
    labelShort: 'Comisión',
    widthShort: 'w-[100px]',
    align: 'right',
    type: 'number',
    skeletonWidth: 'w-12',
    padding: 'px-2',
  },
  {
    key: 'unit_price',
    labelShort: 'Tasa Unitaria',
    widthShort: 'w-[115px]',
    align: 'right',
    type: 'number',
    skeletonWidth: 'w-16',
    padding: 'px-2',
  },
  {
    key: 'fiat_amount',
    labelShort: 'Total Fiat',
    widthShort: 'w-[130px]',
    align: 'right',
    type: 'number',
    skeletonWidth: 'w-20',
    padding: 'px-2',
  },
  {
    key: 'pay_method',
    labelShort: 'Método de Pago',
    widthShort: 'w-[130px]',
    align: 'left',
    type: 'string',
    skeletonWidth: 'w-20',
    padding: 'px-2',
  },
  {
    key: 'counterparty',
    labelShort: 'Contraparte',
    widthShort: 'min-w-[130px]',
    align: 'left',
    type: 'string',
    skeletonWidth: 'w-24',
    padding: 'pr-3 pl-2',
  },
];

const ORDER_TYPES = [
  { id: 'ALL', label: 'Todas' },
  { id: 'COMPRA', label: 'Compras' },
  { id: 'VENTA', label: 'Ventas' },
];

/**
 * Cápsula segmentada unificada para grupos de pestañas (Regla de Radios Concéntricos: h-8 rounded-xl -> h-6 rounded-lg)
 */
const SegmentedCapsule = memo(function SegmentedCapsule({ items, value, onChange, getVariant }) {
  return (
    <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs shadow-xs shrink-0">
      {items.map((tab) => {
        const isActive = value === tab.id;
        const customActiveCls = getVariant ? getVariant(tab.id, isActive) : '';
        const defaultActiveCls = isActive
          ? 'bg-slate-800 text-white shadow'
          : 'text-slate-400 hover:text-slate-200';

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex h-6 items-center rounded-lg px-2.5 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              customActiveCls || defaultActiveCls
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

/**
 * Toolbar integrado y simplificado de filtros y buscador
 */
const TableToolbar = memo(function TableToolbar({
  orderType,
  onOrderTypeChange,
  orderStatus,
  onOrderStatusChange,
  stats = {},
  ordersCount = 0,
  tableSearch = '',
  onTableSearchChange,
  onClearSearch,
}) {
  const statusTabs = useMemo(
    () => [
      { id: 'ALL', label: `Todos (${stats.all_orders_count ?? ordersCount})` },
      { id: 'COMPLETED', label: `Completadas (${stats.completed_orders ?? stats.total_orders ?? 0})` },
      { id: 'IN_PROGRESS', label: `En Proceso (${stats.in_progress_orders ?? 0})` },
      { id: 'CANCELLED', label: `Canceladas (${stats.cancelled_orders ?? 0})` },
    ],
    [stats, ordersCount]
  );

  const getOrderTypeVariant = useCallback((id, isActive) => {
    if (!isActive) return 'text-slate-400 hover:text-slate-200';
    if (id === 'COMPRA') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold';
    if (id === 'VENTA') return 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold';
    return 'bg-slate-800 text-white shadow font-semibold';
  }, []);

  const getOrderStatusVariant = useCallback((id, isActive) => {
    if (!isActive) return 'text-slate-400 hover:text-slate-200';
    if (id === 'CANCELLED') return 'bg-slate-800 text-slate-300 border border-slate-700 font-semibold line-through';
    if (id === 'IN_PROGRESS') return 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold';
    if (id === 'COMPLETED') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold';
    return 'bg-slate-800 text-white shadow font-semibold';
  }, []);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
      {/* Filtros de la tabla (Tipo y Estado) */}
      <div className="flex flex-wrap items-center gap-2 max-w-full">
        {onOrderTypeChange && (
          <SegmentedCapsule
            items={ORDER_TYPES}
            value={orderType}
            onChange={onOrderTypeChange}
            getVariant={getOrderTypeVariant}
          />
        )}
        {onOrderStatusChange && (
          <SegmentedCapsule
            items={statusTabs}
            value={orderStatus}
            onChange={onOrderStatusChange}
            getVariant={getOrderStatusVariant}
          />
        )}
      </div>

      {/* Buscador de Orden Específica */}
      {onTableSearchChange && (
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Input
            type="text"
            value={tableSearch}
            onChange={(e) => onTableSearchChange(e.target.value)}
            placeholder="Buscar por ID, contraparte, monto..."
            icon={Search}
            rightElement={
              tableSearch ? (
                <button
                  type="button"
                  onClick={onClearSearch}
                  title="Limpiar búsqueda"
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
});

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
        variant={isCancelled ? 'default' : isBuy ? 'success' : 'danger'}
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
          variant="info"
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
 * Botón autocontenido para copiar ID de orden sin polucionar estado del padre
 */
const CopyableOrderId = memo(function CopyableOrderId({ orderNumber }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignorar si clipboard no tiene permiso
    }
  }, [orderNumber]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Clic para copiar ID completo: ${orderNumber}`}
      className="group -ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
    >
      <span className="font-mono">#{orderNumber?.slice(-8)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-40 group-hover:opacity-100 text-slate-400 group-hover:text-amber-300 transition-all" />
      )}
    </button>
  );
});

/**
 * Cabecera interactiva y ordenable
 */
const SortableHeader = memo(function SortableHeader({
  col,
  showFullDate,
  sortConfig,
  onSort,
}) {
  const label = showFullDate && col.labelFull ? col.labelFull : col.labelShort;
  const width = showFullDate && col.widthFull ? col.widthFull : col.widthShort;
  const isSorted = sortConfig.key === col.key;
  const isAsc = isSorted && sortConfig.direction === 'asc';
  const isDesc = isSorted && sortConfig.direction === 'desc';

  return (
    <th
      className={`py-2 ${col.padding} ${width} font-medium align-middle select-none transition-colors ${
        col.align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(col.key)}
        title={`Ordenar por ${label}`}
        className={`group inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-white cursor-pointer ${
          col.align === 'right' ? 'ml-auto flex-row-reverse text-right' : 'text-left'
        } ${isSorted ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
      >
        <span>{label}</span>
        <span className="shrink-0 text-slate-500 group-hover:text-amber-400">
          {isAsc ? (
            <ArrowUp className="h-3 w-3 text-amber-400" />
          ) : isDesc ? (
            <ArrowDown className="h-3 w-3 text-amber-400" />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-30 group-hover:opacity-80 transition-opacity" />
          )}
        </span>
      </button>
    </th>
  );
});

/**
 * Fila individual de operación memoizada con accesibilidad de teclado
 */
const OperationTableRow = memo(function OperationTableRow({
  order,
  isSelected,
  showFullDate,
  onSelect,
  onFilterCounterparty,
}) {
  const isCancelled = order.order_status === 'CANCELLED';
  const isInProgress = order.order_status === 'IN_PROGRESS';
  const isBuy = order.order_type === 'COMPRA';

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onSelect) onSelect(order);
      }
    },
    [onSelect, order]
  );

  return (
    <tr
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onSelect && onSelect(order)}
      title="Clic o pulsa Enter para ver detalle completo de la orden"
      className={`cursor-pointer transition-colors focus:outline-hidden focus:bg-slate-800/60 ${
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
        title={fmtDateTime(order.order_date)}
      >
        {showFullDate ? fmtDateTime(order.order_date) : fmtTime(order.order_date)}
      </td>

      {/* ID de Orden */}
      <td className="py-2.5 px-2 align-middle whitespace-nowrap">
        <CopyableOrderId orderNumber={order.order_number} />
      </td>

      {/* Tipo / Estado */}
      <td className="py-2.5 px-2 font-sans align-middle whitespace-nowrap">
        <OrderStatusBadges orderType={order.order_type} orderStatus={order.order_status} />
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
        {fmtAmount(order.crypto_amount, 2)}{' '}
        <span className="text-[10px] font-normal text-slate-400">{order.asset}</span>
      </td>

      {/* Comisión */}
      <td className="py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap">
        {Number(order.commission_usdt) > 0 ? (
          <span
            className="text-amber-400/90 font-mono text-[11px]"
            title={`Comisión deducida: ${fmtAmount(order.commission_usdt, 4)} USDT`}
          >
            -{fmtAmount(order.commission_usdt, 2)}{' '}
            <span className="text-[9px] text-amber-500/70 font-sans">USDT</span>
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Tasa Unitaria */}
      <td className="py-2.5 px-2 text-right tabular-nums text-slate-300 align-middle whitespace-nowrap">
        {fmtRate(order.unit_price, 3)}
      </td>

      {/* Total Fiat */}
      <td
        className={`py-2.5 px-2 text-right tabular-nums align-middle whitespace-nowrap ${
          isCancelled ? 'line-through text-slate-500' : 'text-slate-300 font-medium'
        }`}
      >
        {fmtAmount(order.fiat_amount, 2)}{' '}
        <span className="text-[10px] text-slate-400">{order.fiat_currency}</span>
      </td>

      {/* Método de Pago */}
      <td className="py-2.5 px-2 font-sans text-slate-300 align-middle truncate" title={order.pay_method}>
        <span className="truncate block font-medium text-slate-300">{order.pay_method || '—'}</span>
      </td>

      {/* Contraparte */}
      <td className="py-2.5 pr-3 pl-2 font-sans text-slate-300 align-middle truncate" title={order.counterparty}>
        <div className="flex items-center justify-between gap-1 group/cp">
          <span className="truncate block font-medium">{order.counterparty || '—'}</span>
          {onFilterCounterparty && order.counterparty && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterCounterparty(order.counterparty);
              }}
              title={`Filtrar todas las operaciones con ${order.counterparty}`}
              className="opacity-0 group-hover/cp:opacity-100 p-0.5 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
            >
              <User className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

/**
 * Skeleton loader sincronizado automáticamente con el esquema de columnas
 */
const TableSkeletonRows = memo(function TableSkeletonRows({ rowCount = 5, showFullDate = false }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, idx) => (
        <tr key={`skeleton-${idx}`} className="animate-pulse border-b border-slate-800/40">
          {COLUMNS_CONFIG.map((col) => {
            const w = showFullDate && col.skeletonWidthFull ? col.skeletonWidthFull : col.skeletonWidth;
            return (
              <td key={col.key} className={`py-2.5 ${col.padding}`}>
                <div
                  className={`h-3.5 rounded bg-slate-800/70 ${w} ${
                    col.align === 'right' ? 'ml-auto' : ''
                  }`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
});

/**
 * Componente unificado y autónomo para el Libro de Órdenes P2P (Toolbar + Tabla + Paginación integrada)
 */
function OperationsTable({
  orders = [],
  selectedOrder = null,
  onSelectOrder,
  showFullDate = false,
  loading = false,
  // Control de Toolbar integrado
  showToolbar = true,
  orderType,
  onOrderTypeChange,
  orderStatus,
  onOrderStatusChange,
  stats = {},
  ordersCount = 0,
  tableSearch = '',
  onTableSearchChange,
  onClearSearch,
  onFilterCounterparty,
  // Control de Paginación Integrada (Opcional)
  pagination = null,
  // Control de Ordenamiento Controlado (Opcional)
  sortConfig: externalSortConfig,
  onSortChange: externalOnSortChange,
  emptyMessage = 'No se encontraron operaciones con los filtros seleccionados.',
}) {
  const [internalSortConfig, setInternalSortConfig] = useState({ key: null, direction: null });
  const isControlledSort = externalSortConfig !== undefined && externalOnSortChange !== undefined;
  const sortConfig = isControlledSort ? externalSortConfig : internalSortConfig;

  const handleClear = useCallback(() => {
    if (onClearSearch) onClearSearch();
    else if (onTableSearchChange) onTableSearchChange('');
  }, [onClearSearch, onTableSearchChange]);

  const handleSort = useCallback((key) => {
    const nextDirection = (curr) => {
      if (curr.key !== key) return { key, direction: 'desc' };
      if (curr.direction === 'desc') return { key, direction: 'asc' };
      return { key: null, direction: null };
    };

    if (isControlledSort) {
      externalOnSortChange(nextDirection(sortConfig));
    } else {
      setInternalSortConfig((prev) => nextDirection(prev));
    }
  }, [isControlledSort, externalOnSortChange, sortConfig]);

  // Si el ordenamiento no es controlado externamente, ordenar localmente
  const displayOrders = useMemo(() => {
    if (isControlledSort || !sortConfig.key || !sortConfig.direction) return orders;

    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    const colDef = COLUMNS_CONFIG.find((c) => c.key === key);
    const colType = colDef?.type || 'string';

    return [...orders].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (colType === 'date') {
        return ((new Date(valA).getTime() || 0) - (new Date(valB).getTime() || 0)) * factor;
      }
      if (colType === 'number') {
        return (Number(valA || 0) - Number(valB || 0)) * factor;
      }
      return String(valA || '').localeCompare(String(valB || '')) * factor;
    });
  }, [orders, sortConfig, isControlledSort]);

  return (
    <div className="w-full">
      {/* 1. Toolbar Integrada (Filtros de Tipo, Estado y Buscador) */}
      {showToolbar && (
        <TableToolbar
          orderType={orderType}
          onOrderTypeChange={onOrderTypeChange}
          orderStatus={orderStatus}
          onOrderStatusChange={onOrderStatusChange}
          stats={stats}
          ordersCount={ordersCount || orders.length}
          tableSearch={tableSearch}
          onTableSearchChange={onTableSearchChange}
          onClearSearch={handleClear}
        />
      )}

      {/* 2. Contenedor de Tabla con Scroll Responsivo */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] table-fixed text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
              {COLUMNS_CONFIG.map((col) => (
                <SortableHeader
                  key={col.key}
                  col={col}
                  showFullDate={showFullDate}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {/* Estado de carga inicial con Skeleton */}
            {loading && displayOrders.length === 0 && (
              <TableSkeletonRows rowCount={5} showFullDate={showFullDate} />
            )}

            {/* Listado de Órdenes */}
            {displayOrders.map((o) => (
              <OperationTableRow
                key={o.id}
                order={o}
                isSelected={selectedOrder?.id === o.id}
                showFullDate={showFullDate}
                onSelect={onSelectOrder}
                onFilterCounterparty={onFilterCounterparty}
              />
            ))}

            {/* Estado Vacío */}
            {!loading && displayOrders.length === 0 && (
              <tr>
                <td colSpan={COLUMNS_CONFIG.length} className="py-12 text-center font-sans text-sm text-slate-500">
                  {tableSearch.trim() ? (
                    <div className="space-y-2">
                      <p className="text-slate-300">
                        No se encontró ninguna orden que coincida con &ldquo;{tableSearch.trim()}&rdquo;
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        icon={X}
                        onClick={handleClear}
                      >
                        Limpiar búsqueda
                      </Button>
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

      {/* 3. Paginación Integrada (Opcional, activa cuando se provee la prop pagination) */}
      {pagination && pagination.totalItems > 0 && (
        <TablePaginator
          totalItems={pagination.totalItems}
          currentPage={pagination.currentPage}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={pagination.pageSizeOptions || [10, 20, 50]}
          itemLabel={pagination.itemLabel || 'operaciones'}
        />
      )}
    </div>
  );
}

export default memo(OperationsTable);
