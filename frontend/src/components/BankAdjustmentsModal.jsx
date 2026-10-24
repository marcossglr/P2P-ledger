import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Building2,
  Scale,
  Calendar,
} from 'lucide-react';

export default function BankAdjustmentsModal({
  isOpen,
  onClose,
  adjustments = [],
  accounts = [],
}) {
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');

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
        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          Cuadre de Auditoría
        </span>
      );
    }
    if (type === 'SALDO_INICIAL_DIA') {
      return (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          Apertura del Día
        </span>
      );
    }
    if (type === 'MOVIMIENTO_MANUAL') {
      return (
        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
          Movimiento Manual
        </span>
      );
    }
    return (
      <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
        Saldo Base
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Bitácora de Cuadres y Ajustes
                </h3>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  {filteredAdjustments.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Historial de saldos fijados, aperturas y variaciones manuales de inventario
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-slate-400 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtro por Banco */}
        <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Filtrar por Cuenta:</span>
            <select
              value={selectedBankFilter}
              onChange={(e) => setSelectedBankFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-amber-500 focus:outline-none transition-colors"
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {filteredAdjustments.map((adj) => {
            const hasDiff = Math.abs(adj.delta_amount || 0) >= 0.01;
            return (
              <div
                key={adj.id}
                className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{adj.account_name}</span>
                    {renderAdjustmentBadge(adj.adjustment_type)}
                  </div>
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {adj.created_at}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900/90 p-2.5 text-xs tabular-nums border border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">
                      Sistema Antes
                    </span>
                    <span className="text-slate-300 font-medium">
                      {fmtBs(adj.previous_balance)} Bs
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">
                      Nuevo Saldo
                    </span>
                    <span className="font-bold text-white">
                      {fmtBs(adj.new_balance)} Bs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold tracking-wider">
                      Diferencia
                    </span>
                    <span
                      className={`font-bold ${
                        !hasDiff
                          ? 'text-slate-300'
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
                  <p className="text-[11px] text-slate-400 italic bg-slate-900/40 rounded-lg px-2.5 py-1.5 border border-slate-800/40">
                    “{adj.note}”
                  </p>
                )}
              </div>
            );
          })}

          {filteredAdjustments.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              No hay registros de cuadres o ajustes para esta cuenta.
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex justify-end border-t border-slate-800/80 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
