import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, AlertTriangle, Link2, AlertCircle } from 'lucide-react';
import FileDropzone from './FileDropzone';
import TablePaginator from './TablePaginator';
import { fmtDateTime, fmtDate } from '../utils/formatters';
import { reconciliationApi } from '../services/api';
import { Button, Badge } from './ui';

export default function BankReconcilerView() {
  const [bankBatch, setBankBatch] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [activeTab, setActiveTab] = useState('MATCHED');

  // Paginación para tabla de conciliadas y listas de excepciones
  const [matchedPage, setMatchedPage] = useState(1);
  const [matchedPageSize, setMatchedPageSize] = useState(10);
  const [unmatchedOrdersPage, setUnmatchedOrdersPage] = useState(1);
  const [unmatchedBankPage, setUnmatchedBankPage] = useState(1);
  const exceptionsPageSize = 8;

  const runAutoReconcile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reconciliationApi.reconcileWithBank(2);
      setReconciliation(data);
      setMatchedPage(1);
      setUnmatchedOrdersPage(1);
      setUnmatchedBankPage(1);
    } catch (err) {
      console.error('Error al conciliar:', err);
      setError(err.message || 'Error al conciliar movimientos con el banco');
    } finally {
      setLoading(false);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedOrderId || !selectedBankId) return;
    setError(null);
    try {
      await reconciliationApi.manualMatch(selectedOrderId, selectedBankId);
      setSelectedOrderId(null);
      setSelectedBankId(null);
      runAutoReconcile();
    } catch (err) {
      console.error('Error al conciliar manualmente:', err);
      setError(err.message || 'Error al emparejar manualmente');
    }
  };

  const matchedPairs = reconciliation?.matched_pairs || [];
  const unmatchedOrders = reconciliation?.unmatched_orders || [];
  const unmatchedBank = reconciliation?.unmatched_bank || [];

  const safeMatchedPage = Math.min(
    matchedPage,
    Math.max(1, Math.ceil(matchedPairs.length / matchedPageSize))
  );
  const paginatedMatched = matchedPairs.slice(
    (safeMatchedPage - 1) * matchedPageSize,
    safeMatchedPage * matchedPageSize
  );

  const safeUnmatchedOrdersPage = Math.min(
    unmatchedOrdersPage,
    Math.max(1, Math.ceil(unmatchedOrders.length / exceptionsPageSize))
  );
  const paginatedUnmatchedOrders = unmatchedOrders.slice(
    (safeUnmatchedOrdersPage - 1) * exceptionsPageSize,
    safeUnmatchedOrdersPage * exceptionsPageSize
  );

  const safeUnmatchedBankPage = Math.min(
    unmatchedBankPage,
    Math.max(1, Math.ceil(unmatchedBank.length / exceptionsPageSize))
  );
  const paginatedUnmatchedBank = unmatchedBank.slice(
    (safeUnmatchedBankPage - 1) * exceptionsPageSize,
    safeUnmatchedBankPage * exceptionsPageSize
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FileDropzone
            title="Estado de Cuenta Bancario (PDF)"
            subtitle="Herramienta complementaria para cruzar movimientos bancarios en PDF contra las órdenes sincronizadas de Binance"
            badgeText="Módulo Secundario PDF"
            accept=".pdf"
            accentColor="emerald"
            endpoint="/api/upload/bank-pdf"
            onUploadSuccess={(data) => setBankBatch(data)}
          />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Cruce contra Banco</h3>
            <p className="text-xs text-slate-400">
              Compara las órdenes guardadas en tu historial de Binance P2P contra las líneas extraídas del PDF bancario:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong className="text-white">Nivel 1 (Exacto):</strong> Referencia o monto exacto el mismo día.</li>
              <li>• <strong className="text-white">Nivel 2 (Ventana):</strong> Monto coincidente dentro de ±2 días.</li>
              <li>• <strong className="text-white">Emparejamiento Manual:</strong> 1 clic para pagos fraccionados.</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="emerald"
            size="sm"
            icon={ArrowRightLeft}
            loading={loading}
            onClick={runAutoReconcile}
            className="mt-5 w-full h-8"
          >
            <span>{loading ? 'Ejecutando cruce...' : 'Ejecutar Conciliación'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {reconciliation && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            {/* Segmented Control con radios concéntricos (h-8 contenedor, h-6 chips) */}
            <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('MATCHED')}
                className={`flex h-6 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all ${
                  activeTab === 'MATCHED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Conciliadas ({reconciliation.matched_count})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('UNMATCHED')}
                className={`flex h-6 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all ${
                  activeTab === 'UNMATCHED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  Excepciones: Binance ({reconciliation.unmatched_orders_count}) / Banco ({reconciliation.unmatched_bank_count})
                </span>
              </button>
            </div>

            {selectedOrderId && selectedBankId && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Link2}
                onClick={handleManualMatch}
              >
                <span>Emparejar Manualmente</span>
              </Button>
            )}
          </div>

          {activeTab === 'MATCHED' ? (
            <div>
              <div className="w-full">
                <table className="w-full text-left text-xs table-fixed">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="w-24 py-2.5 pr-2">Nivel</th>
                      <th className="w-28 py-2.5 px-2">Orden Binance</th>
                      <th className="w-32 py-2.5 px-2">Fecha Orden</th>
                      <th className="w-28 py-2.5 px-2 text-right">Monto Orden</th>
                      <th className="w-28 py-2.5 px-2">Ref. Banco</th>
                      <th className="py-2.5 px-2">Concepto Banco</th>
                      <th className="w-28 py-2.5 pl-2 text-right">Monto Banco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs">
                    {paginatedMatched.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2 pr-2 font-sans">
                          <Badge variant="success" size="xs">
                            {m.match_level}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-slate-300 font-mono truncate">#{m.order_number.slice(-8)}</td>
                        <td className="py-2 px-2 text-slate-400 tabular-nums truncate">{fmtDateTime(m.order_date)}</td>
                        <td className="py-2 px-2 text-right text-amber-300 tabular-nums font-mono font-medium">{m.fiat_amount}</td>
                        <td className="py-2 px-2 text-emerald-300 font-mono truncate">{m.reference}</td>
                        <td className="py-2 px-2 font-sans text-slate-400 truncate" title={m.description}>{m.description}</td>
                        <td className="py-2 pl-2 text-right text-emerald-300 tabular-nums font-mono font-medium">{m.bank_amount}</td>
                      </tr>
                    ))}
                    {matchedPairs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center font-sans text-slate-500">
                          Aún no hay movimientos conciliados. Sube un estado de cuenta PDF para cruzar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <TablePaginator
                totalItems={matchedPairs.length}
                currentPage={safeMatchedPage}
                pageSize={matchedPageSize}
                onPageChange={setMatchedPage}
                onPageSizeChange={setMatchedPageSize}
                pageSizeOptions={[10, 20, 50]}
                itemLabel="cruces conciliados"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Columna Órdenes Binance sin Banco */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-400">
                  Órdenes Binance sin reflejo en Banco ({reconciliation.unmatched_orders_count})
                </h4>
                <div className="space-y-2">
                  {paginatedUnmatchedOrders.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id === selectedOrderId ? null : o.id)}
                      className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-colors ${
                        selectedOrderId === o.id
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-slate-200 font-semibold">
                          {o.order_type} · <span className="font-mono">#{o.order_number.slice(-8)}</span>
                        </span>
                        <span className="text-amber-300 font-bold tabular-nums">
                          {o.fiat_amount} {o.fiat_currency}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                        <span>{fmtDateTime(o.order_date)}</span>
                        <span>{o.counterparty}</span>
                      </div>
                    </div>
                  ))}
                  {unmatchedOrders.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      Todas las órdenes de Binance están conciliadas.
                    </p>
                  )}
                </div>

                <TablePaginator
                  totalItems={unmatchedOrders.length}
                  currentPage={safeUnmatchedOrdersPage}
                  pageSize={exceptionsPageSize}
                  onPageChange={setUnmatchedOrdersPage}
                  pageSizeOptions={[exceptionsPageSize]}
                  itemLabel="órdenes"
                  compact
                />
              </div>

              {/* Columna Movimientos Banco sin Orden */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Movimientos Bancarios sin Orden Binance ({reconciliation.unmatched_bank_count})
                </h4>
                <div className="space-y-2">
                  {paginatedUnmatchedBank.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBankId(b.id === selectedBankId ? null : b.id)}
                      className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-colors ${
                        selectedBankId === b.id
                          ? 'border-emerald-400 bg-emerald-500/15'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-300 font-mono">Ref: {b.reference}</span>
                        <span className="font-bold text-white tabular-nums">
                          {Number(b.debit || 0) > 0.001
                            ? `-${b.debit}`
                            : Number(b.credit || 0) > 0.001
                            ? `+${b.credit}`
                            : '0.00'}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                        <span>{fmtDate(b.tx_date)}</span>
                        <span className="truncate max-w-[180px]">{b.description}</span>
                      </div>
                    </div>
                  ))}
                  {unmatchedBank.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No hay movimientos bancarios pendientes por conciliar.
                    </p>
                  )}
                </div>

                <TablePaginator
                  totalItems={unmatchedBank.length}
                  currentPage={safeUnmatchedBankPage}
                  pageSize={exceptionsPageSize}
                  onPageChange={setUnmatchedBankPage}
                  pageSizeOptions={[exceptionsPageSize]}
                  itemLabel="movimientos"
                  compact
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
