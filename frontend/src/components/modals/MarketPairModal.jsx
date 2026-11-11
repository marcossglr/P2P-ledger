import React from 'react';
import { Coins, Check } from 'lucide-react';
import { Modal, Button } from '../ui';

export default function MarketPairModal({
  isOpen,
  onClose,
  selectedAsset = 'USDT',
  selectedFiat = 'VES',
  availableAssets = ['USDT'],
  availableFiats = ['VES'],
  onSelectPair,
}) {
  const pairModalFooter = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="secondary" size="sm" onClick={onClose}>
        Cerrar
      </Button>
      <Button variant="primary" size="sm" onClick={onClose}>
        Confirmar
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Par de Mercado"
      icon={Coins}
      footer={pairModalFooter}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
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
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
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
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
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
      </div>
    </Modal>
  );
}
