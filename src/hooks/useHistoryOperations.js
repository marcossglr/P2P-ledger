import { useState, useEffect, useCallback, useRef } from 'react';
import { operationsApi } from '../services/api';

/**
 * Hook para gestionar el estado, filtros, sincronización y carga de datos del histórico de operaciones.
 */
export function useHistoryOperations({
  selectedAsset = 'USDT',
  fiatCurrency = 'VES',
  refreshTrigger,
  onPairsDetected,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtros de consulta histórica
  const [orderType, setOrderType] = useState('ALL');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [activePreset, setActivePreset] = useState('TODAY');

  // Inicializar con la fecha local del navegador para evitar desfase de huso horario
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  });
  const [bankFeePct, setBankFeePct] = useState(0.3);

  const isMountedRef = useRef(true);
  const onPairsDetectedRef = useRef(onPairsDetected);
  onPairsDetectedRef.current = onPairsDetected;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchHistory = useCallback(async (isInitial = false) => {
    if (isInitial || !data) {
      if (isMountedRef.current) setLoading(true);
    }
    try {
      const filters = {
        only_today: false,
        bank_fee_pct: bankFeePct || 0,
      };
      if (orderType !== 'ALL') filters.order_type = orderType;
      if (orderStatus !== 'ALL') filters.order_status = orderStatus;
      if (selectedAsset !== 'ALL') filters.asset = selectedAsset;
      if (fiatCurrency) filters.fiat_currency = fiatCurrency;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const json = await operationsApi.getOperations(filters);
      if (isMountedRef.current) {
        setData(json);
      }

      if (json?.available_assets && onPairsDetectedRef.current) {
        onPairsDetectedRef.current(json.available_assets, json.available_fiats || ['VES']);
      }
    } catch (err) {
      console.error('Error cargando histórico de operaciones:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [data, orderType, orderStatus, selectedAsset, fiatCurrency, startDate, endDate, bankFeePct]);

  useEffect(() => {
    fetchHistory();
  }, [orderType, orderStatus, selectedAsset, fiatCurrency, startDate, endDate, bankFeePct, refreshTrigger]);

  // Sincronizar automáticamente la tasa de comisión bancaria configurada en los ajustes de bancos
  useEffect(() => {
    const acc =
      data?.bank_inventory?.accounts?.find((a) => a.is_default) ||
      data?.bank_inventory?.accounts?.[0];
    if (acc?.pago_movil_fee_pct != null && Number(acc.pago_movil_fee_pct) !== bankFeePct) {
      setBankFeePct(Number(acc.pago_movil_fee_pct));
    }
  }, [data, bankFeePct]);

  const applyDatePreset = (preset) => {
    setActivePreset(preset);
    const baseStr = data?.server_today || new Date().toISOString().slice(0, 10);
    const [y, m, d] = baseStr.split('-').map(Number);
    const todayObj = new Date(y, m - 1, d);

    const fmt = (dt) => {
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const s = fmt(todayObj);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'CUSTOM') {
      if (!startDate) setStartDate(fmt(todayObj));
      if (!endDate) setEndDate(fmt(todayObj));
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(todayObj);
      yest.setDate(yest.getDate() - 1);
      const s = fmt(yest);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 7);
      setStartDate(fmt(from));
      setEndDate(fmt(todayObj));
    } else if (preset === '30D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 30);
      setStartDate(fmt(from));
      setEndDate(fmt(todayObj));
    } else if (preset === '90D') {
      const from = new Date(todayObj);
      from.setDate(from.getDate() - 90);
      setStartDate(fmt(from));
      setEndDate(fmt(todayObj));
    } else if (preset === 'MONTH') {
      const firstDay = new Date(y, m - 1, 1);
      setStartDate(fmt(firstDay));
      setEndDate(fmt(todayObj));
    }
  };

  const handleExportExcel = () => {
    const filters = {
      only_today: false,
      bank_fee_pct: bankFeePct || 0,
    };
    if (orderType !== 'ALL') filters.order_type = orderType;
    if (orderStatus !== 'ALL') filters.order_status = orderStatus;
    if (fiatCurrency !== 'ALL') filters.fiat_currency = fiatCurrency;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    window.open(operationsApi.getExportUrl(filters), '_blank', 'noopener,noreferrer');
  };

  return {
    data,
    loading,
    orderType,
    setOrderType,
    orderStatus,
    setOrderStatus,
    activePreset,
    setActivePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    bankFeePct,
    setBankFeePct,
    applyDatePreset,
    handleExportExcel,
    refetch: fetchHistory,
  };
}
