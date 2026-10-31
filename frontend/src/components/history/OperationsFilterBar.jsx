import React from 'react';
import {
  CalendarDays,
  ChevronDown,
  Calculator,
  Download,
  X,
} from 'lucide-react';

export default function OperationsFilterBar({
  activePreset,
  applyDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedAsset,
  fiatCurrency,
  onOpenPairModal,
  onNavigateFormulas,
  onExportExcel,
  ordersCount = 0,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de Período Histórico (Dropdown con valor por defecto Hoy) */}
        <div className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/80 px-2.5 text-xs shadow-xs">
          <CalendarDays className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <select
            value={activePreset}
            onChange={(e) => applyDatePreset(e.target.value)}
            className="bg-transparent font-medium text-slate-200 focus:outline-none cursor-pointer pr-1"
          >
            <option value="TODAY" className="bg-slate-900 text-slate-100">Hoy</option>
            <option value="YESTERDAY" className="bg-slate-900 text-slate-100">Ayer</option>
            <option value="7D" className="bg-slate-900 text-slate-100">Últimos 7 días</option>
            <option value="30D" className="bg-slate-900 text-slate-100">Últimos 30 días</option>
            <option value="90D" className="bg-slate-900 text-slate-100">Últimos 90 días</option>
            <option value="MONTH" className="bg-slate-900 text-slate-100">Este Mes</option>
            <option value="ALL" className="bg-slate-900 text-slate-100">Todo el Historial</option>
            <option value="CUSTOM" className="bg-slate-900 text-slate-100">Personalizado...</option>
          </select>
        </div>

        {/* Rango de fechas manual (visible únicamente cuando activePreset === 'CUSTOM') */}
        {activePreset === 'CUSTOM' && (
          <div className="flex h-8 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-slate-900/90 px-2.5 text-xs shadow-xs animate-in fade-in duration-150">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
              title="Fecha inicio"
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
              title="Fecha fin"
            />
            <button
              onClick={() => applyDatePreset('TODAY')}
              title="Cerrar personalizado y volver a Hoy"
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Botón Selector Unificado de Par de Mercado (Cripto / Fiat) */}
        <button
          type="button"
          onClick={onOpenPairModal}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/80 px-3 text-xs font-medium text-slate-200 hover:border-slate-700 hover:text-white transition-colors shadow-xs cursor-pointer group"
          title="Cambiar Criptoactivo y Moneda Fiat de análisis"
        >
          <span className="font-mono text-slate-200 group-hover:text-white transition-colors">{selectedAsset}</span>
          <span className="text-slate-500">/</span>
          <span className="font-mono text-slate-200 group-hover:text-white transition-colors">{fiatCurrency}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-200 transition-colors ml-0.5" />
        </button>
      </div>

      {/* Extremo derecho: Acciones de Documentación y Exportar con separación limpia */}
      <div className="flex items-center gap-2 ml-auto">
        {onNavigateFormulas && (
          <button
            type="button"
            onClick={onNavigateFormulas}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/80 px-3 text-xs font-medium text-slate-300 hover:border-amber-500/40 hover:text-amber-300 transition-colors shadow-xs whitespace-nowrap"
            title="Ver documentación contable y fórmulas de cálculo (WAC/WAP, Breakeven, P&L)"
          >
            <Calculator className="h-3.5 w-3.5 text-amber-400" />
            <span>Fórmulas</span>
          </button>
        )}

        <button
          onClick={onExportExcel}
          disabled={ordersCount === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors shadow-xs whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Exportar (.xlsx)</span>
        </button>
      </div>
    </div>
  );
}
