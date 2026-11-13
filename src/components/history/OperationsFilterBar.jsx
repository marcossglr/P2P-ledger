import React, { useRef } from 'react';
import {
  CalendarDays,
  Calendar,
  Calculator,
  Download,
  Coins,
  X,
} from 'lucide-react';
import { fmtDate } from '../../utils/formatters';
import { Button, Select } from '../ui';

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
  onNavigateFormulas,
  onExportExcel,
  ordersCount = 0,
}) {
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);

  const isCustom = activePreset === 'CUSTOM';

  const openDatePicker = (ref) => {
    if (!isCustom || !ref?.current) return;
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

        {/* Rango de fechas: editable cuando activePreset === 'CUSTOM', inactivo/referencial en otros presets */}
        <div
          className={`flex h-8 items-center gap-2 rounded-xl border px-3 text-xs shadow-xs transition-all ${
            isCustom
              ? 'border-amber-500/30 bg-slate-900/90'
              : 'border-slate-800 bg-slate-900/40 opacity-70 select-none'
          }`}
        >
          {/* Fecha Inicio con máscara DD/MM/AAAA */}
          <div
            onClick={() => isCustom && openDatePicker(startInputRef)}
            className={`relative flex items-center gap-1.5 py-0.5 ${
              isCustom ? 'cursor-pointer group' : 'cursor-not-allowed'
            }`}
            title={isCustom ? 'Clic para seleccionar fecha de inicio' : 'Activa el filtro "Personalizado..." para modificar las fechas'}
          >
            <Calendar
              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                isCustom ? 'text-amber-400 group-hover:text-amber-300' : 'text-slate-500'
              }`}
            />
            <span
              className={`font-mono text-xs tabular-nums tracking-wide transition-colors ${
                isCustom ? 'text-slate-200 group-hover:text-white' : 'text-slate-400'
              }`}
            >
              {startDate ? fmtDate(startDate) : '--/--/----'}
            </span>
            <input
              ref={startInputRef}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!isCustom}
              className="sr-only"
              tabIndex={isCustom ? 0 : -1}
              aria-hidden="true"
            />
          </div>

          <span className="text-slate-600 text-xs select-none px-0.5">→</span>

          {/* Fecha Fin con máscara DD/MM/AAAA */}
          <div
            onClick={() => isCustom && openDatePicker(endInputRef)}
            className={`relative flex items-center gap-1.5 py-0.5 ${
              isCustom ? 'cursor-pointer group' : 'cursor-not-allowed'
            }`}
            title={isCustom ? 'Clic para seleccionar fecha de fin' : 'Activa el filtro "Personalizado..." para modificar las fechas'}
          >
            <Calendar
              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                isCustom ? 'text-amber-400 group-hover:text-amber-300' : 'text-slate-500'
              }`}
            />
            <span
              className={`font-mono text-xs tabular-nums tracking-wide transition-colors ${
                isCustom ? 'text-slate-200 group-hover:text-white' : 'text-slate-400'
              }`}
            >
              {endDate ? fmtDate(endDate) : '--/--/----'}
            </span>
            <input
              ref={endInputRef}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!isCustom}
              className="sr-only"
              tabIndex={isCustom ? 0 : -1}
              aria-hidden="true"
            />
          </div>

          {isCustom && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => applyDatePreset('TODAY')}
              title="Cerrar personalizado y volver a Hoy"
              icon={X}
              className="ml-0.5 -mr-1 text-slate-400 hover:text-rose-400"
            />
          )}
        </div>
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
