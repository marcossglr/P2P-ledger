import React, { useState, useMemo, useRef, useEffect } from 'react';
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

/**
 * Normaliza cualquier entrada de texto de monto (ej: "100k", "100K", "100.000", "50,000", "1.5m") a un número float válido.
 */
function parseSmartAmount(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return null;

  if (clean.endsWith('k')) {
    const num = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return Number.isFinite(num) && num > 0 ? num * 1000 : null;
  }
  if (clean.endsWith('m')) {
    const num = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return Number.isFinite(num) && num > 0 ? num * 1000000 : null;
  }

  // Quitar separadores de miles habituales (ej: 100.000 -> 100000 o 100,000 -> 100000)
  const normalized = clean.includes('.') && clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.includes('.') && clean.split('.')[1]?.length === 3
    ? clean.replace(/\./g, '')
    : clean.replace(/,/g, '');

  const num = parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export default function P2PMarketChartCard({
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

  // Filtros locales instantáneos sobre toda la data del mercado (persistidos en localStorage)
  const [selectedBank, setSelectedBank] = useState(
    () => localStorage.getItem('p2p_chart_bank') || 'ALL'
  );
  const [amountFilter, setAmountFilter] = useState(
    () => localStorage.getItem('p2p_chart_amount') || ''
  );
  const [onlyMerchants, setOnlyMerchants] = useState(
    () => localStorage.getItem('p2p_chart_merchants') === 'true'
  );
  const [priceMode, setPriceMode] = useState(
    () => localStorage.getItem('p2p_chart_price_mode') || 'BEST'
  ); // 'BEST' | 'TOP5' | 'TOP10' | 'WEIGHTED'

  // Pestaña activa dentro de la tarjeta: 'CHART' (Gráfica) o 'ORDER_BOOK' (Libro de ofertas)
  const [activeTab, setActiveTab] = useState('CHART');

  const updateBank = (val) => {
    setSelectedBank(val);
    localStorage.setItem('p2p_chart_bank', val);
    if (onRefresh) onRefresh(true, val, parseSmartAmount(amountFilter));
  };
  const updateAmount = (val) => {
    setAmountFilter(val);
    localStorage.setItem('p2p_chart_amount', val);
    if (onRefresh) onRefresh(true, selectedBank, parseSmartAmount(val));
  };
  const updateMerchants = (val) => {
    setOnlyMerchants(val);
    localStorage.setItem('p2p_chart_merchants', String(val));
  };
  const updatePriceMode = (val) => {
    setPriceMode(val);
    localStorage.setItem('p2p_chart_price_mode', val);
  };

  const [hoverIdx, setHoverIdx] = useState(null);

  const fmtRate = (n, digits = 2) =>
    n == null || Number.isNaN(Number(n))
      ? '—'
      : Number(n).toLocaleString('es-ES', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });

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

  const hasActiveFilters =
    selectedBank !== 'ALL' || amountFilter !== '' || onlyMerchants || priceMode !== 'BEST';

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

    const nowTime = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

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
      spreadAreaPath,
      breakevenY,
      breakevenNum,
    };
  }, [historySeries, breakevenRate]);

  const hoveredPoint =
    hoverIdx != null && historySeries[hoverIdx] ? historySeries[hoverIdx] : null;

  const updatedTimeStr = useMemo(() => {
    if (!marketData?.fetched_at) return null;
    try {
      return new Date(marketData.fetched_at).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return null;
    }
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
          <div className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950/70 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('CHART')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === 'CHART'
                  ? 'bg-slate-800 text-amber-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gráfica
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ORDER_BOOK')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === 'ORDER_BOOK'
                  ? 'bg-slate-800 text-amber-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pizarra
            </button>
          </div>

          {/* Botón Filtros estándar */}
          <button
            type="button"
            onClick={() => setShowFiltersPanel((prev) => !prev)}
            className={`relative flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer ${
              showFiltersPanel || hasActiveFilters
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-800/80 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
            title="Configurar filtros del mercado"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          </button>

          {/* Botón Actualizar estándar */}
          <button
            type="button"
            onClick={() => onRefresh && onRefresh(true)}
            disabled={marketLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Actualizar cotizaciones ahora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${marketLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
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
              <input
                type="text"
                value={amountFilter}
                onChange={(e) => updateAmount(e.target.value)}
                placeholder="Ej. 100k, 50000"
                className="h-6 w-28 rounded-md border border-slate-700 bg-slate-900 px-2 font-mono text-[10px] text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
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
            <button
              type="button"
              onClick={() => onRefresh && onRefresh(true)}
              className="mt-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-amber-300 hover:bg-slate-700 cursor-pointer"
            >
              Reintentar
            </button>
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
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
            >
              Ver todo el mercado
            </button>
          </div>
        ) : activeTab === 'CHART' && chartGeometry ? (
          <div className="relative rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
            {/* Tooltip Flotante al posicionar el cursor sobre la gráfica */}
            {hoveredPoint && hoverIdx != null && (
              <div
                className="pointer-events-none absolute top-2 z-20 rounded-lg border border-slate-700/90 bg-slate-900/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur-sm tabular-nums"
                style={{
                  left:
                    hoverIdx > historySeries.length / 2 ? '10px' : 'auto',
                  right:
                    hoverIdx <= historySeries.length / 2 ? '10px' : 'auto',
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-0.5 mb-1">
                  <span className="font-mono text-[10px] text-slate-400">
                    {hoveredPoint.fullTime}
                  </span>
                  {hoveredPoint.buy_val > 0 && hoveredPoint.sell_val > 0 && (
                    <span className="font-mono text-[10px] font-semibold text-amber-300">
                      Δ {fmtRate(hoveredPoint.buy_val - hoveredPoint.sell_val)} {fiat}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Comprar: {fmtRate(hoveredPoint.buy_val)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Vender: {fmtRate(hoveredPoint.sell_val)}
                  </span>
                </div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${chartGeometry.W} ${chartGeometry.H}`}
              className="w-full h-[138px] overflow-visible"
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id="p2pSpreadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.09" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.09" />
                </linearGradient>
              </defs>

              {/* Líneas guía horizontales */}
              {[0.2, 0.5, 0.8].map((ratio, idx) => (
                <line
                  key={idx}
                  x1="8"
                  x2={chartGeometry.W - chartGeometry.padRight + 4}
                  y1={chartGeometry.H * ratio}
                  y2={chartGeometry.H * ratio}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              ))}

              {/* Etiquetas de Escala Vertical (Mín y Máx en el margen derecho) */}
              <text
                x={chartGeometry.W - 2}
                y={22}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[9px] select-none"
              >
                {fmtRate(chartGeometry.maxVal, 1)}
              </text>
              <text
                x={chartGeometry.W - 2}
                y={chartGeometry.H - 18}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[9px] select-none"
              >
                {fmtRate(chartGeometry.minVal, 1)}
              </text>

              {/* Línea de Referencia de Breakeven si está en rango */}
              {chartGeometry.breakevenY != null && (
                <g>
                  <line
                    x1="8"
                    x2={chartGeometry.W - chartGeometry.padRight + 4}
                    y1={chartGeometry.breakevenY}
                    y2={chartGeometry.breakevenY}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    strokeWidth="1"
                    strokeOpacity="0.75"
                  />
                  <text
                    x={chartGeometry.W - 2}
                    y={chartGeometry.breakevenY + 3}
                    textAnchor="end"
                    className="fill-amber-400 font-mono text-[8px] font-semibold select-none"
                  >
                    Eq {fmtRate(chartGeometry.breakevenNum, 0)}
                  </text>
                </g>
              )}

              {/* Área sombreada tenue entre las dos líneas */}
              <path d={chartGeometry.spreadAreaPath} fill="url(#p2pSpreadGrad)" />

              {/* Línea Verde: Pizarra Comprar de Binance */}
              <path
                d={chartGeometry.buyPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Línea Roja: Pizarra Vender de Binance */}
              <path
                d={chartGeometry.sellPath}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Línea vertical y puntos activos al pasar el cursor */}
              {hoverIdx != null && chartGeometry.buyPts[hoverIdx] && (
                <line
                  x1={chartGeometry.buyPts[hoverIdx].x}
                  x2={chartGeometry.buyPts[hoverIdx].x}
                  y1="6"
                  y2={chartGeometry.H - 6}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {chartGeometry.buyPts.map((pt, i) => {
                const isActive =
                  hoverIdx === i ||
                  (hoverIdx == null && i === chartGeometry.buyPts.length - 1);
                return (
                  <g key={i}>
                    {isActive && (
                      <>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoverIdx === i ? 4 : 3}
                          fill="#10b981"
                          stroke="#0f172a"
                          strokeWidth="1.5"
                        />
                        {chartGeometry.sellPts[i] && (
                          <circle
                            cx={chartGeometry.sellPts[i].x}
                            cy={chartGeometry.sellPts[i].y}
                            r={hoverIdx === i ? 4 : 3}
                            fill="#f43f5e"
                            stroke="#0f172a"
                            strokeWidth="1.5"
                          />
                        )}
                      </>
                    )}
                    {/* Franja interactiva para capturar el cursor en cada punto */}
                    <rect
                      x={
                        pt.x -
                        (chartGeometry.W - chartGeometry.padRight) / Math.max(2, chartGeometry.buyPts.length * 2)
                      }
                      y="0"
                      width={(chartGeometry.W - chartGeometry.padRight) / Math.max(1, chartGeometry.buyPts.length)}
                      height={chartGeometry.H}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoverIdx(i)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Eje X: Horas de inicio y fin */}
            <div
              className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1"
              style={{ paddingRight: `${chartGeometry.padRight}px` }}
            >
              <span>{historySeries[0]?.label || ''}</span>
              <span>{historySeries[historySeries.length - 1]?.label || 'Ahora'}</span>
            </div>
          </div>
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
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold font-mono border ${
            Number(filteredStats.spreadPct || 0) > 0.005
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
              : Number(filteredStats.spreadPct || 0) < -0.005
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
              : 'border-slate-800 bg-slate-800/80 text-slate-300'
          }`}
          title={
            filteredStats.spreadAbs != null
              ? `Diferencia entre Compra y Venta: ${fmtRate(filteredStats.spreadAbs)} ${fiat}`
              : 'Diferencia comercial'
          }
        >
          {filteredStats.spreadAbs != null && (
            <span className="text-slate-400 font-normal">
              Δ {fmtRate(filteredStats.spreadAbs)} ·
            </span>
          )}
          <span>
            {filteredStats.spreadPct != null
              ? `${filteredStats.spreadPct > 0 ? '+' : ''}${Number(filteredStats.spreadPct).toFixed(2)}% spread`
              : '—'}
          </span>
        </span>
      </div>
    </div>
  );
}
