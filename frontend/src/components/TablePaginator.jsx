import React, { memo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button, Select } from './ui';

function TablePaginator({
  totalItems = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'operaciones',
  compact = false,
  showTopBorder = true,
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
      className={`flex flex-wrap items-center justify-between gap-3 text-xs ${
        showTopBorder ? 'mt-4 border-t border-slate-800/80 pt-3.5' : ''
      } ${compact ? 'text-[11px]' : 'text-xs'}`}
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
            <div className="w-20">
              <Select
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
                  onPageChange(1);
                }}
                size="xs"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-100">
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Derecha: Botones de navegación de páginas */}
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          title="Primera página"
          icon={ChevronsLeft}
        />

        <Button
          variant="secondary"
          size="xs"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="Página anterior"
          icon={ChevronLeft}
        >
          {!compact && <span>Anterior</span>}
        </Button>

        <div className="flex items-center gap-1 px-1">
          {getVisiblePages().map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-500 select-none">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === safePage ? 'primary' : 'secondary'}
                size="xs"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] tabular-nums ${
                  p === safePage
                    ? '!bg-amber-500/20 !text-amber-300 !border-amber-500/40 font-semibold shadow-xs'
                    : ''
                }`}
              >
                {p}
              </Button>
            )
          )}
        </div>

        <Button
          variant="secondary"
          size="xs"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Página siguiente"
        >
          {!compact && <span>Siguiente</span>}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="secondary"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          title="Última página"
          icon={ChevronsRight}
        />
      </div>
    </div>
  );
}

export default memo(TablePaginator);
