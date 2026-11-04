import React, { useState, useMemo, useEffect } from 'react';
import {
  History,
  Building2,
} from 'lucide-react';
import { fmtDateTime } from '../utils/formatters';
import { Modal, Button, Select, Badge } from './ui';

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
        <Badge variant="success" size="xs">
          Cuadre de Auditoría
        </Badge>
      );
    }
    if (type === 'SALDO_INICIAL_DIA') {
      return (
        <Badge variant="warning" size="xs">
          Apertura del Día
        </Badge>
      );
    }
    if (type === 'MOVIMIENTO_MANUAL') {
      return (
        <Badge variant="default" size="xs">
          Movimiento Manual
        </Badge>
      );
    }
    return (
      <Badge variant="default" size="xs">
        Saldo Base
      </Badge>
    );
  };

  const adjustmentsTitle = (
    <div className="flex items-center gap-2">
      <span className="truncate">Historial de Cuadres y Ajustes</span>
      <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-300">
        {filteredAdjustments.length}
      </span>
    </div>
  );

  const adjustmentsFooter = (
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={adjustmentsTitle}
      icon={History}
      footer={adjustmentsFooter}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Filtro por Banco */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Cuenta:</span>
            </label>
            <div className="w-48">
              <Select
                value={selectedBankFilter}
                onChange={(e) => setSelectedBankFilter(e.target.value)}
                size="xs"
              >
                <option value="ALL" className="bg-slate-900 text-slate-100">Todas las Cuentas</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-slate-900 text-slate-100">
                    {acc.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="space-y-3 pr-1 text-xs">
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
                    {fmtDateTime(adj.created_at_str || adj.created_at)}
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
      </div>
    </Modal>
  );
}
