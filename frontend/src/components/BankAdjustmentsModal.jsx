import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  History,
  Building2,
} from 'lucide-react';

export default function BankAdjustmentsModal({
  isOpen,
  onClose,
  adjustments = [],
  accounts = [],
}) {
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');

  useEffect(() => {
    if (isOpen) {
      setSelectedBankFilter('ALL');
    }
  }, [isOpen]);

  // Soporte para cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Bloquear scroll de la página de fondo
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const filteredAdjustments = useMemo(() => {
    if (selectedBankFilter === 'ALL') return adjustments;
    return adjustments.filter(
      (adj) => String(adj.account_id) === String(selectedBankFilter)
    );
  }, [adjustments, selectedBankFilter]);

  const fmtBs = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const renderAdjustmentBadge = (type) => {
    if (type === 'CUADRE_CONSOLIDADO') {
      return (
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          Cuadre de Auditoría
        </span>
      );
    }
    if (type === 'SALDO_INICIAL_DIA') {
      return (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          Apertura del Día
        </span>
      );
    }
    if (type === 'MOVIMIENTO_MANUAL') {
      return (
        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
          Movimiento Manual
        </span>
      );
    }
    return (
      <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
        Saldo Base
      </span>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn w-screen h-screen overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/90 text-slate-100 space-y-4 my-auto max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera Estándar Directa */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">
                Historial de Cuadres y Ajustes
              </h3>
              <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300">
                {filteredAdjustments.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Cerrar modal (Esc)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtro por Banco */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400" />
              <span>Cuenta:</span>
            </label>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">Todas las Cuentas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {filteredAdjustments.map((adj) => {
            const hasDiff = Math.abs(adj.delta_amount || 0) >= 0.01;
            return (
              <div
                key={adj.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{adj.account_name}</span>
                    {renderAdjustmentBadge(adj.adjustment_type)}
                  </div>
                  <span className="text-[11px] tabular-nums font-mono text-slate-400">
                    {adj.created_at}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900/60 p-2.5 text-xs tabular-nums border border-slate-800/60">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Sistema Antes
                    </span>
                    <span className="font-mono text-slate-300 font-medium">
                      {fmtBs(adj.previous_balance)} Bs
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Nuevo Saldo
                    </span>
                    <span className="font-mono font-bold text-white">
                      {fmtBs(adj.new_balance)} Bs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Diferencia
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        !hasDiff
                          ? 'text-slate-400'
                          : adj.delta_amount > 0.01
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {adj.delta_amount > 0.01 ? '+' : ''}
                      {fmtBs(adj.delta_amount)} Bs
                    </span>
                  </div>
                </div>

                {adj.note && (
                  <p className="text-[11px] text-slate-300 bg-slate-900/40 rounded-lg px-2.5 py-1.5 border border-slate-800/50">
                    Nota: “{adj.note}”
                  </p>
                )}
              </div>
            );
          })}

          {filteredAdjustments.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              No hay registros de cuadres o ajustes para esta selección.
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex justify-end pt-3 border-t border-slate-800/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
