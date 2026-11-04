import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Building2,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import TablePaginator from './TablePaginator';
import { fmtDateTime } from '../utils/formatters';
import { Modal, Button, Select, Input, Badge } from './ui';

export default function BankMovementsModal({
  isOpen,
  onClose,
  initialAccountId = null,
  accounts = [],
  onReassignOrderBank,
}) {
  const [selectedBankId, setSelectedBankId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reassigningId, setReassigningId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedBankId(initialAccountId ? String(initialAccountId) : 'ALL');
      setSearchQuery('');
      setCurrentPage(1);
    }
  }, [isOpen, initialAccountId]);

  const activeAccount = useMemo(() => {
    if (selectedBankId === 'ALL') return null;
    return accounts.find((a) => String(a.id) === String(selectedBankId)) || null;
  }, [accounts, selectedBankId]);

  // Unificar movimientos según el filtro de banco
  const movementsList = useMemo(() => {
    const list = [];
    accounts.forEach((acc) => {
      if (selectedBankId !== 'ALL' && String(acc.id) !== String(selectedBankId)) {
        return;
      }
      (acc.recent_movements || []).forEach((m) => {
        list.push({
          ...m,
          account_id: acc.id,
          account_name: acc.name,
        });
      });
    });

    list.sort((a, b) => String(b.order_date || '').localeCompare(String(a.order_date || '')));

    const q = searchQuery.trim().toLowerCase().replace(/^#/, '');
    if (!q) return list;

    return list.filter((m) => {
      const num = String(m.order_number || '').toLowerCase();
      const cp = String(m.counterparty || '').toLowerCase();
      const pm = String(m.pay_method || '').toLowerCase();
      const amt = String(m.fiat_amount || '');
      const net = String(m.net_bs_impact || '');
      return (
        num.includes(q) ||
        cp.includes(q) ||
        pm.includes(q) ||
        amt.includes(q) ||
        net.includes(q)
      );
    });
  }, [accounts, selectedBankId, searchQuery]);

  const totalPages = Math.ceil(movementsList.length / pageSize) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedMovements = movementsList.slice(startIndex, startIndex + pageSize);

  const fmtBs = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleReassign = async (orderId, newBankId) => {
    if (!onReassignOrderBank) return;
    setReassigningId(orderId);
    try {
      await onReassignOrderBank(orderId, newBankId);
    } finally {
      setReassigningId(null);
    }
  };

  const movementsTitle = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="truncate">Movimientos Bancarios</span>
      {activeAccount ? (
        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          {activeAccount.name}
        </span>
      ) : (
        <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          Todos los Bancos
        </span>
      )}
    </div>
  );

  const movementsFooter = (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex-1 w-full">
        <TablePaginator
          totalItems={movementsList.length}
          currentPage={safePage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="movimientos bancarios"
          showTopBorder={false}
        />
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={onClose}
        className="w-full sm:w-auto"
      >
        Cerrar
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={movementsTitle}
      icon={Receipt}
      footer={movementsFooter}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Cuenta:</span>
            </label>
            <div className="w-56">
              <Select
                value={selectedBankId}
                onChange={(e) => {
                  setSelectedBankId(e.target.value);
                  setCurrentPage(1);
                }}
                size="xs"
              >
                <option value="ALL" className="bg-slate-900 text-slate-100">Todos los Bancos</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-slate-900 text-slate-100">
                    {acc.name} ({acc.total_historical_orders || 0})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="w-64">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar orden, monto, contraparte..."
              icon={Search}
              size="xs"
            />
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3 font-medium">Fecha / Orden</th>
                <th className="py-2.5 px-2 font-medium">Cuenta Asignada</th>
                <th className="py-2.5 px-2 font-medium">Operación</th>
                <th className="py-2.5 px-2 font-medium text-right">Monto Orden</th>
                <th className="py-2.5 pr-3 pl-2 font-medium text-right">Impacto en Banco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {paginatedMovements.map((m) => {
                const isSell = m.order_type === 'VENTA';
                const isUpdating = reassigningId === m.order_id;
                return (
                  <tr
                    key={`${m.order_id}-${m.order_number}`}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <span className="text-slate-200 tabular-nums block font-medium">
                        {fmtDateTime(m.order_date)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        <span className="font-mono text-slate-300">
                          #{String(m.order_number).slice(-8)}
                        </span>{' '}
                        · {m.counterparty}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        value={m.account_id}
                        disabled={isUpdating}
                        onChange={(e) => handleReassign(m.order_id, e.target.value)}
                        title="Reasignar a otra cuenta bancaria si el método vino cruzado"
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-slate-700 focus:border-amber-500 focus:outline-none disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <span className="block text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                        {m.pay_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isSell
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isSell ? 'VENTA (+Bs)' : 'COMPRA (-Bs)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-300 tabular-nums font-mono">
                      <div>{fmtBs(m.fiat_amount)} Bs</div>
                      {m.bank_fee_bs > 0 && (
                        <div className="text-[10px] text-rose-400 tabular-nums">
                          Com. {m.bank_fee_pct}%: -{fmtBs(m.bank_fee_bs)} Bs
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 pl-2 text-right font-bold tabular-nums font-mono">
                      <span
                        className={
                          Number(m.net_bs_impact || 0) > 0.01
                            ? 'text-emerald-400'
                            : Number(m.net_bs_impact || 0) < -0.01
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }
                      >
                        {Number(m.net_bs_impact || 0) > 0.01 ? '+' : ''}
                        {fmtBs(m.net_bs_impact)} Bs
                      </span>
                      {!m.included_after_anchor && (
                        <span
                          title="Esta orden ocurrió antes del último corte/cuadre manual, por lo que está absorbida en el Saldo Base"
                          className="block text-[10px] font-normal text-slate-500"
                        >
                          Previo al corte
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedMovements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    No se encontraron órdenes registradas para esta selección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
