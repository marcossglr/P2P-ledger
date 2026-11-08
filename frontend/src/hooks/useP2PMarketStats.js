/**
 * Hook para procesar y filtrar anuncios P2P en memoria y calcular estadísticas de tasas (Best, Top 5, Top 10, Weighted y Spread).
 */
import { useMemo } from 'react';
import { parseSmartAmount } from '../utils/formatters';

export function useP2PMarketStats({
  marketData,
  selectedBank = 'ALL',
  amountFilter = '',
  onlyMerchants = false,
  priceMode = 'BEST',
  binancePayMethods = [],
}) {
  const allBuyAds = useMemo(() => marketData?.buy?.ads || [], [marketData]);
  const allSellAds = useMemo(() => marketData?.sell?.ads || [], [marketData]);

  // Bancos disponibles de toda la data del mercado con sus conteos reales
  const availableBanks = useMemo(() => {
    if (marketData?.available_pay_methods?.length > 0) {
      return marketData.available_pay_methods;
    }
    const counts = new Map();
    [...allBuyAds, ...allSellAds].forEach((ad) => {
      [...(ad.pay_methods || []), ...(ad.pay_identifiers || [])].forEach((m) => {
        const norm = String(m).toLowerCase();
        counts.set(norm, (counts.get(norm) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [marketData, allBuyAds, allSellAds]);

  // Filtrado de anuncios según los criterios activos
  const filterSideAds = useMemo(() => {
    const targetAmt = parseSmartAmount(amountFilter);
    const bankNorm = selectedBank !== 'ALL' ? selectedBank.toLowerCase() : null;

    // Buscar si el método seleccionado coincide con algún método oficial de Binance
    const selectedMethodObj = bankNorm
      ? binancePayMethods.find(
          (m) =>
            m.identifier?.toLowerCase() === bankNorm ||
            m.name?.toLowerCase() === bankNorm ||
            (m.short_name && m.short_name.toLowerCase() === bankNorm)
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

        const directMatch = methods.some(
          (m) => m.includes(bankNorm) || bankNorm.includes(m)
        );

        let binanceMatch = false;
        if (!directMatch && selectedMethodObj) {
          const idNorm = selectedMethodObj.identifier?.toLowerCase();
          const nameNorm = selectedMethodObj.name?.toLowerCase();
          const shortNorm = selectedMethodObj.short_name?.toLowerCase();
          binanceMatch = methods.some(
            (m) =>
              (idNorm && (m.includes(idNorm) || idNorm.includes(m))) ||
              (nameNorm && (m.includes(nameNorm) || nameNorm.includes(m))) ||
              (shortNorm && (m.includes(shortNorm) || shortNorm.includes(m)))
          );
        }

        const serverFilteredBank = marketData?.filters?.pay_types?.length > 0;

        if (!directMatch && !binanceMatch && !serverFilteredBank) {
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

    return {
      buy: buyFiltered.length > 0 || !selectedBank || selectedBank === 'ALL' ? buyFiltered : allBuyAds,
      sell: sellFiltered.length > 0 || !selectedBank || selectedBank === 'ALL' ? sellFiltered : allSellAds,
    };
  }, [allBuyAds, allSellAds, selectedBank, amountFilter, onlyMerchants, binancePayMethods, marketData]);

  // Estadísticas calculadas sobre los anuncios filtrados
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

  return {
    allBuyAds,
    allSellAds,
    availableBanks,
    filterSideAds,
    filteredStats,
  };
}
