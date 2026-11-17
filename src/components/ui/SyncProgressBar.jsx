import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Database, ArrowUpDown } from 'lucide-react';
import Badge from './Badge';

/**
 * Componente unificado para mostrar el progreso de sincronización con la API de Binance.
 * Cumple con las directrices de diseño de terminal financiero:
 * - Densidad compacta.
 * - Tipografía numérica monoespaciada (tabular-nums font-mono).
 * - Indicadores de fases (VALIDATING, FETCHING, SAVING, DONE, ERROR).
 */
export default function SyncProgressBar({ progress }) {
  if (!progress) return null;

  const {
    stage = 'VALIDATING',
    current_window = 0,
    total_windows = 1,
    percent = 0,
    orders_found = 0,
    message = '',
  } = progress;

  const isError = stage === 'ERROR';
  const isDone = stage === 'DONE';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5 animate-fadeIn">
      {/* Cabecera de estado */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isError ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : isDone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
          )}
          <span className="font-semibold text-slate-200">
            {stage === 'VALIDATING' && 'Validando credenciales...'}
            {stage === 'FETCHING' && 'Extrayendo órdenes P2P de Binance...'}
            {stage === 'SAVING' && 'Procesando en base de datos local...'}
            {isDone && 'Sincronización finalizada'}
            {isError && 'Error en la sincronización'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {orders_found > 0 && (
            <span className="font-mono tabular-nums text-slate-400 text-[11px] flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-amber-400/80" />
              {orders_found} {orders_found === 1 ? 'orden' : 'órdenes'}
            </span>
          )}
          <Badge
            variant={isError ? 'danger' : isDone ? 'success' : 'warning'}
            size="xs"
            className="font-mono tabular-nums"
          >
            {isError ? 'Fallo' : `${percent}%`}
          </Badge>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800/80">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${
            isError
              ? 'bg-rose-500'
              : isDone
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(isError ? 100 : 5, percent))}%` }}
        />
      </div>

      {/* Mensaje descriptivo / Ventana */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate pr-2">{message}</span>
        {total_windows > 1 && stage === 'FETCHING' && (
          <span className="font-mono tabular-nums text-slate-500 shrink-0">
            Ventana {current_window}/{total_windows}
          </span>
        )}
      </div>
    </div>
  );
}
