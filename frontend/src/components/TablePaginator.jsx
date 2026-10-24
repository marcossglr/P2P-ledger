import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

export default function TablePaginator({
  totalItems = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'operaciones',
  compact = false,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generar números de página visibles con elipsis inteligente
  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (safePage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  if (totalItems === 0) return null;

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3.5 text-xs ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      {/* Izquierda: Rango actual y selector de filas por página */}
      <div className="flex flex-wrap items-center gap-3 text-slate-400">
        <span>
          Mostrando{' '}
          <strong className="tabular-nums font-semibold text-slate-200">
            {startItem}–{endItem}
          </strong>{' '}
          de{' '}
          <strong className="tabular-nums font-semibold text-slate-200">
            {totalItems}
          </strong>{' '}
          {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">·</span>
            <label className="text-slate-400">Filas:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-7 rounded-lg border border-slate-800 bg-slate-950 px-2 py-0 tabular-nums text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Derecha: Botones de navegación de páginas */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          title="Primera página"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="Página anterior"
          className="flex h-7 items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {!compact && <span>Anterior</span>}
        </button>

        <div className="flex items-center gap-1 px-1">
          {getVisiblePages().map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-500">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg px-2 tabular-nums text-xs transition-all ${
                  p === safePage
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-xs'
                    : 'border border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Página siguiente"
          className="flex h-7 items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          {!compact && <span>Siguiente</span>}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          title="Última página"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
