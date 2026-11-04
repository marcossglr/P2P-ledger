import React, { useRef } from 'react';
import {
  CalendarDays,
  Calendar,
  ChevronDown,
  Calculator,
  Download,
  X,
} from 'lucide-react';
import { fmtDate } from '../../utils/formatters';
import { Button, Select } from '../ui';

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
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const openDatePicker = (ref) => {
    if (!ref?.current) return;
    if (typeof ref.current.showPicker === 'function') {
      try {
        ref.current.showPicker();
      } catch {
        ref.current.focus();
      }
    } else {
      ref.current.focus();
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de Período Histórico (Dropdown con valor por defecto Hoy) */}
        <div className="w-44">
          <Select
            value={activePreset}
            onChange={(e) => applyDatePreset(e.target.value)}
            icon={CalendarDays}
            size="sm"
          >
            <option value="TODAY" className="bg-slate-900 text-slate-100">Hoy</option>
            <option value="YESTERDAY" className="bg-slate-900 text-slate-100">Ayer</option>
            <option value="7D" className="bg-slate-900 text-slate-100">Últimos 7 días</option>
            <option value="30D" className="bg-slate-900 text-slate-100">Últimos 30 días</option>
            <option value="90D" className="bg-slate-900 text-slate-100">Últimos 90 días</option>
            <option value="MONTH" className="bg-slate-900 text-slate-100">Este Mes</option>
            <option value="ALL" className="bg-slate-900 text-slate-100">Todo el Historial</option>
            <option value="CUSTOM" className="bg-slate-900 text-slate-100">Personalizado...</option>
          </Select>
        </div>

        {/* Rango de fechas manual (visible únicamente cuando activePreset === 'CUSTOM') */}
        {activePreset === 'CUSTOM' && (
          <div className="flex h-8 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-slate-900/90 px-2.5 text-xs shadow-xs animate-in fade-in duration-150">
            {/* Fecha Inicio con máscara DD/MM/AAAA */}
            <div
              onClick={() => openDatePicker(startInputRef)}
              className="relative flex items-center gap-1 cursor-pointer group"
              title="Clic para seleccionar fecha de inicio"
            >
              <Calendar className="h-3 w-3 text-amber-400/80 group-hover:text-amber-300 transition-colors shrink-0" />
              <span className="font-mono text-xs text-slate-200 group-hover:text-white tabular-nums transition-colors">
                {startDate ? fmtDate(startDate) : 'DD/MM/AAAA'}
              </span>
              <input
                ref={startInputRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <span className="text-slate-500 text-xs select-none">→</span>

            {/* Fecha Fin con máscara DD/MM/AAAA */}
            <div
              onClick={() => openDatePicker(endInputRef)}
              className="relative flex items-center gap-1 cursor-pointer group"
              title="Clic para seleccionar fecha de fin"
            >
              <Calendar className="h-3 w-3 text-amber-400/80 group-hover:text-amber-300 transition-colors shrink-0" />
              <span className="font-mono text-xs text-slate-200 group-hover:text-white tabular-nums transition-colors">
                {endDate ? fmtDate(endDate) : 'DD/MM/AAAA'}
              </span>
              <input
                ref={endInputRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => applyDatePreset('TODAY')}
              title="Cerrar personalizado y volver a Hoy"
              icon={X}
            />
          </div>
        )}

        {/* Botón Selector Unificado de Par de Mercado (Cripto / Fiat) */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenPairModal}
          title="Cambiar Criptoactivo y Moneda Fiat de análisis"
          className="group"
        >
          <span className="font-mono text-slate-200 group-hover:text-white transition-colors">{selectedAsset}</span>
          <span className="text-slate-500">/</span>
          <span className="font-mono text-slate-200 group-hover:text-white transition-colors">{fiatCurrency}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-200 transition-colors ml-0.5" />
        </Button>
      </div>

      {/* Extremo derecho: Acciones de Documentación y Exportar con separación limpia */}
      <div className="flex items-center gap-2 ml-auto">
        {onNavigateFormulas && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateFormulas}
            icon={Calculator}
            title="Ver documentación contable y fórmulas de cálculo (WAC/WAP, Breakeven, P&L)"
          >
            <span>Fórmulas</span>
          </Button>
        )}

        <Button
          variant="emerald"
          size="sm"
          onClick={onExportExcel}
          disabled={ordersCount === 0}
          icon={Download}
        >
          <span>Exportar (.xlsx)</span>
        </Button>
      </div>
    </div>
  );
}
