import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { SlidersHorizontal, X, Search, ShieldCheck, Settings, Check } from 'lucide-react';
import { Input, Button, Badge, Switch } from '../ui';
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

const DEFAULT_CRYPTO_FALLBACK = [
  { id: 'USDT', label: 'USDT', name: 'Tether' },
  { id: 'BTC', label: 'BTC', name: 'Bitcoin' },
  { id: 'ETH', label: 'ETH', name: 'Ethereum' },
  { id: 'USDC', label: 'USDC', name: 'USD Coin' },
  { id: 'BNB', label: 'BNB', name: 'BNB' },
];

function MarketFiltersPopover({
  onClose,
  fiat = 'VES',
  asset = 'USDT',
  marketBoard = {},
  onOpenSettings,
}) {
  const {
    selectedAsset = asset || 'USDT',
    updateAsset,
    availableAssets = [],
    loadingAssets = false,
    binancePayMethods = [],
    loadingPayMethods = false,
    selectedBank = 'ALL',
    updateBank,
    amountFilter = '',
    updateAmount,
    onlyMerchants = false,
    updateMerchants,
    hasActiveFilters = false,
    resetFilters,
  } = marketBoard;

  const cryptoList = availableAssets.length > 0 ? availableAssets : DEFAULT_CRYPTO_FALLBACK;

  const popoverRef = useRef(null);

  // --- Estado Local 1: Input de Monto con Debounce ---
  const [localAmount, setLocalAmount] = useState(amountFilter);
  const isFirstMountRef = useRef(true);

  // Sincronizar si cambia externamente (ej: resetFilters)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setLocalAmount(amountFilter);
  }, [amountFilter]);

  // Debounce para actualizar el monto en el hook global sin bloquear la red en cada tecla
  useEffect(() => {
    if (localAmount === amountFilter) return;

    const timer = setTimeout(() => {
      if (updateAmount) {
        updateAmount(localAmount);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [localAmount, amountFilter, updateAmount]);

  // --- Estado Local 2: Micro-buscador de Métodos de Pago ---
  const [payMethodSearch, setPayMethodSearch] = useState('');
  const [showAllPayMethods, setShowAllPayMethods] = useState(false);

  // Lista optimizada y memoizada de métodos de pago
  const displayedPayMethods = useMemo(() => {
    const list = binancePayMethods;
    const query = payMethodSearch.trim().toLowerCase();

    if (query) {
      return list.filter(
        (m) =>
          m.name?.toLowerCase().includes(query) ||
          m.identifier?.toLowerCase().includes(query) ||
          m.short_name?.toLowerCase().includes(query)
      );
    }

    if (!showAllPayMethods && list.length > 6) {
      const top = list.slice(0, 6);
      const isSelectedInTop = top.some(
        (m) =>
          m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
          m.name?.toLowerCase() === selectedBank.toLowerCase()
      );
      if (!isSelectedInTop && selectedBank !== 'ALL') {
        const activeItem = list.find(
          (m) =>
            m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
            m.name?.toLowerCase() === selectedBank.toLowerCase()
        );
        if (activeItem) {
          return [...top.slice(0, 5), activeItem];
        }
      }
      return top;
    }
    return list;
  }, [binancePayMethods, payMethodSearch, showAllPayMethods, selectedBank]);

  // --- Detección de Clic Exterior y Tecla Escape ---
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePresetClick = (val) => {
    setLocalAmount(val);
    if (updateAmount) {
      updateAmount(val);
    }
  };

  const parsedSimulatedAmount = parseSmartAmount(localAmount);

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
          {hasActiveFilters && (
            <Badge variant="warning" size="xs">
              Activos
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          icon={X}
          title="Cerrar panel (Esc)"
        />
      </div>

      {/* Sección 1: Selección de Criptoactivo */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold text-[11px]">
            Criptomoneda:
          </span>
          <span className="text-[10px] text-amber-400 font-mono font-medium">
            Par: {selectedAsset}/{fiat}
          </span>
        </div>

        {/* Chips Concéntricos de Criptoactivos */}
        <div className="flex flex-wrap gap-1">
          {cryptoList.map((c) => {
            const isSelected = selectedAsset === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => updateAsset && updateAsset(c.id)}
                className={`h-6 rounded-lg px-2 text-[10px] font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-200 shadow-xs'
                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={c.name}
              >
                {isSelected ? (
                  <Check className="h-2.5 w-2.5 shrink-0 text-amber-300" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
                )}
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección 2: Métodos de Pago */}
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
            <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={payMethodSearch}
              onChange={(e) => setPayMethodSearch(e.target.value)}
              placeholder="Buscar banco o método..."
              className="w-full h-8 pl-7 pr-7 rounded-xl bg-slate-900/90 border border-slate-800/90 text-slate-200 placeholder:text-slate-500 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            {payMethodSearch && (
              <button
                type="button"
                onClick={() => setPayMethodSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Chips de Selección de Métodos */}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => updateBank && updateBank('ALL')}
            className={`h-6 rounded-lg px-2 text-[10px] font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
              selectedBank === 'ALL'
                ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {selectedBank === 'ALL' ? (
              <Check className="h-2.5 w-2.5 shrink-0 text-amber-300" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
            )}
            Todos los bancos
          </button>

          {displayedPayMethods.map((m) => {
            const ident = m.identifier || m.name;
            const isSelected =
              selectedBank?.toLowerCase() === ident?.toLowerCase() ||
              selectedBank?.toLowerCase() === m.name?.toLowerCase();

            return (
              <button
                key={ident}
                type="button"
                onClick={() => updateBank && updateBank(ident)}
                className={`h-6 rounded-lg px-2 text-[10px] font-medium transition-colors cursor-pointer border truncate max-w-[130px] inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-200 font-semibold'
                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={m.name}
              >
                {isSelected ? (
                  <Check className="h-2.5 w-2.5 shrink-0 text-amber-300" />
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: m.bg_color || '#94A3B8',
                    }}
                  />
                )}
                <span className="truncate">{m.short_name || m.name}</span>
              </button>
            );
          })}

          {binancePayMethods.length > 6 && !payMethodSearch.trim() && (
            <button
              type="button"
              onClick={() => setShowAllPayMethods((prev) => !prev)}
              className="h-6 rounded-lg px-2 text-[10px] font-semibold border border-dashed border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors cursor-pointer"
            >
              {showAllPayMethods ? 'Mostrar menos' : `+${binancePayMethods.length - 6} más`}
            </button>
          )}
        </div>
      </div>

      {/* Sección 2: Monto a Simular */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold text-[11px]">
            Filtrar por monto ({fiat}):
          </span>
          {localAmount && (
            <span className="text-[10px] font-mono text-amber-300">
              {parsedSimulatedAmount != null
                ? `≥ ${parsedSimulatedAmount.toLocaleString('es-VE')} ${fiat}`
                : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="text"
            size="sm"
            value={localAmount}
            onChange={(e) => setLocalAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && updateAmount) {
                updateAmount(localAmount);
              }
            }}
            placeholder="Ej: 5000, 10k, 50k..."
            className="flex-1 font-mono text-xs"
            rightElement={
              localAmount ? (
                <button
                  type="button"
                  onClick={() => {
                    setLocalAmount('');
                    if (updateAmount) updateAmount('');
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  title="Borrar monto"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null
            }
          />
        </div>

        {/* Presets Rápidos de Monto */}
        <div className="flex flex-wrap gap-1">
          {AMOUNT_PRESETS.map((p) => {
            const isSelected =
              p.val === ''
                ? localAmount === ''
                : parsedSimulatedAmount === Number(p.val);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetClick(p.val)}
                className={`h-5 rounded-md px-1.5 text-[9px] font-mono transition-colors cursor-pointer border ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold'
                    : 'border-slate-800/80 bg-slate-900/60 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección 3: Toggle Solo Comerciantes Verificados */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldCheck
            className={`h-3.5 w-3.5 transition-colors ${
              onlyMerchants ? 'text-amber-400' : 'text-slate-500'
            }`}
          />
          <span className="text-[11px] font-medium">Solo comerciantes verificados</span>
        </div>
        <Switch
          size="xs"
          checked={onlyMerchants}
          onChange={(val) => updateMerchants && updateMerchants(val)}
        />
      </div>

      {/* Pie del Popover: Acciones Rápidas */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setLocalAmount('');
              resetFilters?.();
            }}
            className="text-rose-400 hover:text-rose-300 font-semibold px-1"
          >
            Limpiar filtros
          </Button>
        ) : (
          <span className="text-[10px] text-slate-500">Sin filtros activos</span>
        )}

        <div className="flex items-center gap-1.5">
          {onOpenSettings && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                onClose?.();
                onOpenSettings();
              }}
              icon={Settings}
              className="text-slate-400 hover:text-amber-300"
            >
              Ajustes
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="xs"
            onClick={() => {
              if (localAmount !== amountFilter && updateAmount) {
                updateAmount(localAmount);
              }
              onClose?.();
            }}
          >
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(MarketFiltersPopover);
