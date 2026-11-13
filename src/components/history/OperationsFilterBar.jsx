import React, { useRef } from 'react';
import {
  CalendarDays,
  Calendar,
  Calculator,
  Download,
  Coins,
  Percent,
  X,
} from 'lucide-react';
import { fmtDate } from '../../utils/formatters';
import { Button, Select, Badge } from '../ui';

export default function OperationsFilterBar({
  selectedAsset = 'USDT',
  onSelectAsset,
  availableAssets = ['USDT'],
  activePreset,
  applyDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  bankFeePct = 0,
  onNavigateFormulas,
  onExportExcel,
  ordersCount = 0,
}) {
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const isCustom = activePreset === 'CUSTOM';

  const openDatePicker = (ref) => {
    if (!isCustom && applyDatePreset) {
      applyDatePreset('CUSTOM');
    }
    setTimeout(() => {
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
    }, 20);
  };

  const handleStartDateChange = (newStart) => {
    setStartDate(newStart);
    if (endDate && newStart && newStart > endDate) {
      setEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd) => {
    setEndDate(newEnd);
    if (startDate && newEnd && newEnd < startDate) {
      setStartDate(newEnd);
    }
  };

  // Asegurar que USDT esté siempre presente y deduplicar
  const assetOptions = Array.from(new Set(['USDT', ...(availableAssets || [])]));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de Criptomoneda (a la izquierda del selector de fechas) */}
        <div className="w-32">
          <Select
            value={selectedAsset}
            onChange={(e) => onSelectAsset && onSelectAsset(e.target.value)}
            icon={Coins}
            size="sm"
            title="Seleccionar Criptomoneda a analizar"
          >
            <option value="ALL" className="bg-slate-900 text-slate-100 font-medium">
              Todas
            </option>
            {assetOptions.map((ast) => (
              <option key={ast} value={ast} className="bg-slate-900 text-slate-100 font-medium">
                {ast}
              </option>
            ))}
          </Select>
        </div>

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

        {/* Rango de fechas: editable con clic directo (activa automáticamente modo personalizado) */}
        <div
          className={`flex h-8 items-center gap-2 rounded-xl border px-3 text-xs shadow-xs transition-all ${
            isCustom
              ? 'border-amber-500/40 bg-slate-900/90'
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700/80 cursor-pointer'
          }`}
        >
          {/* Fecha Inicio con máscara DD/MM/AAAA */}
          <div
            onClick={() => openDatePicker(startInputRef)}
            className="relative flex items-center gap-1.5 py-0.5 cursor-pointer group"
            title="Clic para seleccionar fecha de inicio"
          >
            <Calendar
              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                isCustom ? 'text-amber-400 group-hover:text-amber-300' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            />
            <span
              className={`font-mono text-xs tabular-nums tracking-wide transition-colors ${
                isCustom ? 'text-slate-200 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              {startDate ? fmtDate(startDate) : '--/--/----'}
            </span>
            <input
              ref={startInputRef}
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="sr-only"
              aria-label="Fecha inicial de consulta"
            />
          </div>

          <span className="text-slate-600 text-xs select-none px-0.5">→</span>

          {/* Fecha Fin con máscara DD/MM/AAAA */}
          <div
            onClick={() => openDatePicker(endInputRef)}
            className="relative flex items-center gap-1.5 py-0.5 cursor-pointer group"
            title="Clic para seleccionar fecha de fin"
          >
            <Calendar
              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                isCustom ? 'text-amber-400 group-hover:text-amber-300' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            />
            <span
              className={`font-mono text-xs tabular-nums tracking-wide transition-colors ${
                isCustom ? 'text-slate-200 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            >
              {endDate ? fmtDate(endDate) : '--/--/----'}
            </span>
            <input
              ref={endInputRef}
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="sr-only"
              aria-label="Fecha final de consulta"
            />
          </div>

          {isCustom && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                applyDatePreset('TODAY');
              }}
              title="Cerrar personalizado y volver a Hoy"
              icon={X}
              className="ml-0.5 -mr-1 text-slate-400 hover:text-rose-400"
            />
          )}
        </div>

        {/* Indicador sutil de comisión bancaria estimada configurada */}
        {Number(bankFeePct) > 0 && (
          <Badge
            variant="neutral"
            className="h-8 px-2.5 text-[11px] font-mono text-slate-400 border border-slate-800/80 bg-slate-900/60 hidden xl:inline-flex items-center gap-1"
            title={`Tasa bancaria estimada para Pago Móvil / Interbancario: ${bankFeePct}%`}
          >
            <Percent className="h-3 w-3 text-amber-400/80" />
            <span>Comisión Banco: {bankFeePct}%</span>
          </Badge>
        )}
      </div>

      {/* Extremo derecho: Acciones de Documentación y Exportar con separación limpia */}
      <div className="flex items-center gap-2 ml-auto">
        {onNavigateFormulas && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onNavigateFormulas}
            icon={Calculator}
            title="Ver documentación contable y fórmulas de cálculo (WAC/WAP, P&L)"
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
