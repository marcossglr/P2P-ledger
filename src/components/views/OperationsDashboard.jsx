import React, { useState, useMemo, useCallback } from 'react';
import BankReconcileModal from '../modals/BankReconcileModal';
import P2PMarketChartCard from '../market/P2PMarketChartCard';
import OperationsKpiCards from '../dashboard/OperationsKpiCards';
import MyAdsSection from '../dashboard/MyAdsSection';
import { useP2PMarketBoard } from '../../hooks/useP2PMarketBoard';
import { useOperationsDashboard } from '../../hooks/useOperationsDashboard';
import {
  computeOperationsMetrics,
  fmtFiat,
  fmtUsdt,
  fmtRate,
} from '../../utils/operationsMetrics';

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
  activeWorkspaceId = 'default',
  onPairsDetected,
}) {
  // Hook central de datos del dashboard de hoy
  const {
    data,
    updateBankInventory,
  } = useOperationsDashboard({
    selectedAsset,
    fiatCurrency,
    refreshTrigger,
    onPairsDetected,
  });

  // Modal de cuadre rápido de posición consolidada en Bs
  const [reconcileModal, setReconcileModal] = useState({
    open: false,
    accountId: null,
    tab: 'SINGLE',
  });

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
    workspaceId: activeWorkspaceId,
    refreshTrigger,
  });

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
            netProfitUsdt={metrics.netProfitUsdt}
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
          ZONA 2: ANUNCIOS ACTIVOS EN BINANCE P2P
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
