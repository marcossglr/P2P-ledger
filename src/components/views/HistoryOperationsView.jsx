import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import OrderDetailsModal from '../modals/OrderDetailsModal';
import OperationsTable from '../common/OperationsTable';
import {
  OperationsFilterBar,
  HistoryKpiCards,
  DailyPerformanceTable,
  TopCounterpartiesCard,
} from '../history';
import { useHistoryOperations } from '../../hooks/useHistoryOperations';

export default function HistoryOperationsView({
  refreshTrigger,
  onNavigateFormulas,
  selectedAsset = 'USDT',
  onSelectAsset,
  availableAssets = ['USDT'],
  fiatCurrency = 'VES',
  onPairsDetected,
}) {
  const {
    data,
    loading,
    orderType,
    setOrderType,
    orderStatus,
    setOrderStatus,
    activePreset,
    setActivePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    bankFeePct,
    applyDatePreset,
    handleExportExcel,
  } = useHistoryOperations({
    selectedAsset,
    fiatCurrency,
    refreshTrigger,
    onPairsDetected,
  });

  // Buscador local directo en el Libro Histórico de Operaciones y orden seleccionada
  const [tableSearch, setTableSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Paginación y ordenamiento para la tabla de Rendimiento Diario y el Libro Histórico
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(7);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Control para colapsar/expandir el desglose multi-día
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(true);

  // Reiniciar páginas al cambiar filtros, búsqueda de tabla o criterio de orden
  useEffect(() => {
    setDailyPage(1);
    setOrdersPage(1);
  }, [orderType, orderStatus, fiatCurrency, startDate, endDate, tableSearch, sortConfig]);

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

  // Ordenamiento global de todas las operaciones históricas filtradas antes de paginar
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

  const totalOrdersPages = Math.max(1, Math.ceil(sortedFilteredOrders.length / ordersPageSize));
  const safeOrdersPage = Math.min(ordersPage, totalOrdersPages);
  const paginatedOrders = sortedFilteredOrders.slice(
    (safeOrdersPage - 1) * ordersPageSize,
    safeOrdersPage * ordersPageSize
  );

  const fiat = stats.primary_fiat || 'VES';

  const fmtFiat = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Precisión dinámica según activo (BTC/ETH requieren mayor granularidad)
  const isHighPrecisionAsset = ['BTC', 'ETH'].includes(selectedAsset);
  const cryptoDecimals = isHighPrecisionAsset ? 6 : 2;

  const fmtUsdt = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: cryptoDecimals,
    });

  const fmtRate = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });

  const handleSelectDay = (dateStr) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setActivePreset('CUSTOM');
  };

  return (
    <div className="space-y-4">
      {/* Barra Flotante Compacta de Filtros Históricos (Cripto, Período, Rango, Moneda Fiat y Exportar) */}
      <OperationsFilterBar
        selectedAsset={selectedAsset}
        onSelectAsset={onSelectAsset}
        availableAssets={data?.available_assets || availableAssets}
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
              <DailyPerformanceTable
                dailySeries={stats.daily_series}
                fiat={fiat}
                startDate={startDate}
                endDate={endDate}
                onSelectDate={handleSelectDay}
                onResetDates={() => applyDatePreset('ALL')}
                dailyPage={dailyPage}
                dailyPageSize={dailyPageSize}
                onPageChange={setDailyPage}
                onPageSizeChange={setDailyPageSize}
                fmtUsdt={fmtUsdt}
                fmtFiat={fmtFiat}
                fmtRate={fmtRate}
              />

              {/* Principales Contrapartes */}
              <TopCounterpartiesCard
                counterparties={stats.top_counterparties}
                fiat={fiat}
                fmtUsdt={fmtUsdt}
                fmtFiat={fmtFiat}
              />
            </div>
          )}
        </div>
      )}

      {/* Libro Histórico de Operaciones P2P */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl">
        <OperationsTable
          orders={paginatedOrders}
          selectedOrder={selectedOrder}
          onSelectOrder={setSelectedOrder}
          showFullDate={true}
          loading={loading}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          orderStatus={orderStatus}
          onOrderStatusChange={setOrderStatus}
          stats={stats}
          ordersCount={orders.length}
          tableSearch={tableSearch}
          onTableSearchChange={setTableSearch}
          onClearSearch={() => setTableSearch('')}
          onFilterCounterparty={(cp) => setTableSearch(cp)}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          pagination={{
            totalItems: sortedFilteredOrders.length,
            currentPage: safeOrdersPage,
            pageSize: ordersPageSize,
            onPageChange: setOrdersPage,
            onPageSizeChange: setOrdersPageSize,
            pageSizeOptions: [10, 15, 25, 50, 100],
            itemLabel: 'operaciones históricas',
          }}
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
