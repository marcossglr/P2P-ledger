import React, { memo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './ui';

const ORDER_TYPES = [
  { id: 'ALL', label: 'Todas' },
  { id: 'COMPRA', label: 'Compras' },
  { id: 'VENTA', label: 'Ventas' },
];

function OrdersToolbar({
  orderType,
  onOrderTypeChange,
  orderStatus,
  onOrderStatusChange,
  stats = {},
  ordersCount = 0,
  tableSearch,
  onTableSearchChange,
  onClearSearch,
}) {
  const statusTabs = [
    {
      id: 'ALL',
      label: `Todos (${stats.all_orders_count ?? ordersCount})`,
    },
    {
      id: 'COMPLETED',
      label: `Completadas (${stats.completed_orders ?? stats.total_orders ?? 0})`,
    },
    {
      id: 'IN_PROGRESS',
      label: `En Proceso (${stats.in_progress_orders ?? 0})`,
    },
    {
      id: 'CANCELLED',
      label: `Canceladas (${stats.cancelled_orders ?? 0})`,
    },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
      {/* Filtros de la tabla (Tipo y Estado) */}
      <div className="flex flex-wrap items-center gap-2 max-w-full">
        {/* Filtro: Tipo de Orden */}
        <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs shadow-xs shrink-0">
          {ORDER_TYPES.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onOrderTypeChange(tab.id)}
              className={`flex h-6 items-center rounded-lg px-2.5 font-medium transition-colors cursor-pointer ${
                orderType === tab.id
                  ? tab.id === 'COMPRA'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : tab.id === 'VENTA'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold'
                    : 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro: Estado de Orden */}
        <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs shadow-xs shrink-0">
          {statusTabs.map((stTab) => (
            <button
              key={stTab.id}
              onClick={() => onOrderStatusChange(stTab.id)}
              className={`flex h-6 items-center rounded-lg px-2.5 font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                orderStatus === stTab.id
                  ? stTab.id === 'CANCELLED'
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 font-semibold line-through'
                    : stTab.id === 'IN_PROGRESS'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                    : stTab.id === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {stTab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador de Orden Específica */}
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
    </div>
  );
}

export default memo(OrdersToolbar);
