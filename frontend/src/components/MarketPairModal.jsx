import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins, DollarSign, Check } from 'lucide-react';

export default function MarketPairModal({
  isOpen,
  onClose,
  selectedAsset = 'USDT',
  selectedFiat = 'VES',
  availableAssets = ['USDT'],
  availableFiats = ['VES'],
  onSelectPair,
}) {
  // Soporte para cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Bloquear el scroll de la página de fondo mientras el modal esté abierto
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn w-screen h-screen overflow-y-auto"
      onClick={onClose}
    >
      {/* Contenedor del Modal */}
      <div
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/90 text-slate-100 space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera limpia y directa */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Coins className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Par de Mercado
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar modal (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sección 1: Criptoactivo Base */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Criptoactivo Base</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableAssets.map((asset) => {
              const isSelected = selectedAsset === asset;
              return (
                <button
                  key={asset}
                  type="button"
                  onClick={() => onSelectPair(asset, selectedFiat)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-xs'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <span className="font-mono">{asset}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sección 2: Moneda Fiat */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>Moneda Fiat de Liquidación</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableFiats.map((fiat) => {
              const isSelected = selectedFiat === fiat;
              return (
                <button
                  key={fiat}
                  type="button"
                  onClick={() => onSelectPair(selectedAsset, fiat)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-xs'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <span className="font-mono">{fiat}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Par Activo Resultante */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 flex items-center justify-between text-xs">
          <span className="text-slate-400">Par activo actual:</span>
          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
            {selectedAsset} / {selectedFiat}
          </span>
        </div>

        {/* Botón de Confirmación / Cierre */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 transition-all shadow-xs cursor-pointer"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
