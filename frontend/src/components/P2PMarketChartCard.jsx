import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import {
  RefreshCw,
  SlidersHorizontal,
  AlertCircle,
  ShieldCheck,
  X,
  Settings,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { bankInventoryApi } from '../services/api';
import MarketDepthChart from './market/MarketDepthChart';
import { parseSmartAmount, fmtRate, fmtTime } from '../utils/formatters';
import { useMarketFilters } from '../hooks/useMarketFilters';
import { Button, Input, Badge } from './ui';

const AMOUNT_PRESETS = [
  { label: 'Todos', val: '' },
  { label: '1k', val: '1000' },
  { label: '5k', val: '5000' },
  { label: '10k', val: '10000' },
  { label: '25k', val: '25000' },
  { label: '50k', val: '50000' },
  { label: '100k', val: '100000' },
  { label: '250k', val: '250000' },
];

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
  const [bankCatalog, setBankCatalog] = useState([]);

  // Cargar el catálogo general oficial de bancos de Venezuela desde nuestra base de datos / backend
  useEffect(() => {
    bankInventoryApi
      .getCatalog()
      .then((data) => {
        if (data?.banks && Array.isArray(data.banks)) {
          setBankCatalog(data.banks);
        }
      })
      .catch(() => {});
  }, []);

  // Cerrar el popover de filtros al hacer clic fuera
  useEffect(() => {
    if (!showFiltersPanel) return;
    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setShowFiltersPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFiltersPanel]);

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

  // Pestaña activa dentro de la tarjeta: 'CHART' (Gráfica) o 'ORDER_BOOK' (Libro de ofertas)
  const [activeTab, setActiveTab] = useState('CHART');
  const [hoverIdx, setHoverIdx] = useState(null);


  // Todos los anuncios crudos traídos de todo el mercado
  const allBuyAds = useMemo(() => marketData?.buy?.ads || [], [marketData]);
  const allSellAds = useMemo(() => marketData?.sell?.ads || [], [marketData]);
  const totalMarketAdsCount = allBuyAds.length + allSellAds.length;

  // Conjunto de números de anuncios propios del usuario para detección ultrarrápida
  const myAdvNos = useMemo(() => {
    const s = new Set();
    (myAds || []).forEach((a) => {
      if (a?.adv_no) s.add(String(a.adv_no).trim());
    });
    return s;
  }, [myAds]);

  // Bancos disponibles de toda la data del mercado con sus conteos reales (sin límite artificial)
  const availableBanks = useMemo(() => {
    if (marketData?.available_pay_methods?.length > 0) {
      return marketData.available_pay_methods;
    }
    const counts = new Map();
    [...allBuyAds, ...allSellAds].forEach((ad) => {
      (ad.pay_methods || []).forEach((m) => {
        counts.set(m, (counts.get(m) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [marketData, allBuyAds, allSellAds]);

  // Filtrado en memoria sobre los anuncios recibidos
  const filterSideAds = useMemo(() => {
    const targetAmt = parseSmartAmount(amountFilter);
    const bankNorm = selectedBank !== 'ALL' ? selectedBank.toLowerCase() : null;

    // Buscar si el banco seleccionado coincide con algún banco del catálogo para extraer sus palabras clave
    const catalogEntry = bankNorm
      ? bankCatalog.find(
          (b) =>
            b.name.toLowerCase() === bankNorm ||
            (b.keywords && b.keywords.some((k) => k.toLowerCase() === bankNorm))
        )
      : null;

    const matchAd = (ad) => {
      if (onlyMerchants && !ad.is_merchant && ad.user_type !== 'merchant') {
        return false;
      }
      if (bankNorm) {
        const methods = [
          ...(ad.pay_methods || []),
          ...(ad.pay_identifiers || []),
        ].map((m) => String(m).toLowerCase());

        // Comprobación flexible:
        // 1. Coincidencia directa de subcadena
        // 2. Coincidencia por palabras clave del catálogo (ej. "bdv", "venezuela", "bbva", "provincial")
        const directMatch = methods.some(
          (m) => m.includes(bankNorm) || bankNorm.includes(m)
        );

        let keywordMatch = false;
        if (!directMatch && catalogEntry?.keywords?.length > 0) {
          keywordMatch = catalogEntry.keywords.some((kw) => {
            const kwNorm = kw.toLowerCase();
            return methods.some((m) => m.includes(kwNorm) || kwNorm.includes(m));
          });
        }

        // Si el backend ya filtró este banco específicamente en Binance y nos devolvió anuncios,
        // no debemos descartarlos por una discrepancia menor de formato de texto en frontend
        const serverFilteredBank = marketData?.filters?.pay_types?.length > 0;

        if (!directMatch && !keywordMatch && !serverFilteredBank) {
          return false;
        }
      }
      if (targetAmt != null) {
        const minF = Number(ad.min_fiat || 0);
        const maxF = Number(ad.max_fiat || 0);
        if (minF > targetAmt) return false;
        if (maxF > 0 && maxF < targetAmt) return false;
      }
      return true;
    };

    const buyFiltered = allBuyAds.filter(matchAd);
    const sellFiltered = allSellAds.filter(matchAd);

    // Si los filtros locales descartan todo pero el servidor ya nos devolvió anuncios
    // (por ejemplo porque se filtró directamente en la API de Binance), usamos los anuncios del servidor
    return {
      buy: buyFiltered.length > 0 || !selectedBank || selectedBank === 'ALL' ? buyFiltered : allBuyAds,
      sell: sellFiltered.length > 0 || !selectedBank || selectedBank === 'ALL' ? sellFiltered : allSellAds,
    };
  }, [allBuyAds, allSellAds, selectedBank, amountFilter, onlyMerchants, bankCatalog, marketData]);

  // Estadísticas actuales a partir de los anuncios filtrados
  const filteredStats = useMemo(() => {
    const calcSide = (ads, side) => {
      const prices = ads.map((a) => Number(a.price)).filter((p) => p > 0);
      if (prices.length === 0) {
        return {
          count: 0,
          best: null,
          top5: null,
          top10: null,
          weighted: null,
          activePrice: null,
        };
      }
      const ordered =
        side === 'BUY' ? [...prices].sort((a, b) => a - b) : [...prices].sort((a, b) => b - a);
      const top5Slice = ordered.slice(0, Math.min(5, ordered.length));
      const top10Slice = ordered.slice(0, Math.min(10, ordered.length));
      const top5Avg = top5Slice.reduce((s, v) => s + v, 0) / top5Slice.length;
      const top10Avg = top10Slice.reduce((s, v) => s + v, 0) / top10Slice.length;
      const totalQty = ads.reduce((s, a) => s + Number(a.available_qty || 0), 0);
      const weightedAvg =
        totalQty > 0
          ? ads.reduce((s, a) => s + Number(a.price) * Number(a.available_qty || 0), 0) / totalQty
          : top5Avg;

      const activePrice =
        priceMode === 'TOP5'
          ? top5Avg
          : priceMode === 'TOP10'
          ? top10Avg
          : priceMode === 'WEIGHTED'
          ? weightedAvg
          : ordered[0];

      return {
        count: prices.length,
        best: ordered[0],
        top5: top5Avg,
        top10: top10Avg,
        weighted: weightedAvg,
        activePrice,
      };
    };

    const buy = calcSide(filterSideAds.buy, 'BUY');
    const sell = calcSide(filterSideAds.sell, 'SELL');

    let spreadAbs = null;
    let spreadPct = null;
    if (buy.activePrice && sell.activePrice) {
      spreadAbs = Math.abs(buy.activePrice - sell.activePrice);
      const minP = Math.min(buy.activePrice, sell.activePrice);
      spreadPct = minP > 0 ? (spreadAbs / minP) * 100 : 0;
    }

    return { buy, sell, spreadAbs, spreadPct };
  }, [filterSideAds, priceMode]);

  const resetFilters = () => {
    updateBank('ALL');
    updateAmount('');
    updateMerchants(false);
    updatePriceMode('BEST');
  };

  // Serie temporal de evolución del mercado durante el día
  const historySeries = useMemo(() => {
    const curBuy = Number(filteredStats.buy.activePrice || 0);
    const curSell = Number(filteredStats.sell.activePrice || 0);
    if (curBuy <= 0 && curSell <= 0) return [];

    const rawHistory = marketData?.history || [];
    const pts = [];

    rawHistory.forEach((h) => {
      // Como el backend refresca cada 5s trayendo directamente los datos filtrados en memoria,
      // tomamos los valores exactos registrados en el histórico
      const bVal = h.buy_best ?? h.buy_top_avg;
      const sVal = h.sell_best ?? h.sell_top_avg;

      if (bVal != null && sVal != null) {
        pts.push({
          label: (h.time || '').slice(0, 5) || '—',
          fullTime: h.time || '—',
          buy_val: Number(bVal),
          sell_val: Number(sVal),
        });
      }
    });

    const nowTime = fmtTime(new Date());

    if (pts.length >= 2) {
      const sliced = pts.slice(-24);
      // Solo sobreescribir el último punto si el precio actual es válido
      if (curBuy > 0 || curSell > 0) {
        sliced[sliced.length - 1] = {
          ...sliced[sliced.length - 1],
          label: 'Ahora',
          fullTime: nowTime,
          buy_val: curBuy > 0 ? curBuy : sliced[sliced.length - 1].buy_val,
          sell_val: curSell > 0 ? curSell : sliced[sliced.length - 1].sell_val,
        };
      }
      return sliced;
    }

    if (pts.length === 1) {
      return [
        pts[0],
        {
          label: 'Ahora',
          fullTime: nowTime,
          buy_val: curBuy > 0 ? curBuy : pts[0].buy_val,
          sell_val: curSell > 0 ? curSell : pts[0].sell_val,
        },
      ];
    }

    const firstLabel = nowTime;
    return [
      {
        label: firstLabel,
        fullTime: nowTime,
        buy_val: curBuy,
        sell_val: curSell,
      },
      {
        label: 'Ahora',
        fullTime: nowTime,
        buy_val: curBuy,
        sell_val: curSell,
      },
    ];
  }, [marketData, selectedBank, priceMode, filteredStats]);

  // Geometría SVG para la gráfica de evolución temporal
  const chartGeometry = useMemo(() => {
    if (historySeries.length < 2) return null;
    const W = 540;
    const H = 142;
    const padLeft = 14;
    const padRight = 58; // Espacio a la derecha para las etiquetas de precios mín/máx
    const padY = 16;

    const allPrices = [];
    historySeries.forEach((p) => {
      if (p.buy_val > 0) allPrices.push(Number(p.buy_val));
      if (p.sell_val > 0) allPrices.push(Number(p.sell_val));
    });

    if (allPrices.length === 0) return null;
    const minVal = Math.min(...allPrices);
    const maxVal = Math.max(...allPrices);
    const range = Math.max(0.02, maxVal - minVal);

    const toX = (i) =>
      padLeft + (i / Math.max(1, historySeries.length - 1)) * (W - padLeft - padRight);
    const toY = (val) =>
      H - padY - ((Number(val) - minVal) / range) * (H - padY * 2);

    const buyPts = historySeries.map((p, i) => ({
      x: toX(i),
      y: toY(p.buy_val || minVal),
      val: Number(p.buy_val || 0),
      label: p.label,
      fullTime: p.fullTime,
    }));
    const sellPts = historySeries.map((p, i) => ({
      x: toX(i),
      y: toY(p.sell_val || minVal),
      val: Number(p.sell_val || 0),
      label: p.label,
      fullTime: p.fullTime,
    }));

    const buildPath = (pts) =>
      pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

    const buyPath = buildPath(buyPts);
    const sellPath = buildPath(sellPts);

    const bottomY = H - padY;
    const buyAreaPath = buyPts.length > 0 ? [
      ...buyPts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
      `L${buyPts[buyPts.length - 1].x.toFixed(1)},${bottomY}`,
      `L${buyPts[0].x.toFixed(1)},${bottomY}`,
      'Z',
    ].join(' ') : '';

    const sellAreaPath = sellPts.length > 0 ? [
      ...sellPts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
      `L${sellPts[sellPts.length - 1].x.toFixed(1)},${bottomY}`,
      `L${sellPts[0].x.toFixed(1)},${bottomY}`,
      'Z',
    ].join(' ') : '';

    const spreadAreaPath = [
      ...buyPts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
      ...[...sellPts]
        .reverse()
        .map((pt) => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
      'Z',
    ].join(' ');

    // Línea de Breakeven si está en rango
    const breakevenNum = breakevenRate != null ? Number(breakevenRate) : null;
    const breakevenY =
      breakevenNum && breakevenNum >= minVal - range * 0.2 && breakevenNum <= maxVal + range * 0.2
        ? toY(breakevenNum)
        : null;

    return {
      W,
      H,
      minVal,
      maxVal,
      padRight,
      buyPts,
      sellPts,
      buyPath,
      sellPath,
      buyAreaPath,
      sellAreaPath,
      spreadAreaPath,
      breakevenY,
      breakevenNum,
    };
  }, [historySeries, breakevenRate]);

  const hoveredPoint =
    hoverIdx != null && historySeries[hoverIdx] ? historySeries[hoverIdx] : null;

  const updatedTimeStr = useMemo(() => {
    if (!marketData?.fetched_at) return null;
    return fmtTime(marketData.fetched_at);
  }, [marketData?.fetched_at]);

  return (
    <div className="relative flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md sm:col-span-2 lg:col-span-2 lg:row-span-2">
      {/* 1. Cabecera Homogénea alineada a los KPI cards del Dashboard */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Título uniforme de una sola línea */}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block truncate">
            Mercado P2P ({asset}/{fiat})
          </span>

          {/* Subtítulo estándar con estado en vivo y resumen sutil del filtro si está activo */}
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
            <span>{updatedTimeStr ? `En vivo · ${updatedTimeStr}` : 'Consultando mercado'}</span>
            <span className="text-slate-700">·</span>
            <span>
              {hasActiveFilters
                ? `${selectedBank !== 'ALL' ? selectedBank : 'Filtrado'} (${filterSideAds.buy.length + filterSideAds.sell.length} ofertas)`
                : `${filterSideAds.buy.length + filterSideAds.sell.length} ofertas`}
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
        <div
          ref={filterPopoverRef}
          className="absolute right-3 top-12 z-30 w-[calc(100%-1.5rem)] sm:w-[400px] rounded-xl border border-slate-700/90 bg-slate-950/95 p-3 shadow-2xl shadow-black/80 backdrop-blur-md space-y-2.5 text-[11px]"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              Filtros del Mercado P2P
            </span>
            <button
              type="button"
              onClick={() => setShowFiltersPanel(false)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Banco / Método de Pago */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium block">Banco / Método de pago:</span>
              <span className="text-[10px] text-slate-500">
                {bankCatalog.length > 0 ? `${bankCatalog.length} bancos nacionales` : 'Cargando bancos...'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 max-h-[140px] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => updateBank('ALL')}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                  selectedBank === 'ALL'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos los Bancos
              </button>

              <button
                type="button"
                onClick={() => updateBank('Pago Movil')}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                  selectedBank.toLowerCase() === 'pago movil' || selectedBank.toLowerCase() === 'pagomovil'
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/30'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                ⚡ Pago Móvil
              </button>

              {bankCatalog.map((b) => {
                const isSelected = selectedBank.toLowerCase() === b.name.toLowerCase();
                return (
                  <button
                    key={b.code || b.name}
                    type="button"
                    onClick={() => updateBank(isSelected ? 'ALL' : b.name)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold ring-1 ring-amber-500/30'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monto en Fiat */}
          <div className="space-y-1 border-t border-slate-800/80 pt-2">
            <span className="text-slate-400 font-medium block">Monto a operar ({fiat}):</span>
            <div className="flex flex-wrap items-center gap-1">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateAmount(preset.val)}
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                    amountFilter === preset.val
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <Input
                type="text"
                value={amountFilter}
                onChange={(e) => updateAmount(e.target.value)}
                placeholder="Ej. 100k, 50000"
                size="xs"
                className="w-28 font-mono text-[10px]"
              />
            </div>
          </div>

          {/* Criterio de Tasa + Verificados */}
          <div className="space-y-1 border-t border-slate-800/80 pt-2">
            <span className="text-slate-400 font-medium block">Criterio de precio y anunciantes:</span>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'BEST', label: 'Mejor #1' },
                  { id: 'TOP5', label: 'Top 5' },
                  { id: 'TOP10', label: 'Top 10' },
                  { id: 'WEIGHTED', label: 'Pond.' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updatePriceMode(mode.id)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                      priceMode === mode.id
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => updateMerchants(!onlyMerchants)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                  onlyMerchants
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Verificados</span>
              </button>
            </div>
          </div>

          {/* Acciones inferiores del popover */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300 hover:text-rose-200 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Limpiar filtros</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-500">Mostrando todo el mercado</span>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setShowFiltersPanel(false);
                  onOpenSettings();
                }}
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer"
              >
                <Settings className="h-3 w-3" />
                <span>Supervisar Colector</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Cuerpo Central: Gráfica de Evolución con Tooltip al pasar el cursor */}
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
        ) : filterSideAds.buy.length === 0 && filterSideAds.sell.length === 0 ? (
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
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/80 p-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
            {/* Lado Izquierdo: Pizarra COMPRAR (Vendedores de USDT - Menor Tasa) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Comprar USDT (Vendedores)
                </span>
                <span className="text-[9px] font-mono text-slate-500">Menor Tasa</span>
              </div>
              <div className="space-y-1">
                {(() => {
                  const buySlice = filterSideAds.buy.slice(0, 6);
                  const maxBuyQty = Math.max(1, ...buySlice.map((a) => Number(a.available_qty || 0)));
                  return buySlice.map((ad, idx) => {
                    const qty = Number(ad.available_qty || 0);
                    const depthPct = Math.min(100, Math.round((qty / maxBuyQty) * 100));
                    const isMyAd = ad.adv_no && myAdvNos.has(String(ad.adv_no).trim());

                    return (
                      <div
                        key={ad.adv_no || idx}
                        className={`relative flex items-center justify-between overflow-hidden rounded px-2 py-1 text-[10px] transition-colors ${
                          isMyAd
                            ? 'border border-amber-500/60 bg-amber-500/10 shadow-xs'
                            : 'border border-slate-800/40 bg-slate-900/40'
                        }`}
                      >
                        {/* Barra de profundidad visual de volumen */}
                        <div
                          className={`pointer-events-none absolute inset-y-0 right-0 transition-all duration-300 ${
                            isMyAd ? 'bg-amber-500/20' : 'bg-emerald-500/10'
                          }`}
                          style={{ width: `${depthPct}%` }}
                        />

                        <div className="relative z-10 truncate max-w-[110px]">
                          <span
                            className={`font-semibold block truncate ${
                              isMyAd ? 'text-amber-300' : 'text-slate-200'
                            }`}
                          >
                            {isMyAd ? `${ad.advertiser || 'Tu Anuncio'} (Tú)` : (ad.advertiser || 'Anónimo')}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {ad.pay_methods?.slice(0, 2).join(', ')}
                          </span>
                        </div>

                        <div className="relative z-10 text-right">
                          <span
                            className={`font-bold font-mono block text-xs ${
                              isMyAd ? 'text-amber-300' : 'text-emerald-400'
                            }`}
                          >
                            {fmtRate(ad.price)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {fmtRate(ad.available_qty, 0)} {asset}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Lado Derecho: Pizarra VENDER (Compradores de USDT - Mayor Tasa) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  Vender USDT (Compradores)
                </span>
                <span className="text-[9px] font-mono text-slate-500">Mayor Tasa</span>
              </div>
              <div className="space-y-1">
                {(() => {
                  const sellSlice = filterSideAds.sell.slice(0, 6);
                  const maxSellQty = Math.max(1, ...sellSlice.map((a) => Number(a.available_qty || 0)));
                  return sellSlice.map((ad, idx) => {
                    const qty = Number(ad.available_qty || 0);
                    const depthPct = Math.min(100, Math.round((qty / maxSellQty) * 100));
                    const isMyAd = ad.adv_no && myAdvNos.has(String(ad.adv_no).trim());

                    return (
                      <div
                        key={ad.adv_no || idx}
                        className={`relative flex items-center justify-between overflow-hidden rounded px-2 py-1 text-[10px] transition-colors ${
                          isMyAd
                            ? 'border border-amber-500/60 bg-amber-500/10 shadow-xs'
                            : 'border border-slate-800/40 bg-slate-900/40'
                        }`}
                      >
                        {/* Barra de profundidad visual de volumen */}
                        <div
                          className={`pointer-events-none absolute inset-y-0 right-0 transition-all duration-300 ${
                            isMyAd ? 'bg-amber-500/20' : 'bg-rose-500/10'
                          }`}
                          style={{ width: `${depthPct}%` }}
                        />

                        <div className="relative z-10 truncate max-w-[110px]">
                          <span
                            className={`font-semibold block truncate ${
                              isMyAd ? 'text-amber-300' : 'text-slate-200'
                            }`}
                          >
                            {isMyAd ? `${ad.advertiser || 'Tu Anuncio'} (Tú)` : (ad.advertiser || 'Anónimo')}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">
                            {ad.pay_methods?.slice(0, 2).join(', ')}
                          </span>
                        </div>

                        <div className="relative z-10 text-right">
                          <span
                            className={`font-bold font-mono block text-xs ${
                              isMyAd ? 'text-amber-300' : 'text-rose-400'
                            }`}
                          >
                            {fmtRate(ad.price)}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            {fmtRate(ad.available_qty, 0)} {asset}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Pie de Tarjeta Estándar: Cotizaciones de Compra / Venta y Spread Comercial */}
      <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between gap-2 text-xs tabular-nums flex-wrap">
        <div className="flex items-center gap-3">
          {/* Precio de Compra (WAC / Pizarra Comprar) */}
          <span
            className="inline-flex items-center gap-1 text-emerald-400 font-medium font-mono cursor-help"
            title="Mejor precio en la pestaña 'Comprar' de Binance P2P"
          >
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-slate-400 font-sans text-[11px]">Compra:</span>
            <span className="font-semibold text-slate-100">{fmtRate(filteredStats.buy.activePrice)}</span>
          </span>

          <span className="text-slate-700 select-none">·</span>

          {/* Precio de Venta (WAP / Pizarra Vender) */}
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
