/**
 * Hook para procesar la serie temporal del mercado y calcular la geometría vectorial SVG
 */
import { useMemo } from 'react';
import { fmtTime } from '../utils/formatters';

export function useP2PChartGeometry({
  marketData,
  filteredStats,
  breakevenRate,
}) {
  const historySeries = useMemo(() => {
    const curBuy = Number(filteredStats?.buy?.activePrice || 0);
    const curSell = Number(filteredStats?.sell?.activePrice || 0);
    if (curBuy <= 0 && curSell <= 0) return [];

    const rawHistory = marketData?.history || [];
    const pts = [];

    rawHistory.forEach((h) => {
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
  }, [marketData?.history, filteredStats?.buy?.activePrice, filteredStats?.sell?.activePrice]);

  const chartGeometry = useMemo(() => {
    if (historySeries.length < 2) return null;
    const W = 540;
    const H = 142;
    const padLeft = 14;
    const padRight = 58;
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

  return {
    historySeries,
    chartGeometry,
  };
}
