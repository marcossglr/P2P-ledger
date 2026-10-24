import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Receipt,
  Search,
  RefreshCw,
  Sparkles,
  Trash2,
  History,
  X,
  Copy,
  Check,
  TrendingUp,
  ListFilter,
} from 'lucide-react';
import TablePaginator from './TablePaginator';
import OrderDetailsModal from './OrderDetailsModal';
import BankReconcileModal from './BankReconcileModal';
import OperationsTable from './OperationsTable';

export default function OperationsDashboard({
  onOpenApiModal,
  apiConfigured,
  refreshTrigger,
  onNavigateHistory,
  onNavigateSettings,
  onManualSync,
  isSyncingBg,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros rápidos exclusivos para la jornada de hoy
  const [orderType, setOrderType] = useState('ALL');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [fiatCurrency, setFiatCurrency] = useState('ALL');
  const [bankFeePct, setBankFeePct] = useState(0.3);

  // Buscador local directo en la tabla de Operaciones Ejecutadas y orden seleccionada
  const [tableSearch, setTableSearch] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Modal de cuadre rápido de posición consolidada en Bs
  const [reconcileModal, setReconcileModal] = useState({
    open: false,
    accountId: null,
    tab: 'SINGLE',
  });

  // Paginación de la tabla de hoy
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchTodayDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('only_today', 'true');
      if (orderType !== 'ALL') params.set('order_type', orderType);
      if (orderStatus !== 'ALL') params.set('order_status', orderStatus);
      if (fiatCurrency !== 'ALL') params.set('fiat_currency', fiatCurrency);
      params.set('bank_fee_pct', String(bankFeePct || 0));

      const res = await fetch(`/api/operations?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error cargando operaciones de hoy:', err);
    } finally {
      setLoading(false);
    }
  }, [orderType, orderStatus, fiatCurrency, bankFeePct]);

  useEffect(() => {
    fetchTodayDashboard();
  }, [fetchTodayDashboard, refreshTrigger]);

  // Reiniciar a la primera página cuando cambian los filtros o el buscador de tabla
  useEffect(() => {
    setCurrentPage(1);
  }, [orderType, orderStatus, fiatCurrency, tableSearch]);

  const handleSeedDemo = async () => {
    await fetch('/api/binance/demo-seed', { method: 'POST' });
    fetchTodayDashboard();
  };

  const handleClearDemo = async () => {
    await fetch('/api/operations/clear?only_demo=true', { method: 'DELETE' });
    fetchTodayDashboard();
  };

  // Sincronizar automáticamente la tasa de comisión configurada en los ajustes de bancos
  useEffect(() => {
    const acc =
      data?.bank_inventory?.accounts?.find((a) => a.is_default) ||
      data?.bank_inventory?.accounts?.[0];
    if (acc?.pago_movil_fee_pct != null && Number(acc.pago_movil_fee_pct) !== bankFeePct) {
      setBankFeePct(Number(acc.pago_movil_fee_pct));
    }
  }, [data, bankFeePct]);

  const handleCopyOrderNumber = (orderNumber) => {
    navigator.clipboard?.writeText(orderNumber);
    setCopiedOrderId(orderNumber);
    setTimeout(() => setCopiedOrderId(null), 1800);
  };

  const stats = data?.analytics || {};
  const orders = data?.orders || [];

  const filteredOrders = useMemo(() => {
    const q = tableSearch.trim().toLowerCase().replace(/^#/, '');
    if (!q) return orders;
    return orders.filter((o) => {
      const orderNum = String(o.order_number || '').toLowerCase();
      const counterparty = String(o.counterparty || '').toLowerCase();
      const payMethod = String(o.pay_method || '').toLowerCase();
      const fiatAmt = String(o.fiat_amount || '');
      const cryptoAmt = String(o.crypto_amount || '');
      const unitPrice = String(o.unit_price || '');
      return (
        orderNum.includes(q) ||
        counterparty.includes(q) ||
        payMethod.includes(q) ||
        fiatAmt.includes(q) ||
        cryptoAmt.includes(q) ||
        unitPrice.includes(q)
      );
    });
  }, [orders, tableSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalStoredOrders = data?.total_stored_orders || 0;
  const hasDemoOrders = Boolean(data?.has_demo_orders);
  const serverToday =
    data?.server_today || new Date().toLocaleDateString('sv-SE');
  const fiat = stats.primary_fiat || 'VES';

  const fmtFiat = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtUsdt = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtRate = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  const extractTimeOnly = (orderDateStr) => {
    if (!orderDateStr) return '-';
    const parts = orderDateStr.split(' ');
    return parts.length > 1 ? parts[1] : orderDateStr;
  };

  // --- Métricas derivadas con prioridad principal en USDT y secundaria en Fiat (Bs) ---
  const refRate =
    Number(stats.wac_buy_price) > 0
      ? Number(stats.wac_buy_price)
      : Number(stats.wap_sell_price) > 0
      ? Number(stats.wap_sell_price)
      : Number(data?.bank_inventory?.consolidated?.reference_rate || 1);

  // Ganancia bruta contable en USDT
  const grossProfitUsdt =
    refRate > 0 ? (stats.gross_profit_fiat || 0) / refRate : 0;

  // Comisiones bancarias convertidas a USDT
  const bankFeesUsdt =
    refRate > 0 ? (stats.estimated_bank_fees_fiat || 0) / refRate : 0;

  // Total de comisiones unificadas en USDT y en Fiat
  const totalCommissionsAllUsdt =
    (stats.total_commission_usdt || 0) + bankFeesUsdt;
  const totalCommissionsAllFiat =
    (stats.commission_fiat_cost || 0) + (stats.estimated_bank_fees_fiat || 0);

  // Margen neto % sobre el volumen USDT realmente arbitrado
  const matchedUsdt = Number(stats.matched_usdt_volume || 0);
  const netMarginPct =
    matchedUsdt > 0 ? ((stats.net_profit_usdt || 0) / matchedUsdt) * 100 : 0;

  // Tasa de venta Breakeven (punto de equilibrio con comisiones)
  const breakevenSellRate =
    Number(stats.wac_buy_price || 0) > 0 && matchedUsdt > 0
      ? Number(stats.wac_buy_price) + totalCommissionsAllFiat / matchedUsdt
      : Number(stats.wac_buy_price || 0);

  // Ticket promedio por operación en USDT
  const completedCount = Number(
    stats.completed_orders ?? stats.total_orders ?? orders.length ?? 0
  );
  const avgTicketUsdt =
    completedCount > 0
      ? Number(stats.total_usdt_volume || 0) / completedCount
      : 0;

  // Saldo bancario consolidado
  const totalBankBs = Number(
    data?.bank_inventory?.consolidated?.total_calculated_balance_bs || 0
  );
  const totalBankUsdt = Number(
    data?.bank_inventory?.consolidated?.equivalent_usdt ||
      (refRate > 0 ? totalBankBs / refRate : 0)
  );

  // Fondos en Binance (Cuenta Fondos P2P)
  const fundingWallet = data?.funding_wallet || {
    free: 0,
    locked: 0,
    total: 0,
    source: 'NONE',
  };
  const binanceFundingTotal = Number(fundingWallet.total || 0);
  const binanceFundingFree = Number(fundingWallet.free || 0);
  const binanceFundingLocked = Number(fundingWallet.locked || 0);

  // Posición Consolidada Global (Binance Fondos USDT + Bancos en Bs convertidos a USDT)
  const totalCapitalConsolidatedUsdt = binanceFundingTotal + totalBankUsdt;
  const totalCapitalConsolidatedBs = totalCapitalConsolidatedUsdt * refRate;

  // Copiar resumen del día estructurado para Telegram / WhatsApp
  const handleCopyDailySummary = () => {
    const netProfitSign = Number(stats.net_profit_usdt || 0) > 0.005 ? '+' : '';
    const marginText =
      matchedUsdt > 0
        ? ` [${netMarginPct > 0.005 ? '+' : ''}${netMarginPct.toFixed(2)}% margen]`
        : '';
    const spreadSign = Number(stats.spread_pct || 0) > 0.005 ? '+' : '';

    const lines = [
      `📊 Resumen de Jornada P2P (${serverToday})`,
      `• Ganancia Neta: ${netProfitSign}${fmtUsdt(stats.net_profit_usdt)} USDT (${fmtFiat(stats.net_profit_fiat)} ${fiat})${marginText}`,
      `• Volumen Operado: ${fmtUsdt(stats.total_usdt_volume)} USDT (${completedCount} órdenes)`,
      `  ↳ Compras: ${fmtUsdt(stats.buy_usdt_total)} USDT · Ventas: ${fmtUsdt(stats.sell_usdt_total)} USDT`,
      `• WAC Compra: ${fmtRate(stats.wac_buy_price)} | WAP Venta: ${fmtRate(stats.wap_sell_price)} | Spread: ${spreadSign}${Number(stats.spread_pct || 0).toFixed(2)}%`,
      breakevenSellRate > 0 ? `• Tasa Piso Breakeven: ${fmtRate(breakevenSellRate)} ${fiat}` : null,
      `• Posición Consolidada: ${fmtUsdt(totalCapitalConsolidatedUsdt)} USDT (incluye ${fmtFiat(totalBankBs)} ${fiat})`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard?.writeText(lines);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-6">

      {/* Onboarding Banner cuando la BD está completamente vacía */}
      {!loading && totalStoredOrders === 0 && !apiConfigured && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              Conecta tu API de Binance P2P o explora con datos de demostración
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              El sistema extrae automáticamente tus órdenes de Compra y Venta en tiempo real, calculando tu spread,
              tasas promedio ponderadas (WAC/WAP) y ganancia neta del día.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleSeedDemo}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Cargar Operaciones Demo</span>
            </button>
            <button
              onClick={onOpenApiModal}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/15 hover:bg-amber-400 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Conectar API de Binance</span>
            </button>
          </div>
        </div>
      )}

      {/* Aviso de Datos Demo */}
      {hasDemoOrders && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>
              Estás visualizando <strong>operaciones de demostración</strong> (incluyendo órdenes simuladas para hoy).
            </span>
          </div>
          <button
            onClick={handleClearDemo}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-slate-900"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Borrar datos demo</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          ZONA 1: RENDIMIENTO GENERAL DE LA JORNADA (Métricas globales invariables)
         ========================================================================= */}
      <section className="space-y-3">
        {/* Cabecera de la Zona de Rendimiento */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Rendimiento de la Jornada
              </h2>
              <span className="text-[11px] text-slate-500">
                Consolidado global de hoy ({serverToday})
              </span>
            </div>
          </div>

          {/* Acciones globales de la jornada: Moneda Fiat y Copiar Resumen */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDailySummary}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors shadow-xs ${
                copiedSummary
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800/80 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
              title="Copiar resumen estructurado de la jornada de hoy para compartir"
            >
              {copiedSummary ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-400" />
                  <span>Copiar Resumen</span>
                </>
              )}
            </button>

            <select
              value={fiatCurrency}
              onChange={(e) => setFiatCurrency(e.target.value)}
              className="h-8 rounded-xl border border-slate-800/80 bg-slate-900/80 px-3 text-xs font-medium text-slate-200 hover:border-slate-700 focus:border-amber-500 focus:outline-none transition-colors shadow-xs cursor-pointer"
            >
              <option value="ALL">Fiat: Todas</option>
              {(data?.available_fiats || ['VES']).map((f) => (
                <option key={f} value={f}>
                  Fiat: {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid de KPIs Exclusivos de Hoy */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Rendimiento & Ganancia Neta de Hoy (P&L Sintetizada) */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
            <div>
              {/* Cabecera uniforme */}
              <div className="min-h-[38px] flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ganancia Neta Hoy
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Resultado limpio de la jornada
                </span>
              </div>

              {/* Métrica principal y dato secundario */}
              <div className="mt-2.5">
                <span
                  className={`text-2xl font-bold tracking-tight tabular-nums block cursor-help ${
                    Number(stats.net_profit_usdt || 0) < -0.005 ? 'text-rose-400' : 'text-white'
                  }`}
                  title={`Bruta: ${grossProfitUsdt > 0.005 ? '+' : ''}${fmtUsdt(grossProfitUsdt)} USDT · Comisiones: -${fmtUsdt(totalCommissionsAllUsdt)} USDT`}
                >
                  {Number(stats.net_profit_usdt || 0) > 0.005 ? '+' : ''}
                  {fmtUsdt(stats.net_profit_usdt)} USDT
                </span>
                <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
                  <span className="tabular-nums">{fmtFiat(stats.net_profit_fiat)} {fiat}</span>
                  {matchedUsdt > 0 && (
                    <>
                      <span className="text-slate-600 select-none">·</span>
                      <span className="text-emerald-400 font-medium tabular-nums">
                        {netMarginPct > 0.005 ? '+' : ''}{netMarginPct.toFixed(2)}% margen
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Spread Promedio & Tasas (Sintetizada) */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
            <div>
              {/* Cabecera uniforme */}
              <div className="min-h-[38px] flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Spread Promedio
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5 truncate" title={stats.completion_rate_pct != null ? `${stats.completion_rate_pct}% efectividad en órdenes` : 'Margen ponderado de compra/venta'}>
                  {stats.completion_rate_pct != null
                    ? `${stats.completion_rate_pct}% efectividad en órdenes`
                    : 'Margen ponderado de compra/venta'}
                </span>
              </div>

              {/* Métrica principal y dato secundario integrado */}
              <div className="mt-2.5">
                <span
                  className="text-2xl font-bold tracking-tight text-white tabular-nums block cursor-help"
                  title={stats.spread_abs ? `Spread absoluto: ${Number(stats.spread_abs) > 0.0001 ? '+' : ''}${fmtRate(stats.spread_abs)} ${fiat}` : undefined}
                >
                  {Number(stats.spread_pct || 0) > 0.005 ? '+' : ''}
                  {Number(stats.spread_pct || 0).toFixed(2)}%
                </span>
                <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
                    title={`Precio promedio de compra (WAC): ${fmtRate(stats.wac_buy_price)} ${fiat}`}
                  >
                    <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="tabular-nums">{fmtRate(stats.wac_buy_price)}</span>
                  </span>
                  <span className="text-slate-600 select-none">·</span>
                  <span
                    className="inline-flex items-center gap-1 text-amber-400 cursor-help"
                    title={`Precio promedio de venta (WAP): ${fmtRate(stats.wap_sell_price)} ${fiat}`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="tabular-nums">{fmtRate(stats.wap_sell_price)}</span>
                  </span>
                  {breakevenSellRate > 0 && (
                    <>
                      <span className="text-slate-600 select-none">·</span>
                      <span
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-help"
                        title={`Tasa Piso de Equilibrio (Breakeven): ${fmtRate(breakevenSellRate)} ${fiat} (Precio mínimo de venta para cubrir costos de compra y comisiones)`}
                      >
                        <Scale className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="tabular-nums">{fmtRate(breakevenSellRate)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Volumen Total Operado (Sintetizada) */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
            <div>
              {/* Cabecera uniforme */}
              <div className="min-h-[38px] flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Volumen Operado
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                  {completedCount} órdenes completadas hoy
                </span>
              </div>

              {/* Métrica principal y dato secundario integrado */}
              <div className="mt-2.5">
                <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                  {fmtUsdt(stats.total_usdt_volume)} USDT
                </span>
                <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
                    title={`Total Compras: ${fmtUsdt(stats.buy_usdt_total)} USDT (${fmtFiat(stats.buy_fiat_total)} ${fiat})`}
                  >
                    <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="tabular-nums">{fmtUsdt(stats.buy_usdt_total)}</span>
                  </span>
                  <span className="text-slate-600 select-none">·</span>
                  <span
                    className="inline-flex items-center gap-1 text-amber-400 cursor-help"
                    title={`Total Ventas: ${fmtUsdt(stats.sell_usdt_total)} USDT (${fmtFiat(stats.sell_fiat_total)} ${fiat})`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="tabular-nums">{fmtUsdt(stats.sell_usdt_total)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Posición Consolidada Total (Sintetizada) */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
            <div>
              {/* Cabecera uniforme con botón de acción */}
              <div className="min-h-[38px] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
                    Posición Consolidada
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5 truncate" title="Capital activo total (Binance + Bancos)">
                    Capital activo total (Binance + Bancos)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReconcileModal({
                      open: true,
                      accountId: data?.bank_inventory?.accounts?.[0]?.id || null,
                      tab: 'SINGLE',
                    })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer shrink-0 shadow-xs"
                  title="Cuadrar cuentas bancarias"
                >
                  <Scale className="h-3.5 w-3.5 text-amber-400" />
                </button>
              </div>

              {/* Métrica principal y dato secundario */}
              <div className="mt-2.5">
                <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                  {fmtUsdt(totalCapitalConsolidatedUsdt)} USDT
                </span>
                <div className="mt-1.5 min-h-[20px] flex items-center text-xs text-slate-400">
                  <span>Incluye: <strong className="font-semibold text-slate-300 tabular-nums">{fmtFiat(totalBankBs)} {fiat}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separador Visual entre Zonas */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800/80"></div>
        </div>
      </div>

      {/* =========================================================================
          ZONA 2: ÓRDENES DEL DÍA (Tabla con filtros directos de exploración)
         ========================================================================= */}
      <section className="space-y-3">
        {/* Encabezado externo de la Zona de Órdenes */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <ListFilter className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Operaciones Ejecutadas Hoy
              </h2>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                {tableSearch.trim()
                  ? `Mostrando ${filteredOrders.length} de ${orders.length} operaciones que coinciden con "${tableSearch.trim()}"`
                  : `Mostrando ${orders.length} operaciones del día de hoy en orden cronológico inverso`}
              </span>
            </div>
          </div>
        </div>

        {/* Tabla en Tiempo Real de las Operaciones de Hoy */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl">
          {/* Barra de Filtros y Búsqueda sobre la tabla con todo el ancho disponible */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
            {/* Filtros de la tabla (Tipo y Estado) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro: Tipo de Orden */}
              <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs shadow-xs">
                {[
                  { id: 'ALL', label: 'Todas' },
                  { id: 'COMPRA', label: 'Compras' },
                  { id: 'VENTA', label: 'Ventas' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setOrderType(tab.id)}
                    className={`flex h-6 items-center rounded-lg px-2.5 font-medium transition-colors ${
                      orderType === tab.id
                        ? tab.id === 'COMPRA'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                          : tab.id === 'VENTA'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                          : 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filtro: Estado de Orden */}
              <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs shadow-xs">
                {[
                  {
                    id: 'ALL',
                    label: `Todos (${stats.all_orders_count ?? orders.length})`,
                  },
                  {
                    id: 'COMPLETED',
                    label: `Completadas (${stats.completed_orders ?? stats.total_orders ?? 0})`,
                  },
                  {
                    id: 'IN_PROGRESS',
                    label: `En Proceso (${stats.in_progress_orders ?? 0})`,
                  },
                  {
                    id: 'CANCELLED',
                    label: `Canceladas (${stats.cancelled_orders ?? 0})`,
                  },
                ].map((stTab) => (
                  <button
                    key={stTab.id}
                    onClick={() => setOrderStatus(stTab.id)}
                    className={`flex h-6 items-center rounded-lg px-2.5 font-medium transition-colors ${
                      orderStatus === stTab.id
                        ? stTab.id === 'CANCELLED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                          : stTab.id === 'IN_PROGRESS'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                          : stTab.id === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                          : 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {stTab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Buscador de Orden Específica */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Buscar por ID, contraparte, monto..."
                className="h-8 w-full rounded-xl border border-slate-700/80 bg-slate-950/90 pl-9 pr-8 text-xs text-slate-100 placeholder:text-slate-500 hover:border-slate-600 focus:border-amber-500 focus:outline-none transition-colors shadow-xs"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  title="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <OperationsTable
            orders={paginatedOrders}
            selectedOrder={selectedOrder}
            onSelectOrder={setSelectedOrder}
            showFullDate={false}
            loading={loading}
            tableSearch={tableSearch}
            onClearSearch={() => setTableSearch('')}
            emptyMessage={
              <div className="mx-auto max-w-md space-y-2">
                <p className="text-sm font-medium text-slate-300">
                  No hay operaciones registradas en el día de hoy ({serverToday})
                  {orderType !== 'ALL' ? ' con estos filtros.' : ' todavía.'}
                </p>
                <p className="text-xs text-slate-500">
                  El panel se actualizará automáticamente en cuanto se completen nuevas órdenes en Binance P2P.
                </p>
                {totalStoredOrders > 0 && onNavigateHistory && (
                  <div className="pt-2">
                    <button
                      onClick={onNavigateHistory}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                    >
                      <History className="h-3.5 w-3.5" />
                      <span>Consultar las {totalStoredOrders} operaciones en el Histórico</span>
                    </button>
                  </div>
                )}
              </div>
            }
          />

          <TablePaginator
            totalItems={filteredOrders.length}
            currentPage={safePage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
            itemLabel="operaciones de hoy"
          />
        </div>
      </section>

      {/* Vista Flotante de Detalles de la Orden Seleccionada */}
      <OrderDetailsModal
        order={selectedOrder}
        ordersList={filteredOrders}
        onClose={() => setSelectedOrder(null)}
        onSelectOrder={(ord) => setSelectedOrder(ord)}
        onFilterCounterparty={(cp) => setTableSearch(cp)}
        bankFeePct={bankFeePct}
        wacBuyPrice={stats.wac_buy_price}
        wapSellPrice={stats.wap_sell_price}
      />

      {/* Modal de Cuadre Rápido de Posición Consolidada en Bs */}
      <BankReconcileModal
        isOpen={reconcileModal.open}
        onClose={() => setReconcileModal((prev) => ({ ...prev, open: false }))}
        accounts={data?.bank_inventory?.accounts || []}
        initialAccountId={reconcileModal.accountId}
        initialTab={reconcileModal.tab}
        onSuccess={(updatedInv) => {
          setData((prev) => (prev ? { ...prev, bank_inventory: updatedInv } : prev));
        }}
      />
    </div>
  );
}
