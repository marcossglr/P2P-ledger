import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { binanceApi } from '../services/api';
import { parseSmartAmount } from '../utils/formatters';

const safeStorage = {
  getItem: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  },
  setItem: (key, val) => {
    try {
      localStorage.setItem(key, val);
    } catch {
      // Ignorar quota en sandboxes
    }
  },
};

/**
 * Hook centralizado que administra como ÚNICA FUENTE DE VERDAD:
 * 1. El estado persistente de los filtros (Banco, Monto, Solo Verificados, Modo de Precio).
 * 2. La consulta y polling continuo a la API pública de Binance P2P.
 * 3. Métodos oficiales de pago devueltos por Binance P2P para el fiat actual.
 * 4. Cálculo de estadísticas del mercado (Best, Top 5, Top 10, Weighted, Spread).
 * 5. Síntesis concisa de filtros activos.
 * 6. Evaluación de "Mis Anuncios" contra el libro de órdenes.
 */
export function useP2PMarketBoard({
  selectedAsset: initialAsset = 'USDT',
  fiatCurrency = 'VES',
  refreshTrigger,
}) {
  // --- 1. Filtros Activos con persistencia ---
  const [selectedAsset, setSelectedAsset] = useState(
    () => safeStorage.getItem('p2p_chart_asset') || initialAsset || 'USDT'
  );
  const [selectedBank, setSelectedBank] = useState(
    () => safeStorage.getItem(`p2p_chart_bank_${fiatCurrency}`) || safeStorage.getItem('p2p_chart_bank', 'ALL')
  );
  const [amountFilter, setAmountFilter] = useState(
    () => safeStorage.getItem(`p2p_chart_amount_${fiatCurrency}`) || safeStorage.getItem('p2p_chart_amount', '')
  );
  const [onlyMerchants, setOnlyMerchants] = useState(
    () => safeStorage.getItem('p2p_chart_merchants') === 'true'
  );
  const [priceMode, setPriceMode] = useState(
    () => safeStorage.getItem('p2p_chart_price_mode', 'BEST')
  );

  // --- 2. Estado de Datos de Mercado ---
  const [marketData, setMarketData] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(null);

  // --- 3. Métodos Oficiales de Pago y Criptoactivos según Binance ---
  const [binancePayMethods, setBinancePayMethods] = useState([]);
  const [loadingPayMethods, setLoadingPayMethods] = useState(false);
  const [availableAssets, setAvailableAssets] = useState([
    { id: 'USDT', label: 'USDT', name: 'Tether' },
    { id: 'BTC', label: 'BTC', name: 'Bitcoin' },
    { id: 'ETH', label: 'ETH', name: 'Ethereum' },
    { id: 'USDC', label: 'USDC', name: 'USD Coin' },
    { id: 'BNB', label: 'BNB', name: 'BNB' },
  ]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [payMethodSearch, setPayMethodSearch] = useState('');
  const [showAllPayMethods, setShowAllPayMethods] = useState(false);

  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cargar catálogo de métodos de pago y criptoactivos oficiales de Binance al cambiar divisa fiat
  useEffect(() => {
    let active = true;
    setLoadingPayMethods(true);
    setLoadingAssets(true);

    const fiat = fiatCurrency || 'VES';

    Promise.allSettled([
      binanceApi.getPaymentMethods(fiat),
      binanceApi.getCryptoAssets(fiat),
    ]).then(([methodsResult, assetsResult]) => {
      if (!active) return;

      if (methodsResult.status === 'fulfilled' && methodsResult.value?.methods) {
        setBinancePayMethods(methodsResult.value.methods);
      } else {
        setBinancePayMethods([]);
      }

      if (assetsResult.status === 'fulfilled' && Array.isArray(assetsResult.value?.assets) && assetsResult.value.assets.length > 0) {
        const fetchedAssets = assetsResult.value.assets;
        setAvailableAssets(fetchedAssets);

        // Si el activo actual no es compatible con el nuevo fiat, reajustar a USDT o al primero disponible
        setSelectedAsset((current) => {
          const exists = fetchedAssets.some((a) => a.id === current);
          if (!exists) {
            const fallback = fetchedAssets.some((a) => a.id === 'USDT') ? 'USDT' : fetchedAssets[0].id;
            safeStorage.setItem('p2p_chart_asset', fallback);
            return fallback;
          }
          return current;
        });
      }

      setLoadingPayMethods(false);
      setLoadingAssets(false);
    });

    return () => {
      active = false;
    };
  }, [fiatCurrency]);

  // Mantener referencias actualizadas para evitar cierres obsoletos en el polling
  const stateRef = useRef({ selectedAsset, selectedBank, amountFilter, onlyMerchants, priceMode });
  stateRef.current = { selectedAsset, selectedBank, amountFilter, onlyMerchants, priceMode };

  // --- 4. Ejecución centralizada de la petición a Binance ---
  const fetchMarketStats = useCallback(
    async (overrides = {}) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isMountedRef.current) {
        setMarketLoading(true);
      }

      const activeAsset = overrides.asset !== undefined ? overrides.asset : stateRef.current.selectedAsset;
      const activeBank = overrides.bank !== undefined ? overrides.bank : stateRef.current.selectedBank;
      const activeAmount = overrides.amount !== undefined ? overrides.amount : stateRef.current.amountFilter;
      const activeMerchants = overrides.onlyMerchants !== undefined ? overrides.onlyMerchants : stateRef.current.onlyMerchants;

      try {
        const queryParams = {
          include_ads: true,
        };

        if (activeAsset && activeAsset !== 'ALL') queryParams.asset = activeAsset;
        if (fiatCurrency && fiatCurrency !== 'ALL') queryParams.fiat = fiatCurrency;
        if (activeBank && activeBank !== 'ALL') queryParams.bank = activeBank;

        const parsedAmt = parseSmartAmount(activeAmount);
        if (parsedAmt && parsedAmt > 0) queryParams.amount = parsedAmt;

        if (activeMerchants) queryParams.only_merchants = true;
        if (overrides.force) queryParams.force = true;

        const json = await binanceApi.getPublicMarketStats(queryParams);

        if (isMountedRef.current) {
          setMarketData(json);
          setMarketError(null);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setMarketError(err?.message || 'Error al obtener datos de mercado');
        }
      } finally {
        isFetchingRef.current = false;
        if (isMountedRef.current) {
          setMarketLoading(false);
        }
      }
    },
    [selectedAsset, fiatCurrency]
  );

  // Sincronizar cuando cambia la divisa fiat externa
  const prevFiatRef = useRef(fiatCurrency);
  useEffect(() => {
    if (prevFiatRef.current !== fiatCurrency) {
      prevFiatRef.current = fiatCurrency;
      const fiatBank = safeStorage.getItem(`p2p_chart_bank_${fiatCurrency}`, 'ALL');
      const fiatAmount = safeStorage.getItem(`p2p_chart_amount_${fiatCurrency}`, '');

      setSelectedBank(fiatBank);
      setAmountFilter(fiatAmount);

      safeStorage.setItem('p2p_chart_bank', fiatBank);
      safeStorage.setItem('p2p_chart_amount', fiatAmount);

      fetchMarketStats({ bank: fiatBank, amount: fiatAmount, force: true });
    }
  }, [fiatCurrency, fetchMarketStats]);

  // Sincronizar si cambia initialAsset desde props
  const prevInitialAssetRef = useRef(initialAsset);
  useEffect(() => {
    if (initialAsset && prevInitialAssetRef.current !== initialAsset) {
      prevInitialAssetRef.current = initialAsset;
      setSelectedAsset(initialAsset);
      safeStorage.setItem('p2p_chart_asset', initialAsset);
      fetchMarketStats({ asset: initialAsset, force: true });
    }
  }, [initialAsset, fetchMarketStats]);

  // Carga inicial y por refreshTrigger
  useEffect(() => {
    fetchMarketStats();
  }, [fetchMarketStats, refreshTrigger]);

  // Polling continuo inteligente (cada 5-10s)
  useEffect(() => {
    let timerId = null;
    let isActive = true;

    const scheduleNextPoll = () => {
      const randomInterval = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
      timerId = setTimeout(async () => {
        if (!isActive) return;
        if (typeof document === 'undefined' || !document.hidden) {
          await fetchMarketStats();
        }
        if (isActive) {
          scheduleNextPoll();
        }
      }, randomInterval);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && isActive) {
        fetchMarketStats();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    scheduleNextPoll();

    return () => {
      isActive = false;
      if (timerId) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchMarketStats]);

  // --- 5. Mutadores Unificados de Filtros ---
  const updateAsset = useCallback(
    (asset) => {
      const clean = (asset || 'USDT').toUpperCase().trim();
      setSelectedAsset(clean);
      safeStorage.setItem('p2p_chart_asset', clean);
      fetchMarketStats({ asset: clean, force: true });
    },
    [fetchMarketStats]
  );

  const updateBank = useCallback(
    (bank) => {
      setSelectedBank(bank);
      safeStorage.setItem('p2p_chart_bank', bank);
      safeStorage.setItem(`p2p_chart_bank_${fiatCurrency}`, bank);
      fetchMarketStats({ bank, force: true });
    },
    [fiatCurrency, fetchMarketStats]
  );

  const updateAmount = useCallback(
    (amount) => {
      setAmountFilter(amount);
      safeStorage.setItem('p2p_chart_amount', amount);
      safeStorage.setItem(`p2p_chart_amount_${fiatCurrency}`, amount);
      fetchMarketStats({ amount, force: true });
    },
    [fiatCurrency, fetchMarketStats]
  );

  const updateMerchants = useCallback(
    (val) => {
      setOnlyMerchants(val);
      safeStorage.setItem('p2p_chart_merchants', String(val));
      fetchMarketStats({ onlyMerchants: val, force: true });
    },
    [fetchMarketStats]
  );

  const updatePriceMode = useCallback((val) => {
    setPriceMode(val);
    safeStorage.setItem('p2p_chart_price_mode', val);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedAsset('USDT');
    setSelectedBank('ALL');
    setAmountFilter('');
    setOnlyMerchants(false);
    setPriceMode('BEST');

    safeStorage.setItem('p2p_chart_asset', 'USDT');
    safeStorage.setItem('p2p_chart_bank', 'ALL');
    safeStorage.setItem(`p2p_chart_bank_${fiatCurrency}`, 'ALL');
    safeStorage.setItem('p2p_chart_amount', '');
    safeStorage.setItem(`p2p_chart_amount_${fiatCurrency}`, '');
    safeStorage.setItem('p2p_chart_merchants', 'false');
    safeStorage.setItem('p2p_chart_price_mode', 'BEST');

    fetchMarketStats({ asset: 'USDT', bank: 'ALL', amount: '', onlyMerchants: false, force: true });
  }, [fiatCurrency, fetchMarketStats]);

  const hasActiveFilters = useMemo(
    () => (selectedAsset && selectedAsset !== 'USDT') || selectedBank !== 'ALL' || amountFilter !== '' || onlyMerchants,
    [selectedAsset, selectedBank, amountFilter, onlyMerchants]
  );

  // --- 6. Filtrado y visibilidad de métodos de pago en popover ---
  const displayedPayMethods = useMemo(() => {
    let list = binancePayMethods;
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
  }, [binancePayMethods, payMethodSearch, showAllPayMethods, selectedBank]);

  // --- 7. Síntesis Concisa de Filtros Activos ---
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

    // Criptoactivo (si no es USDT estándar)
    if (selectedAsset && selectedAsset !== 'USDT') {
      parts.push(selectedAsset);
    }

    // Método / Banco
    if (selectedBank && selectedBank !== 'ALL') {
      const matched = binancePayMethods.find(
        (m) =>
          m.identifier?.toLowerCase() === selectedBank.toLowerCase() ||
          m.name?.toLowerCase() === selectedBank.toLowerCase()
      );
      parts.push(matched?.name || selectedBank);
    }

    // Monto simulado
    if (amountFilter) {
      const parsed = parseSmartAmount(amountFilter);
      if (parsed) {
        const fmtAmt =
          parsed >= 1000000
            ? `${(parsed / 1000000).toFixed(parsed % 1000000 === 0 ? 0 : 1)}M`
            : parsed >= 1000
            ? `${(parsed / 1000).toFixed(parsed % 1000 === 0 ? 0 : 1)}k`
            : String(parsed);
        parts.push(`≥ ${fmtAmt} ${fiatCurrency}`);
      }
    }

    // Comerciantes
    if (onlyMerchants) {
      parts.push('Verificados');
    }

    // Modo de precio
    if (priceMode !== 'BEST') {
      parts.push(priceMode === 'TOP5' ? 'Top 5' : priceMode === 'TOP10' ? 'Top 10' : 'Pond.');
    }

    return parts.join(' · ') || 'Todo el mercado';
  }, [hasActiveFilters, priceMode, selectedAsset, selectedBank, binancePayMethods, amountFilter, onlyMerchants, fiatCurrency]);

  // --- 8. Anuncios devueltos y estadísticas de precios en memoria ---
  const filterSideAds = useMemo(() => {
    return {
      buy: marketData?.buy?.ads || [],
      sell: marketData?.sell?.ads || [],
    };
  }, [marketData]);

  const filteredStats = useMemo(() => {
    const calcSide = (ads, side) => {
      const prices = ads.map((a) => Number(a.price)).filter((p) => Number.isFinite(p) && p > 0);
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

      let activePrice = ordered[0];
      if (priceMode === 'TOP5') activePrice = top5Avg;
      else if (priceMode === 'TOP10') activePrice = top10Avg;
      else if (priceMode === 'WEIGHTED') activePrice = weightedAvg;

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
      // Spread comercial P2P (orientado al comerciante/maker):
      // El comerciante publica anuncio de VENTA en la pestaña "Comprar" (buy.activePrice)
      // y anuncio de COMPRA en la pestaña "Vender" (sell.activePrice).
      // Margen operativo = Precio de Venta del Comerciante - Precio de Compra del Comerciante
      //                  = buy.activePrice - sell.activePrice
      spreadAbs = buy.activePrice - sell.activePrice;
      spreadPct = sell.activePrice > 0 ? (spreadAbs / sell.activePrice) * 100 : 0;
    }

    return { buy, sell, spreadAbs, spreadPct };
  }, [filterSideAds, priceMode]);

  // --- 9. Evaluación de "Mis Anuncios" ---
  const evaluateMyAdOnBoard = useCallback(
    (ad) => {
      if (!ad || !marketData) return null;

      const rawType = String(ad.adv_type || '').toUpperCase();
      const isBuyAd = rawType === 'COMPRA' || rawType === 'BUY';

      const rawBoardAds = isBuyAd ? marketData?.sell?.ads || [] : marketData?.buy?.ads || [];
      if (rawBoardAds.length === 0) return null;

      const adBanks = (ad.trade_methods || []).map((m) => String(m).toLowerCase());
      let boardAds = rawBoardAds;
      if (adBanks.length > 0) {
        const filteredByBank = rawBoardAds.filter((bAd) => {
          const bMethods = [...(bAd.pay_methods || []), ...(bAd.pay_identifiers || [])].map((m) =>
            String(m).toLowerCase()
          );
          return adBanks.some((ab) => bMethods.some((bm) => bm.includes(ab) || ab.includes(bm)));
        });
        if (filteredByBank.length > 0) {
          boardAds = filteredByBank;
        }
      }

      const myPrice = Number(ad.price || 0);
      if (myPrice <= 0 || !Number.isFinite(myPrice)) return null;

      const exactIdx = boardAds.findIndex(
        (bAd) => bAd.adv_no && String(bAd.adv_no) === String(ad.adv_no)
      );

      const aheadAds =
        exactIdx >= 0
          ? boardAds.slice(0, exactIdx)
          : boardAds.filter((bAd) => {
              const p = Number(bAd.price);
              return isBuyAd ? p > myPrice : p < myPrice;
            });

      const rank = exactIdx >= 0 ? exactIdx + 1 : aheadAds.length + 1;
      const aheadUsdt = aheadAds.reduce((s, bAd) => s + Number(bAd.available_qty || 0), 0);
      const bestBoardPrice = Number(boardAds[0]?.price || 0);
      const deltaVsBest = bestBoardPrice > 0 ? myPrice - bestBoardPrice : null;

      let suggestedRank1Price = null;
      if (bestBoardPrice > 0) {
        if (rank === 1) {
          suggestedRank1Price = myPrice;
        } else {
          const rawSuggested = isBuyAd ? bestBoardPrice + 0.01 : Math.max(0.01, bestBoardPrice - 0.01);
          suggestedRank1Price = Number(rawSuggested.toFixed(2));
        }
      }

      return {
        rank,
        totalCompetitors: boardAds.length,
        aheadUsdt,
        bestBoardPrice,
        deltaVsBest,
        suggestedRank1Price,
      };
    },
    [marketData]
  );

  // --- 10. Evaluación de frescura de datos en vivo ---
  const [isStale, setIsStale] = useState(false);
  const fetchedAt = marketData?.fetched_at || null;

  useEffect(() => {
    if (!fetchedAt) {
      setIsStale(false);
      return;
    }
    const checkFreshness = () => {
      const fetchedMs = new Date(fetchedAt).getTime();
      setIsStale(!isNaN(fetchedMs) && Date.now() - fetchedMs > 45000);
    };
    checkFreshness();
    const interval = setInterval(checkFreshness, 5000);
    return () => clearInterval(interval);
  }, [fetchedAt]);

  return {
    marketData,
    marketLoading,
    marketError,
    isStale,
    isLive: Boolean(marketData && !marketError && !isStale),
    fetchMarketStats,
    // Filtros consolidados y sus mutadores
    selectedAsset,
    updateAsset,
    selectedBank,
    updateBank,
    amountFilter,
    updateAmount,
    onlyMerchants,
    updateMerchants,
    priceMode,
    updatePriceMode,
    resetFilters,
    hasActiveFilters,
    filtersSummary,
    // Criptos y métodos de pago oficiales de Binance
    availableAssets,
    loadingAssets,
    binancePayMethods,
    loadingPayMethods,
    payMethodSearch,
    setPayMethodSearch,
    showAllPayMethods,
    setShowAllPayMethods,
    displayedPayMethods,
    // Datos y cálculos listos para la vista
    filterSideAds,
    filteredStats,
    evaluateMyAdOnBoard,
  };
}
