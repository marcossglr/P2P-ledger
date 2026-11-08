import React from 'react';
import { SlidersHorizontal, X, Search, ShieldCheck, Settings } from 'lucide-react';
import { Input } from '../ui';
import { parseSmartAmount } from '../../utils/formatters';

const AMOUNT_PRESETS = [
  { label: 'Todos', val: '' },
  { label: '1k', val: '1000' },
  { label: '5k', val: '5000' },
  { label: '10k', val: '10000' },
  { label: '25k', val: '25000' },
  { label: '50k', val: '50000' },
  { label: '100k', val: '100000' },
  { label: '250k', val: '250000' },
];

const PRICE_MODES = [
  { id: 'BEST', label: 'Mejor #1' },
  { id: 'TOP5', label: 'Top 5' },
  { id: 'TOP10', label: 'Top 10' },
  { id: 'WEIGHTED', label: 'Ponderado' },
];

export default function MarketFiltersPopover({
  popoverRef,
  onClose,
  fiat = 'VES',
  loadingPayMethods = false,
  binancePayMethods = [],
  payMethodSearch = '',
  setPayMethodSearch,
  displayedPayMethods = [],
  sortedPayMethods = [],
  showAllPayMethods = false,
  setShowAllPayMethods,
  selectedBank = 'ALL',
  updateBank,
  amountFilter = '',
  updateAmount,
  priceMode = 'BEST',
  updatePriceMode,
  onlyMerchants = false,
  updateMerchants,
  hasActiveFilters = false,
  onResetFilters,
  onOpenSettings,
}) {
  return (
    <div
      ref={popoverRef}
      className="absolute right-3 top-12 z-30 w-[calc(100%-1.5rem)] sm:w-[420px] rounded-2xl border border-slate-800 bg-slate-950/95 p-3.5 shadow-2xl shadow-black/90 backdrop-blur-md space-y-3 text-[11px] ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Cabecera del Popover */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
            Filtros del Mercado P2P
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sección 1: Métodos de Pago */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold text-[11px]">
            Método de pago ({fiat}):
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {loadingPayMethods
              ? 'Cargando métodos...'
              : binancePayMethods.length > 0
              ? `${binancePayMethods.length} en Binance`
              : 'Sin métodos'}
          </span>
        </div>

        {/* Micro-buscador de métodos */}
        {binancePayMethods.length > 8 && (
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={payMethodSearch}
              onChange={(e) => setPayMethodSearch(e.target.value)}
              placeholder="Buscar banco o método..."
              className="w-full h-7 pl-6 pr-6 rounded-lg bg-slate-900/90 border border-slate-800/90 text-slate-200 placeholder:text-slate-500 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            {payMethodSearch && (
              <button
                type="button"
                onClick={() => setPayMethodSearch('')}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Lista compacta de chips */}
        <div className="flex flex-wrap items-center gap-1 select-none">
          <button
            type="button"
            onClick={() => updateBank('ALL')}
            className={`h-6 px-2.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
              selectedBank === 'ALL'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/30'
                : 'border-slate-800/80 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            Todos los Métodos
          </button>

          {displayedPayMethods.map((m) => {
            const identifier = m.identifier || m.name;
            const displayName = m.name || identifier;
            const isSelected =
              selectedBank.toLowerCase() === identifier.toLowerCase() ||
              selectedBank.toLowerCase() === displayName.toLowerCase();

            return (
              <button
                key={identifier}
                type="button"
                onClick={() => updateBank(isSelected ? 'ALL' : identifier)}
                className={`h-6 px-2.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/30'
                    : 'border-slate-800/80 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
                title={displayName}
              >
                {displayName}
              </button>
            );
          })}

          {/* Pastilla 'Mostrar todos' / 'Mostrar menos' */}
          {!payMethodSearch && sortedPayMethods.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllPayMethods((prev) => !prev)}
              className="h-6 px-2.5 rounded-lg border border-dashed border-slate-700 bg-slate-900/50 text-slate-400 hover:border-amber-500/50 hover:text-amber-300 text-[10px] font-medium transition-all cursor-pointer"
            >
              {showAllPayMethods ? '▲ Menos' : `+${sortedPayMethods.length - 6} más...`}
            </button>
          )}
        </div>
      </div>

      {/* Sección 2: Monto en Fiat */}
      <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold text-[11px] block">
            Monto a simular ({fiat}):
          </span>
          {amountFilter && (
            <button
              type="button"
              onClick={() => updateAmount('')}
              className="text-[10px] text-slate-500 hover:text-amber-400 font-medium transition-colors cursor-pointer"
            >
              Restablecer
            </button>
          )}
        </div>

        {/* Input prioritario con sufijo fiat */}
        <div className="relative">
          <Input
            type="text"
            value={amountFilter}
            onChange={(e) => updateAmount(e.target.value)}
            placeholder="Ingresa monto (ej. 50k, 100000)"
            size="sm"
            className="font-mono text-xs pr-16 bg-slate-900/90"
            rightElement={
              <div className="flex items-center gap-1.5">
                {amountFilter && (
                  <button
                    type="button"
                    onClick={() => updateAmount('')}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {fiat}
                </span>
              </div>
            }
          />
        </div>

        {/* Fila de atajos rápidos */}
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {AMOUNT_PRESETS.map((preset) => {
            const isActive =
              amountFilter === preset.val ||
              (preset.val && parseSmartAmount(amountFilter) === Number(preset.val));

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateAmount(preset.val)}
                className={`h-6 px-2 rounded-lg border text-[10px] font-medium cursor-pointer transition-all ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-semibold ring-1 ring-amber-500/30'
                    : 'border-slate-800/80 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección 3: Criterio de Tasa + Verificados */}
      <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
        <span className="text-slate-300 font-semibold text-[11px] block">
          Criterio de cálculo y anunciantes:
        </span>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            {PRICE_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => updatePriceMode(mode.id)}
                className={`h-6 px-2 rounded-lg border text-[10px] font-medium cursor-pointer transition-all ${
                  priceMode === mode.id
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-semibold'
                    : 'border-slate-800/80 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateMerchants(!onlyMerchants)}
            className={`h-6 inline-flex items-center gap-1 px-2.5 rounded-lg border text-[10px] font-medium cursor-pointer transition-all ${
              onlyMerchants
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-semibold ring-1 ring-emerald-500/30'
                : 'border-slate-800/80 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            <span>Solo Verificados</span>
          </button>
        </div>
      </div>

      {/* Acciones inferiores del popover */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            <span>Restablecer filtros</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-500 font-mono">Filtros por defecto</span>
        )}

        {onOpenSettings && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Settings className="h-3 w-3" />
            <span>Ajustes Colector P2P</span>
          </button>
        )}
      </div>
    </div>
  );
}
