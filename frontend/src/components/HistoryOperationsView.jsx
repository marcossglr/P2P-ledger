import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Scale,
  Percent,
  Receipt,
  Search,
  Building2,
  Users,
  History,
  RotateCcw,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import TablePaginator from './TablePaginator';
import OrderDetailsModal from './OrderDetailsModal';
import OperationsTable from './OperationsTable';
import OrdersToolbar from './OrdersToolbar';
import OperationsFilterBar from './history/OperationsFilterBar';
import HistoryKpiCards from './history/HistoryKpiCards';
import { fmtDate } from '../utils/formatters';
import { operationsApi } from '../services/api';
import { Button, Input, Badge } from './ui';

export default function HistoryOperationsView({
  refreshTrigger,
  onNavigateFormulas,
  selectedAsset = 'USDT',
  fiatCurrency = 'VES',
  onPairsDetected,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros de consulta histórica
  const [orderType, setOrderType] = useState('ALL');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [activePreset, setActivePreset] = useState('TODAY');
  // Usar la fecha local del navegador (no UTC de toISOString) para evitar desfase de día
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  });
  const [bankFeePct, setBankFeePct] = useState(0.3);

  // Buscador local directo en el Libro Histórico de Operaciones y orden seleccionada
  const [tableSearch, setTableSearch] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Paginación para la tabla de Rendimiento Diario y el Libro Histórico
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(7);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(15);

  // Control para colapsar/expandir el desglose multi-día
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(true);

  const fetchHistory = useCallback(async (isInitial = false) => {
    if (isInitial || !data) {
      setLoading(true);
    }
    try {
      const filters = {
        only_today: false,
        bank_fee_pct: bankFeePct || 0,
      };
      if (orderType !== 'ALL') filters.order_type = orderType;
      if (orderStatus !== 'ALL') filters.order_status = orderStatus;
      if (selectedAsset !== 'ALL') filters.asset = selectedAsset;
      if (fiatCurrency) filters.fiat_currency = fiatCurrency;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const json = await operationsApi.getOperations(filters);
      setData(json);

      if (json?.available_assets && onPairsDetected) {
        onPairsDetected(json.available_assets, json.available_fiats || ['VES']);
      }
    } catch (err) {
      console.error('Error cargando histórico de operaciones:', err);
    } finally {
      setLoading(false);
    }
  }, [data, orderType, orderStatus, selectedAsset, fiatCurrency, startDate, endDate, bankFeePct, onPairsDetected]);

  useEffect(() => {
    fetchHistory();
  }, [orderType, orderStatus, selectedAsset, fiatCurrency, startDate, endDate, bankFeePct, refreshTrigger]);

  // Sincronizar automáticamente la tasa de comisión bancaria configurada en los ajustes de bancos
  useEffect(() => {
    const acc =
      data?.bank_inventory?.accounts?.find((a) => a.is_default) ||
      data?.bank_inventory?.accounts?.[0];
    if (acc?.pago_movil_fee_pct != null && Number(acc.pago_movil_fee_pct) !== bankFeePct) {
      setBankFeePct(Number(acc.pago_movil_fee_pct));
    }
  }, [data, bankFeePct]);

  // Reiniciar páginas al cambiar filtros o búsqueda de tabla
  useEffect(() => {
    setDailyPage(1);
    setOrdersPage(1);
  }, [orderType, orderStatus, fiatCurrency, startDate, endDate, tableSearch]);

  const applyDatePreset = (preset) => {
    setActivePreset(preset);
    const baseStr = data?.server_today || new Date().toISOString().slice(0, 10);
    const [y, m, d] = baseStr.split('-').map(Number);
    const todayObj = new Date(y, m - 1, d);

    const fmtDate = (dt) => {
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const s = fmtDate(todayObj);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'CUSTOM') {
      // Si no hay fechas definidas, inicializar con hoy
      if (!startDate) setStartDate(fmtDate(todayObj));
      if (!endDate) setEndDate(fmtDate(todayObj));
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(todayObj);
      yest.setDate(yest.getDate() - 1);
      const s = fmtDate(yest);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 7);
      setStartDate(fmtDate(from));
      setEndDate(fmtDate(todayObj));
    } else if (preset === '30D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 30);
      setStartDate(fmtDate(from));
      setEndDate(fmtDate(todayObj));
    } else if (preset === '90D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 90);
      setStartDate(fmtDate(from));
      setEndDate(fmtDate(todayObj));
    } else if (preset === 'MONTH') {
      const firstDay = new Date(y, m - 1, 1);
      setStartDate(fmtDate(firstDay));
      setEndDate(fmtDate(todayObj));
    }
  };

  const handleExportExcel = () => {
    const filters = {
      only_today: false,
      bank_fee_pct: bankFeePct || 0,
    };
    if (orderType !== 'ALL') filters.order_type = orderType;
    if (orderStatus !== 'ALL') filters.order_status = orderStatus;
    if (fiatCurrency !== 'ALL') filters.fiat_currency = fiatCurrency;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    window.open(operationsApi.getExportUrl(filters), '_blank', 'noopener,noreferrer');
  };

  const handleCopyOrderNumber = (orderNumber) => {
    navigator.clipboard?.writeText(orderNumber)?.catch(() => {});
    setCopiedOrderId(orderNumber);
    setTimeout(() => setCopiedOrderId(null), 1800);
  };

  const stats = data?.analytics || {};
  const orders = data?.orders || [];
  const dailyDesc = stats.daily_series ? [...stats.daily_series].reverse() : [];

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

  const totalDailyPages = Math.max(1, Math.ceil(dailyDesc.length / dailyPageSize));
  const safeDailyPage = Math.min(dailyPage, totalDailyPages);
  const paginatedDaily = dailyDesc.slice(
    (safeDailyPage - 1) * dailyPageSize,
    safeDailyPage * dailyPageSize
  );

  const totalOrdersPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize));
  const safeOrdersPage = Math.min(ordersPage, totalOrdersPages);
  const paginatedOrders = filteredOrders.slice(
    (safeOrdersPage - 1) * ordersPageSize,
    safeOrdersPage * ordersPageSize
  );

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
      maximumFractionDigits: 3,
    });

  // Métricas financieras calculadas para Spread y Punto de Equilibrio (Breakeven)
  const matchedUsdt = Number(stats.matched_usdt_volume || 0);
  const totalCommissionsAllFiat =
    (stats.commission_fiat_cost || 0) + (stats.estimated_bank_fees_fiat || 0);
  const breakevenSellRate =
    Number(stats.wac_buy_price || 0) > 0 && matchedUsdt > 0
      ? Number(stats.wac_buy_price) + totalCommissionsAllFiat / matchedUsdt
      : 0;

  // Margen neto % real sobre el volumen efectivamente arbitrado
  const netProfitUsdt = Number(stats.net_profit_usdt || 0);
  const netMarginPct =
    matchedUsdt > 0 ? (netProfitUsdt / matchedUsdt) * 100 : 0;

  // Balance y desbalance de inventario de la jornada/período
  const buyUsdtTotal = Number(stats.buy_usdt_total || 0);
  const sellUsdtTotal = Number(stats.sell_usdt_total || 0);
  const netInventoryUsdt = buyUsdtTotal - sellUsdtTotal;

  // Flujo neto de caja en Fiat (Entradas por ventas - Salidas por compras)
  const buyFiatTotal = Number(stats.buy_fiat_total || 0);
  const sellFiatTotal = Number(stats.sell_fiat_total || 0);
  const netCashFlowFiat = sellFiatTotal - buyFiatTotal;

  // Métricas operativas de órdenes
  const completedOrdersCount = Number(stats.completed_orders ?? stats.total_orders ?? orders.length);
  const buyOrdersCount = Number(stats.buy_count || 0);
  const sellOrdersCount = Number(stats.sell_count || 0);
  const cancelledOrdersCount = Number(stats.cancelled_orders || 0);
  const completionRatePct = stats.completion_rate_pct != null ? Number(stats.completion_rate_pct) : null;
  const avgTicketUsdt = completedOrdersCount > 0 ? Number(stats.total_usdt_volume || 0) / completedOrdersCount : 0;

  return (
    <div className="space-y-4">
      {/* Barra Flotante Compacta de Filtros Históricos (Período, Rango, Moneda Fiat y Exportar) */}
      <OperationsFilterBar
        activePreset={activePreset}
        applyDatePreset={applyDatePreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onNavigateFormulas={onNavigateFormulas}
        onExportExcel={handleExportExcel}
        ordersCount={orders.length}
      />

      {/* Tarjetas de Resumen Acumulado del Período (Componente Modular HistoryKpiCards) */}
      <HistoryKpiCards
        stats={stats}
        selectedAsset={selectedAsset}
        fiat={fiat}
        orders={orders}
        fmtUsdt={fmtUsdt}
        fmtFiat={fmtFiat}
        fmtRate={fmtRate}
      />

      {/* Desglose Diario de Arbitraje & Principales Contrapartes (Solo cuando abarca 2 o más días) */}
      {stats.daily_series && stats.daily_series.length > 1 && (
        <div className="space-y-2">
          {/* Barra de cabecera con botón colapsable para multi-día */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Desglose Comparativo Multi-Día ({stats.daily_series.length} jornadas)
            </span>
            <button
              onClick={() => setShowDailyBreakdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>{showDailyBreakdown ? 'Ocultar desglose' : 'Mostrar desglose'}</span>
              {showDailyBreakdown ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              )}
            </button>
          </div>

          {showDailyBreakdown && (
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              {/* Tabla de Rendimiento Diario */}
              <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Rendimiento Diario de Arbitraje</h3>
                    <p className="text-xs text-slate-400">
                      Haz clic en cualquier fecha para auditar y filtrar las órdenes de ese día puntual
                    </p>
                  </div>
                  {startDate && startDate === endDate && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => applyDatePreset('ALL')}
                    >
                      <span>Mostrar todas las fechas</span>
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 font-medium">Fecha</th>
                        <th className="py-2.5 px-2 font-medium text-right">Op.</th>
                        <th className="py-2.5 px-2 font-medium text-right">Compras USDT</th>
                        <th className="py-2.5 px-2 font-medium text-right">Ventas USDT</th>
                        <th className="py-2.5 px-2 font-medium text-right">Tasa Compra</th>
                        <th className="py-2.5 px-2 font-medium text-right">Tasa Venta</th>
                        <th className="py-2.5 px-2 font-medium text-right">Spread</th>
                        <th className="py-2.5 pr-3 pl-2 font-medium text-right">P&L Neto (USDT / {fiat})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {paginatedDaily.map((day) => {
                        const dayNetUsdt = day.net_profit_usdt != null ? day.net_profit_usdt : (day.avg_buy_price > 0 ? day.net_profit_fiat / day.avg_buy_price : 0);
                        const isPositive = Number(day.net_profit_fiat || 0) >= 0;
                        return (
                          <tr
                            key={day.date}
                            onClick={() => {
                              setStartDate(day.date);
                              setEndDate(day.date);
                              setActivePreset('CUSTOM');
                            }}
                            className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                            title={`Filtrar operaciones del ${day.date}`}
                          >
                            <td className="py-2.5 px-3 tabular-nums text-[11px] font-medium text-slate-300 hover:text-amber-300 hover:underline">
                              {fmtDate(day.date)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{day.orders_count}</td>
                            <td className="py-2.5 px-2 text-right font-medium text-white tabular-nums">{fmtUsdt(day.buy_usdt)}</td>
                            <td className="py-2.5 px-2 text-right font-medium text-white tabular-nums">{fmtUsdt(day.sell_usdt)}</td>
                            <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{fmtRate(day.avg_buy_price)}</td>
                            <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{fmtRate(day.avg_sell_price)}</td>
                            <td className="py-2.5 px-2 text-right font-semibold text-slate-300 tabular-nums">
                              {Number(day.spread_pct || 0) > 0.005 ? `+${Number(day.spread_pct || 0).toFixed(2)}%` : `${Number(day.spread_pct || 0).toFixed(2)}%`}
                            </td>
                            <td className="py-2.5 pr-3 pl-2 text-right">
                              <span
                                className={`tabular-nums font-bold block ${
                                  Number(day.net_profit_fiat || 0) < -0.005 ? 'text-rose-400' : 'text-white'
                                }`}
                              >
                                {Number(day.net_profit_fiat || 0) > 0.005 ? '+' : ''}
                                {fmtUsdt(dayNetUsdt)} USDT
                              </span>
                              <span className="tabular-nums text-[10px] text-slate-400">
                                ≈ {fmtFiat(day.net_profit_fiat)} {fiat}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <TablePaginator
                  totalItems={dailyDesc.length}
                  currentPage={safeDailyPage}
                  pageSize={dailyPageSize}
                  onPageChange={setDailyPage}
                  onPageSizeChange={setDailyPageSize}
                  pageSizeOptions={[5, 7, 15, 30]}
                  itemLabel="días"
                  compact
                />
              </div>

              {/* Principales Contrapartes */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Principales Contrapartes</h3>
                    <p className="text-xs text-slate-400">Usuarios con mayor volumen histórico</p>
                  </div>
                  <Users className="h-4 w-4 text-slate-400" />
                </div>
                <div className="space-y-2.5">
                  {(stats.top_counterparties || []).map((cp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-200">{cp.name}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">{cp.count} órdenes completadas</p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-semibold text-white">{fmtUsdt(cp.usdt_volume)} USDT</p>
                        <p className="text-[11px] text-slate-400">{fmtFiat(cp.fiat_volume)} {fiat}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Libro Histórico de Operaciones P2P */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl">
        {/* Barra de Filtros y Búsqueda sobre la tabla con todo el ancho disponible */}
        <OrdersToolbar
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          orderStatus={orderStatus}
          onOrderStatusChange={setOrderStatus}
          stats={stats}
          ordersCount={orders.length}
          tableSearch={tableSearch}
          onTableSearchChange={setTableSearch}
          onClearSearch={() => setTableSearch('')}
        />

        <OperationsTable
          orders={paginatedOrders}
          selectedOrder={selectedOrder}
          onSelectOrder={setSelectedOrder}
          showFullDate={true}
          loading={loading}
          tableSearch={tableSearch}
          onClearSearch={() => setTableSearch('')}
          emptyMessage={
            <div className="mx-auto max-w-md space-y-2 py-4">
              <p className="text-sm font-medium text-slate-300">
                No se encontraron operaciones registradas en el período seleccionado.
              </p>
              <p className="text-xs text-slate-500">
                Prueba ajustando el rango de fechas, los filtros de tipo/estado o seleccionando el botón &ldquo;Todo el historial&rdquo;.
              </p>
            </div>
          }
        />

        <TablePaginator
          totalItems={filteredOrders.length}
          currentPage={safeOrdersPage}
          pageSize={ordersPageSize}
          onPageChange={setOrdersPage}
          onPageSizeChange={setOrdersPageSize}
          pageSizeOptions={[10, 15, 25, 50, 100]}
          itemLabel="operaciones históricas"
        />
      </div>

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
    </div>
  );
}
