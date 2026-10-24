import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import FileDropzone from './FileDropzone';
import TablePaginator from './TablePaginator';

export default function BankReconcilerView() {
  const [bankBatch, setBankBatch] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading] = useState(false);
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
    try {
      const res = await fetch('/api/reconcile?tolerance_days=2', { method: 'POST' });
      const data = await res.json();
      setReconciliation(data);
      setMatchedPage(1);
      setUnmatchedOrdersPage(1);
      setUnmatchedBankPage(1);
    } catch (err) {
      console.error('Error al conciliar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedOrderId || !selectedBankId) return;
    await fetch('/api/reconcile/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: selectedOrderId, bank_id: selectedBankId }),
    });
    setSelectedOrderId(null);
    setSelectedBankId(null);
    runAutoReconcile();
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

        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white">Cruce contra Banco</h3>
            <p className="text-xs text-slate-400">
              Compara las órdenes guardadas en tu historial de Binance P2P contra las líneas extraídas del PDF bancario:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>Nivel 1 (Exacto):</strong> Referencia o monto exacto el mismo día.</li>
              <li>• <strong>Nivel 2 (Ventana):</strong> Monto coincidente dentro de ±2 días.</li>
              <li>• <strong>Emparejamiento Manual:</strong> 1 clic para pagos fraccionados.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={runAutoReconcile}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>{loading ? 'Ejecutando cruce...' : 'Ejecutar Conciliación con Banco'}</span>
          </button>
        </div>
      </div>

      {reconciliation && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('MATCHED')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ${
                  activeTab === 'MATCHED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-950 text-slate-400'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Conciliadas ({reconciliation.matched_count})</span>
              </button>
              <button
                onClick={() => setActiveTab('UNMATCHED')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ${
                  activeTab === 'UNMATCHED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-950 text-slate-400'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Excepciones: Binance ({reconciliation.unmatched_orders_count}) / Banco ({reconciliation.unmatched_bank_count})
                </span>
              </button>
            </div>

            {selectedOrderId && selectedBankId && (
              <button
                onClick={handleManualMatch}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <Link2 className="h-4 w-4" />
                <span>Emparejar Manualmente Seleccionados</span>
              </button>
            )}
          </div>

          {activeTab === 'MATCHED' ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Nivel</th>
                      <th className="py-2 px-2">Orden Binance</th>
                      <th className="py-2 px-2">Fecha Orden</th>
                      <th className="py-2 px-2 text-right">Monto Orden</th>
                      <th className="py-2 px-2">Ref. Banco</th>
                      <th className="py-2 px-2">Concepto Banco</th>
                      <th className="py-2 pl-2 text-right">Monto Banco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs">
                    {paginatedMatched.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-sans">
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            {m.match_level}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-300 font-mono">#{m.order_number.slice(-8)}</td>
                        <td className="py-2 px-2 text-slate-400 tabular-nums">{m.order_date}</td>
                        <td className="py-2 px-2 text-right text-amber-300 tabular-nums">{m.fiat_amount}</td>
                        <td className="py-2 px-2 text-emerald-300 font-mono">{m.reference}</td>
                        <td className="py-2 px-2 font-sans text-slate-400 truncate max-w-[200px]">{m.description}</td>
                        <td className="py-2 pl-2 text-right text-emerald-300 tabular-nums">{m.bank_amount}</td>
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
                        <span>{o.order_date}</span>
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
                        <span>{b.tx_date}</span>
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
