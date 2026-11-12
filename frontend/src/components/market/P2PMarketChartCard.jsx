import React, { useState, memo } from 'react';
import { RefreshCw, SlidersHorizontal, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import { Card, Button, Badge } from '../ui';
import { useP2PChartGeometry } from '../../hooks/useP2PChartGeometry';
import MarketFiltersPopover from './MarketFiltersPopover';
import MarketDepthChart from './MarketDepthChart';
import MarketOrderBookView from './MarketOrderBookView';
import { fmtRate } from '../../utils/formatters';

function P2PMarketChartCard({
  marketBoard = {},
  onOpenSettings,
  asset = 'USDT',
  fiat = 'VES',
  myAds = [],
}) {
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('CHART');

  // Extraer estado y funciones de la única fuente de verdad (marketBoard)
  const {
    marketData,
    marketLoading = false,
    marketError = null,
    isLive = true,
    fetchMarketStats,
    selectedAsset = asset || 'USDT',
    updateAsset,
    selectedBank = 'ALL',
    amountFilter = '',
    onlyMerchants = false,
    priceMode = 'BEST',
    resetFilters,
    hasActiveFilters = false,
    filtersSummary = 'Todo el mercado',
    filterSideAds = { buy: [], sell: [] },
    filteredStats = {},
  } = marketBoard;

  const currentAsset = selectedAsset || asset || 'USDT';

  // Geometría y serie temporal del gráfico
  const { historySeries, chartGeometry } = useP2PChartGeometry({
    marketData,
    filteredStats,
    filterKey: `${selectedBank}_${amountFilter}_${onlyMerchants}_${priceMode}_${fiat}_${currentAsset}`,
  });

  const hasSpread = filteredStats?.spreadPct != null && filteredStats?.spreadAbs != null;
  const spreadPct = Number(filteredStats?.spreadPct || 0);
  const spreadAbs = Number(filteredStats?.spreadAbs || 0);

  // Variante semántica según el margen P2P:
  // - Positivo saludable (> +0.05%): 'success' (verde esmeralda)
  // - Estrecho o neutral (entre -0.05% y +0.05%): 'warning' (ámbar suave)
  // - Negativo o invertido (< -0.05%): 'danger' (rosa/rojo)
  const spreadVariant = !hasSpread
    ? 'default'
    : spreadPct > 0.05
    ? 'success'
    : spreadPct < -0.05
    ? 'danger'
    : 'warning';
  const hasAds = Boolean(filterSideAds?.buy?.length || filterSideAds?.sell?.length);

  return (
    <Card className="relative flex flex-col justify-between p-4 sm:col-span-2 lg:col-span-2 lg:row-span-2">
      {/* Backdrop transparente para cerrar el popover al hacer clic fuera */}
      {showFiltersPanel && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowFiltersPanel(false)}
        />
      )}

      {/* 1. Cabecera Desktop-First */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block truncate">
            Mercado P2P ({currentAsset}/{fiat})
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            <span
              className={`truncate ${hasActiveFilters ? 'text-amber-300/90 font-medium' : 'text-slate-400'}`}
              title={filtersSummary}
            >
              {filtersSummary}
            </span>
          </div>
        </div>

        {/* Acciones: Segmented Control [Gráfica | Pizarra] + Filtros + Refresh */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('CHART')}
              className={`h-6 rounded-lg px-2.5 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center ${
                activeTab === 'CHART'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Gráfica
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ORDER_BOOK')}
              className={`h-6 rounded-lg px-2.5 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center ${
                activeTab === 'ORDER_BOOK'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Pizarra
            </button>
          </div>

          <Button
            type="button"
            variant={showFiltersPanel || hasActiveFilters ? 'primary' : 'secondary'}
            size="sm"
            icon={SlidersHorizontal}
            onClick={() => setShowFiltersPanel((prev) => !prev)}
            title="Configurar filtros del mercado"
          >
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            icon={RefreshCw}
            loading={marketLoading}
            onClick={() => fetchMarketStats && fetchMarketStats({ force: true })}
            title="Actualizar cotizaciones ahora"
          />
        </div>
      </div>

      {/* 2. Popover Flotante de Filtros */}
      {showFiltersPanel && (
        <MarketFiltersPopover
          onClose={() => setShowFiltersPanel(false)}
          fiat={fiat}
          asset={currentAsset}
          marketBoard={marketBoard}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* 3. Cuerpo Central: Gráfica, Pizarra o Estados Vacíos/Error */}
      <div className="my-2 flex-1 flex flex-col justify-center min-h-[146px] relative z-10">
        {marketError && !marketData ? (
          <div className="flex flex-col items-center justify-center text-center p-3 rounded-xl border border-slate-800 bg-slate-950/40 gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <p className="text-[11px] text-slate-300 font-medium line-clamp-2">{marketError}</p>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => fetchMarketStats && fetchMarketStats({ force: true })}
              className="mt-1"
            >
              Reintentar
            </Button>
          </div>
        ) : !marketData && marketLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            <span>Consultando mercado P2P...</span>
          </div>
        ) : !hasAds ? (
          <div className="flex flex-col items-center justify-center text-center p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 gap-1.5">
            <p className="text-xs text-slate-300 font-medium">No hay anuncios que coincidan con este filtro</p>
            <Button type="button" variant="primary" size="xs" onClick={resetFilters}>
              Ver todo el mercado
            </Button>
          </div>
        ) : activeTab === 'CHART' && chartGeometry ? (
          <MarketDepthChart
            chartGeometry={chartGeometry}
            historySeries={historySeries}
            fiat={fiat}
            fmtRate={fmtRate}
            isLive={isLive}
          />
        ) : activeTab === 'ORDER_BOOK' ? (
          <MarketOrderBookView filterSideAds={filterSideAds} myAds={myAds} asset={currentAsset} />
        ) : null}
      </div>

      {/* 4. Pie de Tarjeta: Cotizaciones y Spread Comercial */}
      <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between gap-2 text-xs tabular-nums flex-wrap relative z-10">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-emerald-400 font-medium font-mono cursor-help"
            title="Mejor precio en la pestaña 'Comprar' de Binance P2P"
          >
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-slate-400 font-sans text-[11px]">Compra:</span>
            <span className="font-semibold text-slate-100">{fmtRate(filteredStats?.buy?.activePrice)}</span>
          </span>

          <span className="text-slate-700 select-none">·</span>

          <span
            className="inline-flex items-center gap-1 text-rose-400 font-medium font-mono cursor-help"
            title="Mejor precio en la pestaña 'Vender' de Binance P2P"
          >
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-slate-400 font-sans text-[11px]">Venta:</span>
            <span className="font-semibold text-slate-100">{fmtRate(filteredStats?.sell?.activePrice)}</span>
          </span>
        </div>

        <Badge
          variant={spreadVariant}
          size="sm"
          dot={hasSpread}
          className="font-mono text-[11px]"
          title={
            hasSpread
              ? `Spread Comercial P2P (Margen Operativo):\n${spreadPct > 0 ? '+' : ''}${spreadPct.toFixed(2)}% (${spreadAbs > 0 ? '+' : ''}${fmtRate(spreadAbs)} ${fiat})\n\nCalculado desde la perspectiva del comerciante (Maker):\n• Venta de USDT (pestaña Comprar): ${fmtRate(filteredStats.buy?.activePrice)} ${fiat}\n• Compra de USDT (pestaña Vender): ${fmtRate(filteredStats.sell?.activePrice)} ${fiat}`
              : 'Sin datos suficientes para calcular el spread'
          }
        >
          {hasSpread ? (
            <>
              <span className="font-semibold">
                {spreadPct > 0 ? '+' : ''}
                {spreadPct.toFixed(2)}%
              </span>
              <span className="opacity-70 font-normal">
                ({spreadAbs > 0 ? '+' : ''}{fmtRate(spreadAbs)} {fiat})
              </span>
            </>
          ) : (
            <span className="opacity-60">—</span>
          )}
        </Badge>
      </div>
    </Card>
  );
}

export default memo(P2PMarketChartCard);
