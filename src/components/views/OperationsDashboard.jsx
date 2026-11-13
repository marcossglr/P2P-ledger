import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Sparkles,
  Trash2,
  History,
  ListFilter,
} from 'lucide-react';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import BankReconcileModal from '../modals/BankReconcileModal';
import OperationsTable from '../common/OperationsTable';
import P2PMarketChartCard from '../market/P2PMarketChartCard';
import OperationsKpiCards from '../dashboard/OperationsKpiCards';
import MyAdsSection from '../dashboard/MyAdsSection';
import { useP2PMarketBoard } from '../../hooks/useP2PMarketBoard';
import { useOperationsDashboard } from '../../hooks/useOperationsDashboard';
import {
  computeOperationsMetrics,
  buildDailySummaryText,
  fmtFiat,
  fmtUsdt,
  fmtRate,
} from '../../utils/operationsMetrics';
import { Button } from '../ui';

// Constantes referenciales vacías para evitar re-renders por props inestables ([])
const EMPTY_ARRAY = [];

export default function OperationsDashboard({
  onOpenApiModal,
  apiConfigured,
  refreshTrigger,
  onNavigateHistory,
  onNavigateSettings,
  onManualSync,
  isSyncingBg,
  selectedAsset = 'USDT',
  fiatCurrency = 'VES',
  onPairsDetected,
}) {
  // Filtros rápidos exclusivos para la jornada de hoy
  const [orderType, setOrderType] = useState('ALL');
  const [orderStatus, setOrderStatus] = useState('ALL');

  // Hook central de datos del dashboard de hoy
  const {
    data,
    loading,
    bankFeePct,
    handleSeedDemo,
    handleClearDemo,
    updateBankInventory,
  } = useOperationsDashboard({
    selectedAsset,
    fiatCurrency,
    refreshTrigger,
    onPairsDetected,
  });

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

  // Paginación y ordenamiento global de la tabla de hoy
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Reiniciar a la primera página cuando cambian los filtros, buscador o criterio de orden
  useEffect(() => {
    setCurrentPage(1);
  }, [orderType, orderStatus, selectedAsset, fiatCurrency, tableSearch, sortConfig]);

  // Callbacks memorizados para estabilidad de renderizado
  const handleClearSearch = useCallback(() => setTableSearch(''), []);
  const handleCloseOrderDetails = useCallback(() => setSelectedOrder(null), []);
  const handleCloseReconcileModal = useCallback(
    () => setReconcileModal((prev) => ({ ...prev, open: false })),
    []
  );
  const handleOpenReconcileModal = useCallback(() => {
    setReconcileModal({
      open: true,
      accountId: data?.bank_inventory?.accounts?.[0]?.id || null,
      tab: 'SINGLE',
    });
  }, [data?.bank_inventory?.accounts]);
  const handleNavigateConnections = useCallback(() => {
    if (onNavigateSettings) onNavigateSettings('CONNECTIONS');
  }, [onNavigateSettings]);

  const stats = data?.analytics || {};
  const orders = data?.orders || [];

  const filteredOrders = useMemo(() => {
    let result = orders;

    // 1. Filtrar por tipo de orden (Compras / Ventas)
    if (orderType !== 'ALL') {
      result = result.filter((o) => o.order_type === orderType);
    }

    // 2. Filtrar por estado de la orden
    if (orderStatus !== 'ALL') {
      result = result.filter((o) => {
        const st = (o.order_status || 'COMPLETED').toUpperCase();
        return st === orderStatus;
      });
    }

    // 3. Filtrar por texto de búsqueda
    const q = tableSearch.trim().toLowerCase().replace(/^#/, '');
    if (!q) return result;

    return result.filter((o) => {
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
  }, [orders, orderType, orderStatus, tableSearch]);

  // Ordenamiento global de todas las operaciones filtradas antes de paginar
  const sortedFilteredOrders = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredOrders;

    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;

    return [...filteredOrders].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (key === 'order_date') {
        return ((new Date(valA).getTime() || 0) - (new Date(valB).getTime() || 0)) * factor;
      }
      if (['crypto_amount', 'commission_usdt', 'unit_price', 'fiat_amount'].includes(key)) {
        return (Number(valA || 0) - Number(valB || 0)) * factor;
      }
      return String(valA || '').localeCompare(String(valB || '')) * factor;
    });
  }, [filteredOrders, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedFilteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = sortedFilteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalStoredOrders = data?.total_stored_orders || 0;
  const hasDemoOrders = Boolean(data?.has_demo_orders);
  const serverToday =
    data?.server_today || new Date().toLocaleDateString('sv-SE');
  const fiat = stats.primary_fiat || 'VES';
  const cryptoAsset = stats.target_asset || selectedAsset || 'USDT';

  // --- Métricas derivadas financieras consolidadas ---
  const metrics = useMemo(
    () =>
      computeOperationsMetrics({
        stats,
        bankInventory: data?.bank_inventory,
        fundingWallet: data?.funding_wallet,
        ordersCount: orders.length,
      }),
    [stats, data?.bank_inventory, data?.funding_wallet, orders.length]
  );

  // Hook del Mercado P2P en vivo y evaluación de competencia en pizarra
  const marketBoard = useP2PMarketBoard({
    selectedAsset: cryptoAsset,
    fiatCurrency: fiat,
    refreshTrigger,
  });

  // Copiar resumen del día estructurado para Telegram / WhatsApp
  const handleCopyDailySummary = () => {
    const lines = buildDailySummaryText({
      stats,
      metrics,
      serverToday,
      fiat,
    });

    navigator.clipboard?.writeText(lines)?.catch(() => {});
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="space-y-6">

      {/* =========================================================================
          ZONA 1: RENDIMIENTO GENERAL DE LA JORNADA (Grid 4x2: Mercado P2P + KPIs)
         ========================================================================= */}
      <section className="space-y-3">
        {/* Grid 4x2: Tarjeta Gráfica de Mercado (2 cols x 2 filas a la izquierda) + 4 Tarjetas KPI (2 cols x 2 filas a la derecha) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Izquierda (2x2): Gráfica del Mercado P2P (Evolución + Libro en Vivo) */}
          <P2PMarketChartCard
            marketBoard={marketBoard}
            onOpenSettings={handleNavigateConnections}
            asset={cryptoAsset}
            fiat={fiat}
            myAds={data?.my_ads || EMPTY_ARRAY}
          />

          {/* Tarjetas KPI de la Jornada (Ganancia, Spread, Volumen y Posición Consolidada) */}
          <OperationsKpiCards
            stats={stats}
            cryptoAsset={cryptoAsset}
            fiat={fiat}
            grossProfitUsdt={metrics.grossProfitUsdt}
            totalCommissionsAllUsdt={metrics.totalCommissionsAllUsdt}
            matchedUsdt={metrics.matchedUsdt}
            netMarginPct={metrics.netMarginPct}
            completedCount={metrics.completedCount}
            totalCapitalConsolidatedUsdt={metrics.totalCapitalConsolidatedUsdt}
            totalBankBs={metrics.totalBankBs}
            onOpenReconcileModal={handleOpenReconcileModal}
            fmtUsdt={fmtUsdt}
            fmtFiat={fmtFiat}
            fmtRate={fmtRate}
          />
        </div>
      </section>

      {/* =========================================================================
          ZONA INTERMEDIA: ANUNCIOS ACTIVOS EN BINANCE P2P
         ========================================================================= */}
      {apiConfigured && (
        <MyAdsSection
          ads={data?.my_ads || EMPTY_ARRAY}
          evaluateMyAdOnBoard={marketBoard.evaluateMyAdOnBoard}
          fmtUsdt={fmtUsdt}
          fmtFiat={fmtFiat}
          fmtRate={fmtRate}
        />
      )}

      {/* Separador Visual Sutil entre Zonas */}
      <div className="border-t border-slate-800/40 my-1" />

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
          <OperationsTable
            orders={paginatedOrders}
            selectedOrder={selectedOrder}
            onSelectOrder={setSelectedOrder}
            showFullDate={false}
            loading={loading}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            orderStatus={orderStatus}
            onOrderStatusChange={setOrderStatus}
            stats={stats}
            ordersCount={orders.length}
            tableSearch={tableSearch}
            onTableSearchChange={setTableSearch}
            onClearSearch={handleClearSearch}
            onFilterCounterparty={setTableSearch}
            sortConfig={sortConfig}
            onSortChange={setSortConfig}
            pagination={{
              totalItems: sortedFilteredOrders.length,
              currentPage: safePage,
              pageSize: pageSize,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
              pageSizeOptions: [10, 20, 50],
              itemLabel: 'operaciones de hoy',
            }}
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
        </div>
      </section>

      {/* Vista Flotante de Detalles de la Orden Seleccionada (Solo si hay orden activa) */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          ordersList={filteredOrders}
          onClose={handleCloseOrderDetails}
          onSelectOrder={setSelectedOrder}
          onFilterCounterparty={setTableSearch}
          bankFeePct={bankFeePct}
          wacBuyPrice={stats.wac_buy_price}
          wapSellPrice={stats.wap_sell_price}
        />
      )}

      {/* Modal de Cuadre Rápido de Posición Consolidada en Bs (Solo si está abierto) */}
      {reconcileModal.open && (
        <BankReconcileModal
          isOpen={reconcileModal.open}
          onClose={handleCloseReconcileModal}
          accounts={data?.bank_inventory?.accounts || EMPTY_ARRAY}
          initialAccountId={reconcileModal.accountId}
          initialTab={reconcileModal.tab}
          onSuccess={updateBankInventory}
        />
      )}
    </div>
  );
}
