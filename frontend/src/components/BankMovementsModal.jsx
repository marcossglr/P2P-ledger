import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Building2,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import TablePaginator from './TablePaginator';

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

  // Bloquear el scroll de la página de fondo
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn w-screen h-screen overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/90 text-slate-100 space-y-4 my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera Estándar Directa */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white truncate">
                Movimientos Bancarios
              </h3>
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

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="h-3 w-3 text-slate-400" />
              <span>Cuenta:</span>
            </label>
            <select
              value={selectedBankId}
              onChange={(e) => {
                setSelectedBankId(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">Todos los Bancos</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.total_historical_orders || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar orden, monto, contraparte..."
              className="w-64 rounded-xl border border-slate-800 bg-slate-950/60 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
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
                        {m.order_date}
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

        {/* Paginador y Pie alineado */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/60 shrink-0">
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

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
