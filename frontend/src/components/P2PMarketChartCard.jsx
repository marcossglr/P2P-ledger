import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import {
  RefreshCw,
  SlidersHorizontal,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { binanceApi } from '../services/api';
import { useMarketFilters } from '../hooks/useMarketFilters';
import { useP2PMarketStats } from '../hooks/useP2PMarketStats';
import { useP2PChartGeometry } from '../hooks/useP2PChartGeometry';
import MarketDepthChart from './market/MarketDepthChart';
import MarketOrderBookView from './market/MarketOrderBookView';
import MarketFiltersPopover from './market/MarketFiltersPopover';
import { fmtRate, parseSmartAmount } from '../utils/formatters';
import { Button, Badge } from './ui';

function P2PMarketChartCard({
  marketData,
  marketLoading,
  marketError,
  onRefresh,
  onOpenSettings,
  asset = 'USDT',
  fiat = 'VES',
  breakevenRate = null,
  myAds = [],
}) {
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const filterPopoverRef = useRef(null);
  const filterButtonRef = useRef(null);
  const [binancePayMethods, setBinancePayMethods] = useState([]);
  const [loadingPayMethods, setLoadingPayMethods] = useState(false);
  const [payMethodSearch, setPayMethodSearch] = useState('');
  const [showAllPayMethods, setShowAllPayMethods] = useState(false);

  // Pestaña activa dentro de la tarjeta: 'CHART' (Gráfica) o 'ORDER_BOOK' (Pizarra)
  const [activeTab, setActiveTab] = useState('CHART');

  // Hook desacoplado para gestión y persistencia de filtros de mercado
  const {
    selectedBank,
    updateBank,
    amountFilter,
    updateAmount,
    onlyMerchants,
    updateMerchants,
    priceMode,
    updatePriceMode,
    hasActiveFilters,
  } = useMarketFilters(onRefresh);

  // Cargar los métodos de pago oficiales de Binance correspondientes a la divisa fiat seleccionada
  useEffect(() => {
    let isMounted = true;
    setLoadingPayMethods(true);
    binanceApi
      .getPaymentMethods(fiat || 'VES')
      .then((data) => {
        if (!isMounted) return;
        if (data?.methods && Array.isArray(data.methods)) {
          setBinancePayMethods(data.methods);
        } else {
          setBinancePayMethods([]);
        }
      })
      .catch((err) => {
        console.error('Error al cargar métodos de Binance P2P:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPayMethods(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fiat]);

  // Cerrar el popover de filtros al hacer clic fuera (ignorando el botón disparador)
  useEffect(() => {
    if (!showFiltersPanel) return;
    const handleClickOutside = (e) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target)
      ) {
        setShowFiltersPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFiltersPanel]);

  // Cálculo desacoplado de estadísticas y anuncios filtrados
  const { availableBanks, filterSideAds, filteredStats } = useP2PMarketStats({
    marketData,
    selectedBank,
    amountFilter,
    onlyMerchants,
    priceMode,
    binancePayMethods,
  });

  // Cálculo desacoplado de serie temporal y geometría de gráfica SVG
  const { historySeries, chartGeometry } = useP2PChartGeometry({
    marketData,
    filteredStats,
    breakevenRate,
  });

  // Lista de métodos ordenados por volumen/competitividad en el mercado actual
  const sortedPayMethods = useMemo(() => {
    if (!binancePayMethods.length) return [];
    const countsMap = new Map();
    availableBanks.forEach((b) => countsMap.set(b.name.toLowerCase(), b.count));

    return [...binancePayMethods].sort((a, b) => {
      const countA =
        (countsMap.get(a.identifier?.toLowerCase()) || 0) +
        (countsMap.get(a.name?.toLowerCase()) || 0);
      const countB =
        (countsMap.get(b.identifier?.toLowerCase()) || 0) +
        (countsMap.get(b.name?.toLowerCase()) || 0);
      return countB - countA;
    });
  }, [binancePayMethods, availableBanks]);

  // Métodos de pago de Binance filtrados por búsqueda rápida y visibilidad compacta
  const displayedPayMethods = useMemo(() => {
    let list = sortedPayMethods;
    if (payMethodSearch.trim()) {
      const q = payMethodSearch.toLowerCase().trim();
      return list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.identifier?.toLowerCase().includes(q) ||
          m.short_name?.toLowerCase().includes(q)
      );
    }

    if (!showAllPayMethods && list.length > 6) {
      const top = list.slice(0, 6);
      const isSelectedInTop = top.some(
        (m) =>
          m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
          m.name?.toLowerCase() === selectedBank.toLowerCase()
      );
      if (!isSelectedInTop && selectedBank !== 'ALL') {
        const activeItem = list.find(
          (m) =>
            m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
            m.name?.toLowerCase() === selectedBank.toLowerCase()
        );
        if (activeItem) {
          return [...top.slice(0, 5), activeItem];
        }
      }
      return top;
    }
    return list;
  }, [sortedPayMethods, payMethodSearch, showAllPayMethods, selectedBank]);

  const resetFilters = () => {
    updateBank('ALL');
    updateAmount('');
    updateMerchants(false);
    updatePriceMode('BEST');
  };

  // Evaluar frescura de la data para determinar si está realmente "En vivo" o desactualizada
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!marketData?.fetched_at) {
      setIsStale(false);
      return;
    }

    const checkFreshness = () => {
      try {
        const fetchedMs = new Date(marketData.fetched_at).getTime();
        if (!isNaN(fetchedMs)) {
          const ageMs = Date.now() - fetchedMs;
          // Si han pasado más de 45 segundos sin refresco (considerando intervalo de 15-20s), se considera desactualizado
          setIsStale(ageMs > 45000);
        }
      } catch {
        setIsStale(false);
      }
    };

    checkFreshness();
    const interval = setInterval(checkFreshness, 5000);
    return () => clearInterval(interval);
  }, [marketData?.fetched_at]);

  // Síntesis concisa y elegante de los filtros activos (banco, monto, verificados, modo de precio)
  const filtersSummary = useMemo(() => {
    if (!hasActiveFilters) {
      const modeLabel =
        priceMode === 'TOP5'
          ? 'Top 5'
          : priceMode === 'TOP10'
          ? 'Top 10'
          : priceMode === 'WEIGHTED'
          ? 'Pond.'
          : null;
      return modeLabel ? `Todo el mercado (${modeLabel})` : 'Todo el mercado';
    }

    const parts = [];

    // 1. Método / Banco
    if (selectedBank && selectedBank !== 'ALL') {
      // Buscar si tiene nombre legible en binancePayMethods
      const matched = binancePayMethods.find(
        (m) =>
          m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
          m.name?.toLowerCase() === selectedBank.toLowerCase()
      );
      parts.push(matched?.name || selectedBank);
    }

    // 2. Monto simulado
    if (amountFilter) {
      const parsed = parseSmartAmount(amountFilter);
      if (parsed) {
        const fmtAmt =
          parsed >= 1000000
            ? `${(parsed / 1000000).toFixed(parsed % 1000000 === 0 ? 0 : 1)}M`
            : parsed >= 1000
            ? `${(parsed / 1000).toFixed(parsed % 1000 === 0 ? 0 : 1)}k`
            : String(parsed);
        parts.push(`≥ ${fmtAmt} ${fiat}`);
      }
    }

    // 3. Verificados
    if (onlyMerchants) {
      parts.push('Verificados');
    }

    // 4. Modo de precio si no es el estándar
    if (priceMode && priceMode !== 'BEST') {
      const modeNames = {
        TOP5: 'Top 5',
        TOP10: 'Top 10',
        WEIGHTED: 'Pond.',
      };
      if (modeNames[priceMode]) {
        parts.push(modeNames[priceMode]);
      }
    }

    return parts.join(' · ');
  }, [hasActiveFilters, selectedBank, amountFilter, onlyMerchants, priceMode, binancePayMethods, fiat]);

  return (
    <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md sm:col-span-2 lg:col-span-2 lg:row-span-2">
      {/* 1. Cabecera Homogénea alineada a los KPI cards del Dashboard */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block truncate">
            Mercado P2P ({asset}/{fiat})
          </span>

          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            {/* Indicador de estado de la conexión / frescura */}
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  marketLoading
                    ? 'bg-amber-400 animate-pulse'
                    : marketError || isStale
                    ? 'bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span
                className={`font-medium ${
                  marketError || isStale
                    ? 'text-rose-400/90'
                    : marketLoading
                    ? 'text-amber-400/90'
                    : 'text-emerald-400/90'
                }`}
              >
                {marketLoading
                  ? 'Actualizando...'
                  : marketError
                  ? 'Sin conexión'
                  : isStale
                  ? 'Desactualizado'
                  : 'En vivo'}
              </span>
            </span>

            <span className="text-slate-700 select-none">·</span>

            {/* Síntesis de filtros */}
            <span
              className={`truncate ${
                hasActiveFilters ? 'text-amber-300/90 font-medium' : 'text-slate-400'
              }`}
              title={filtersSummary}
            >
              {filtersSummary}
            </span>
          </div>
        </div>

        {/* Acciones Superiores Derechas: Selector Segmented [Gráfica | Pizarra] + Filtros + Refresh */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Segmented Control Gráfica / Pizarra */}
          <div className="inline-flex items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('CHART')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === 'CHART'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gráfica
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ORDER_BOOK')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === 'ORDER_BOOK'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pizarra
            </button>
          </div>

          {/* Botón Filtros estándar */}
          <div ref={filterButtonRef}>
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
          </div>

          {/* Botón Actualizar estándar */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            icon={RefreshCw}
            loading={marketLoading}
            onClick={() => onRefresh && onRefresh(true)}
            title="Actualizar cotizaciones ahora"
          />
        </div>
      </div>

      {/* 2. Popover Flotante de Filtros */}
      {showFiltersPanel && (
        <MarketFiltersPopover
          popoverRef={filterPopoverRef}
          onClose={() => setShowFiltersPanel(false)}
          fiat={fiat}
          loadingPayMethods={loadingPayMethods}
          binancePayMethods={binancePayMethods}
          payMethodSearch={payMethodSearch}
          setPayMethodSearch={setPayMethodSearch}
          displayedPayMethods={displayedPayMethods}
          sortedPayMethods={sortedPayMethods}
          showAllPayMethods={showAllPayMethods}
          setShowAllPayMethods={setShowAllPayMethods}
          selectedBank={selectedBank}
          updateBank={updateBank}
          amountFilter={amountFilter}
          updateAmount={updateAmount}
          priceMode={priceMode}
          updatePriceMode={updatePriceMode}
          onlyMerchants={onlyMerchants}
          updateMerchants={updateMerchants}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* 3. Cuerpo Central: Gráfica de Evolución o Pizarra de Órdenes */}
      <div className="my-2 flex-1 flex flex-col justify-center min-h-[146px]">
        {marketError && !marketData ? (
          <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg border border-slate-800 bg-slate-950/40 gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <p className="text-[11px] text-slate-300 font-medium line-clamp-2">{marketError}</p>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onRefresh && onRefresh(true)}
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
        ) : (!filterSideAds.buy?.length && !filterSideAds.sell?.length) ? (
          <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg border border-slate-800/80 bg-slate-950/40 gap-1.5">
            <p className="text-xs text-slate-300 font-medium">
              No hay anuncios que coincidan con este filtro
            </p>
            <Button
              type="button"
              variant="primary"
              size="xs"
              onClick={resetFilters}
            >
              Ver todo el mercado
            </Button>
          </div>
        ) : activeTab === 'CHART' && chartGeometry ? (
          <MarketDepthChart
            chartGeometry={chartGeometry}
            historySeries={historySeries}
            fiat={fiat}
            fmtRate={fmtRate}
          />
        ) : null}

        {/* Vista Alternativa: Pizarra / Libro en Vivo de Compras y Ventas */}
        {!marketError && !marketLoading && activeTab === 'ORDER_BOOK' && (
          <MarketOrderBookView
            filterSideAds={filterSideAds}
            myAds={myAds}
            asset={asset}
          />
        )}
      </div>

      {/* 4. Pie de Tarjeta Estándar: Cotizaciones de Compra / Venta y Spread Comercial */}
      <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between gap-2 text-xs tabular-nums flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1 text-emerald-400 font-medium font-mono cursor-help"
            title="Mejor precio en la pestaña 'Comprar' de Binance P2P"
          >
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-slate-400 font-sans text-[11px]">Compra:</span>
            <span className="font-semibold text-slate-100">{fmtRate(filteredStats.buy.activePrice)}</span>
          </span>

          <span className="text-slate-700 select-none">·</span>

          <span
            className="inline-flex items-center gap-1 text-rose-400 font-medium font-mono cursor-help"
            title="Mejor precio en la pestaña 'Vender' de Binance P2P"
          >
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-slate-400 font-sans text-[11px]">Venta:</span>
            <span className="font-semibold text-slate-100">{fmtRate(filteredStats.sell.activePrice)}</span>
          </span>
        </div>

        {/* Badge de Spread estructurado: Absoluto + Porcentaje */}
        <Badge
          variant={
            Number(filteredStats.spreadPct || 0) > 0.005
              ? 'success'
              : Number(filteredStats.spreadPct || 0) < -0.005
              ? 'danger'
              : 'default'
          }
          size="sm"
          className="font-mono text-[11px]"
        >
          {filteredStats.spreadAbs != null && (
            <span className="opacity-75">
              Δ {fmtRate(filteredStats.spreadAbs)} ·
            </span>
          )}
          <span>
            {filteredStats.spreadPct != null
              ? `${filteredStats.spreadPct > 0 ? '+' : ''}${Number(filteredStats.spreadPct).toFixed(2)}% spread`
              : '—'}
          </span>
        </Badge>
      </div>
    </div>
  );
}

export default memo(P2PMarketChartCard);
