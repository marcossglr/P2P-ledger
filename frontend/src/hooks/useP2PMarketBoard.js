import { useState, useEffect, useCallback } from 'react';
import { binanceApi } from '../services/api';

/**
 * Hook para gestionar datos y polling en vivo de la pizarra P2P de Binance
 * y evaluar la posición/rango competitivo de los anuncios del usuario.
 */
export function useP2PMarketBoard({
  selectedAsset = 'USDT',
  fiatCurrency = 'VES',
  refreshTrigger,
  breakevenSellRate = 0,
}) {
  const [marketData, setMarketData] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(null);

  const fetchMarketStats = useCallback(
    async (force = false, bank = null, amount = null) => {
      setMarketLoading((prev) => (prev ? prev : false));
      try {
        const savedBank = bank !== null ? bank : localStorage.getItem('p2p_chart_bank') || 'ALL';
        const savedAmount = amount !== null ? amount : localStorage.getItem('p2p_chart_amount') || '';

        const queryParams = {
          include_ads: true,
        };
        if (selectedAsset && selectedAsset !== 'ALL') queryParams.asset = selectedAsset;
        if (fiatCurrency && fiatCurrency !== 'ALL') queryParams.fiat = fiatCurrency;
        if (savedBank && savedBank !== 'ALL') queryParams.bank = savedBank;
        if (savedAmount && Number(savedAmount) > 0) queryParams.amount = Number(savedAmount);
        if (force) queryParams.force = true;

        const json = await binanceApi.getPublicMarketStats(queryParams);
        setMarketData(json);
        setMarketError(null);
      } catch (err) {
        setMarketError((prev) => prev || err.message);
      } finally {
        setMarketLoading(false);
      }
    },
    [selectedAsset, fiatCurrency]
  );

  useEffect(() => {
    fetchMarketStats(false);
  }, [fetchMarketStats, refreshTrigger]);

  // Auto-refresco dinámico con jitter aleatorio entre 15 y 20 segundos (se pausa si la pestaña no está visible)
  useEffect(() => {
    let timerId = null;

    const scheduleNextPoll = () => {
      const randomInterval = Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000;
      timerId = setTimeout(async () => {
        if (typeof document === 'undefined' || !document.hidden) {
          await fetchMarketStats(false);
        }
        scheduleNextPoll();
      }, randomInterval);
    };

    scheduleNextPoll();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchMarketStats]);

  // Evaluar cada uno de "Mis Anuncios" contra la pizarra en vivo de Binance P2P
  const evaluateMyAdOnBoard = useCallback(
    (ad) => {
      if (!ad || !marketData) return null;
      const isBuyAd = ad.adv_type === 'COMPRA';
      const rawBoardAds = isBuyAd ? marketData?.sell?.ads || [] : marketData?.buy?.ads || [];
      if (rawBoardAds.length === 0) return null;

      // Filtrar la pizarra por los bancos del anuncio (si hay coincidencias en el muestreo)
      const adBanks = (ad.trade_methods || []).map((m) => String(m).toLowerCase());
      let boardAds = rawBoardAds;
      let matchedByBank = false;
      if (adBanks.length > 0) {
        const filteredByBank = rawBoardAds.filter((bAd) => {
          const bMethods = [...(bAd.pay_methods || []), ...(bAd.pay_identifiers || [])].map((m) =>
            String(m).toLowerCase()
          );
          return adBanks.some((ab) => bMethods.some((bm) => bm.includes(ab) || ab.includes(bm)));
        });
        if (filteredByBank.length > 0) {
          boardAds = filteredByBank;
          matchedByBank = true;
        }
      }

      const myPrice = Number(ad.price || 0);
      if (myPrice <= 0) return null;

      const exactIdx = boardAds.findIndex(
        (bAd) => bAd.adv_no && String(bAd.adv_no) === String(ad.adv_no)
      );

      // En Pizarra Vender (donde compite tu COMPRA) van primero los que pagan más (> myPrice).
      // En Pizarra Comprar (donde compite tu VENTA) van primero los que venden más barato (< myPrice).
      const aheadAds =
        exactIdx >= 0
          ? boardAds.slice(0, exactIdx)
          : boardAds.filter((bAd) =>
              isBuyAd ? Number(bAd.price) > myPrice : Number(bAd.price) < myPrice
            );

      const rank = exactIdx >= 0 ? exactIdx + 1 : aheadAds.length + 1;
      const aheadUsdt = aheadAds.reduce((s, bAd) => s + Number(bAd.available_qty || 0), 0);
      const bestBoardPrice = Number(boardAds[0]?.price || 0);
      const deltaVsBest = bestBoardPrice > 0 ? myPrice - bestBoardPrice : null;

      const suggestedRank1Price =
        bestBoardPrice > 0
          ? rank === 1
            ? myPrice
            : Number((isBuyAd ? bestBoardPrice + 0.01 : bestBoardPrice - 0.01).toFixed(2))
          : null;

      const isBelowBreakeven =
        !isBuyAd &&
        breakevenSellRate > 0 &&
        suggestedRank1Price != null &&
        suggestedRank1Price < breakevenSellRate;

      return {
        boardLabel: isBuyAd ? 'Pizarra Vender' : 'Pizarra Comprar',
        rank,
        aheadCount: aheadAds.length,
        aheadUsdt,
        bestBoardPrice,
        deltaVsBest,
        suggestedRank1Price,
        isBelowBreakeven,
        matchedByBank,
      };
    },
    [marketData, breakevenSellRate]
  );

  return {
    marketData,
    marketLoading,
    marketError,
    fetchMarketStats,
    evaluateMyAdOnBoard,
  };
}
