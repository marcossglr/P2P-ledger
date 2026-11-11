/**
 * Hook para procesar la serie temporal del mercado y calcular la geometría vectorial SVG
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { fmtTime } from '../utils/formatters';

const DEFAULT_CHART_DIMENSIONS = {
  width: 540,
  height: 142,
  padLeft: 14,
  padRight: 58,
  padY: 16,
};

const MAX_HISTORY_POINTS = 30;

function formatHistoryLabel(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '—';
  if (timeStr.includes('T') || timeStr.includes(' ')) {
    const parts = timeStr.split(/[T ]/);
    if (parts[1]) {
      return parts[1].slice(0, 5);
    }
  }
  return timeStr.slice(0, 5) || '—';
}

export function useP2PChartGeometry({
  marketData,
  filteredStats,
  breakevenRate,
  filterKey = '',
  dimensions = DEFAULT_CHART_DIMENSIONS,
}) {
  const {
    width: W = 540,
    height: H = 142,
    padLeft = 14,
    padRight = 58,
    padY = 16,
  } = dimensions;

  // Buffer acumulativo de puntos en la sesión del cliente
  const [sessionPoints, setSessionPoints] = useState([]);
  const lastRecordedKeyRef = useRef(null);
  const prevFilterKeyRef = useRef(filterKey);

  // Resetear la memoria del diagrama cuando el usuario cambia cualquier filtro de mercado
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setSessionPoints([]);
      lastRecordedKeyRef.current = null;
    }
  }, [filterKey]);

  const curBuy = Number(filteredStats?.buy?.activePrice || 0);
  const curSell = Number(filteredStats?.sell?.activePrice || 0);
  const fetchedAt = marketData?.fetched_at || null;

  // Registrar cada nuevo tick de mercado en el buffer histórico
  useEffect(() => {
    if (curBuy <= 0 && curSell <= 0) return;

    const tickTime = fetchedAt || new Date().toISOString();
    const tickKey = `${tickTime}_${curBuy.toFixed(4)}_${curSell.toFixed(4)}`;

    if (lastRecordedKeyRef.current === tickKey) {
      return;
    }
    lastRecordedKeyRef.current = tickKey;

    const now = new Date();
    const timeLabel = fmtTime(now);

    setSessionPoints((prev) => {
      const newPoint = {
        label: timeLabel,
        fullTime: timeLabel,
        isoTime: tickTime,
        buy_val: curBuy,
        sell_val: curSell,
      };

      if (prev.length === 0) {
        return [newPoint];
      }

      // Si ya tenemos puntos, mantener los últimos MAX_HISTORY_POINTS
      const updated = [...prev, newPoint];
      return updated.slice(-MAX_HISTORY_POINTS);
    });
  }, [curBuy, curSell, fetchedAt]);

  // Si cambia drásticamente el par o no hay puntos suficientes, integrar rawHistory si viniera del backend
  const historySeries = useMemo(() => {
    if (curBuy <= 0 && curSell <= 0) return [];

    const nowTime = fmtTime(new Date());

    // 1. Si el backend envía historial explícito, usarlo como base preferente
    const rawHistory = marketData?.history || [];
    if (rawHistory.length >= 2) {
      const pts = [];
      rawHistory.forEach((h) => {
        const bVal = h.buy_best ?? h.buy_top_avg;
        const sVal = h.sell_best ?? h.sell_top_avg;
        if (bVal != null && sVal != null) {
          pts.push({
            label: formatHistoryLabel(h.time),
            fullTime: h.time || '—',
            buy_val: Number(bVal),
            sell_val: Number(sVal),
          });
        }
      });
      if (pts.length >= 2) {
        const sliced = pts.slice(-MAX_HISTORY_POINTS);
        const lastItem = sliced[sliced.length - 1];
        sliced[sliced.length - 1] = {
          ...lastItem,
          label: 'Ahora',
          fullTime: nowTime,
          buy_val: curBuy > 0 ? curBuy : lastItem.buy_val,
          sell_val: curSell > 0 ? curSell : lastItem.sell_val,
        };
        return sliced;
      }
    }

    // 2. Usar los puntos acumulados en la sesión del cliente
    if (sessionPoints.length >= 2) {
      const sliced = [...sessionPoints];
      const lastIdx = sliced.length - 1;
      sliced[lastIdx] = {
        ...sliced[lastIdx],
        label: 'Ahora',
        fullTime: nowTime,
        buy_val: curBuy > 0 ? curBuy : sliced[lastIdx].buy_val,
        sell_val: curSell > 0 ? curSell : sliced[lastIdx].sell_val,
      };
      return sliced;
    }

    if (sessionPoints.length === 1) {
      return [
        {
          ...sessionPoints[0],
          label: sessionPoints[0].label || nowTime,
        },
        {
          label: 'Ahora',
          fullTime: nowTime,
          buy_val: curBuy > 0 ? curBuy : sessionPoints[0].buy_val,
          sell_val: curSell > 0 ? curSell : sessionPoints[0].sell_val,
        },
      ];
    }

    // Fallback inicial mínimo
    return [
      {
        label: nowTime,
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
  }, [marketData?.history, sessionPoints, curBuy, curSell]);

  const chartGeometry = useMemo(() => {
    if (historySeries.length < 2) return null;

    const allPrices = [];
    historySeries.forEach((p) => {
      if (Number.isFinite(p.buy_val) && p.buy_val > 0) allPrices.push(Number(p.buy_val));
      if (Number.isFinite(p.sell_val) && p.sell_val > 0) allPrices.push(Number(p.sell_val));
    });

    if (allPrices.length === 0) return null;

    let minVal = Math.min(...allPrices);
    let maxVal = Math.max(...allPrices);
    let rawRange = maxVal - minVal;

    // Headroom dinámico del 15% sobre el spread o margen mínimo sensible para amplificar micro-fluctuaciones
    const padding = Math.max(0.04, rawRange * 0.15);
    const domainMin = Math.max(0, minVal - padding);
    const domainMax = maxVal + padding;
    const domainRange = Math.max(0.05, domainMax - domainMin);

    const usableWidth = Math.max(10, W - padLeft - padRight);
    const usableHeight = Math.max(10, H - padY * 2);

    const toX = (i) =>
      padLeft + (i / Math.max(1, historySeries.length - 1)) * usableWidth;

    const toY = (val) => {
      const num = Number(val);
      if (!Number.isFinite(num)) return H - padY;
      return H - padY - ((num - domainMin) / domainRange) * usableHeight;
    };

    const buyPts = historySeries.map((p, i) => ({
      x: toX(i),
      y: toY(p.buy_val || domainMin),
      val: Number(p.buy_val || 0),
      label: p.label,
      fullTime: p.fullTime,
    }));

    const sellPts = historySeries.map((p, i) => ({
      x: toX(i),
      y: toY(p.sell_val || domainMin),
      val: Number(p.sell_val || 0),
      label: p.label,
      fullTime: p.fullTime,
    }));

    const buildLinePath = (pts) =>
      pts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

    const buyPath = buildLinePath(buyPts);
    const sellPath = buildLinePath(sellPts);

    const bottomY = H - padY;

    const buildAreaPath = (pts) => {
      if (pts.length === 0) return '';
      return [
        buildLinePath(pts),
        `L${pts[pts.length - 1].x.toFixed(1)},${bottomY}`,
        `L${pts[0].x.toFixed(1)},${bottomY}`,
        'Z',
      ].join(' ');
    };

    const buyAreaPath = buildAreaPath(buyPts);
    const sellAreaPath = buildAreaPath(sellPts);

    const spreadAreaPath =
      buyPts.length > 0 && sellPts.length > 0
        ? [
            buildLinePath(buyPts),
            ...[...sellPts].reverse().map((pt) => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`),
            'Z',
          ].join(' ')
        : '';

    const breakevenNum = breakevenRate != null ? Number(breakevenRate) : null;
    const isBreakevenValid =
      breakevenNum !== null &&
      Number.isFinite(breakevenNum) &&
      breakevenNum > 0 &&
      breakevenNum >= domainMin - domainRange * 0.1 &&
      breakevenNum <= domainMax + domainRange * 0.1;

    const breakevenY = isBreakevenValid ? toY(breakevenNum) : null;

    // Calcular variación respecto al punto previo (Tick Delta)
    let buyDelta = 0;
    let sellDelta = 0;
    if (buyPts.length >= 2) {
      buyDelta = buyPts[buyPts.length - 1].val - buyPts[buyPts.length - 2].val;
    }
    if (sellPts.length >= 2) {
      sellDelta = sellPts[sellPts.length - 1].val - sellPts[sellPts.length - 2].val;
    }

    return {
      W,
      H,
      minVal,
      maxVal,
      domainMin,
      domainMax,
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
      buyDelta,
      sellDelta,
      pointsCount: historySeries.length,
    };
  }, [historySeries, breakevenRate, W, H, padLeft, padRight, padY]);

  return {
    historySeries,
    chartGeometry,
  };
}
