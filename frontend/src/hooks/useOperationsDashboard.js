import { useState, useEffect, useCallback, useRef } from 'react';
import { operationsApi } from '../services/api';

/**
 * Hook para cargar, actualizar y gestionar el estado del dashboard de operaciones del día.
 */
export function useOperationsDashboard({
  selectedAsset = 'USDT',
  fiatCurrency = 'VES',
  refreshTrigger,
  onPairsDetected,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [bankFeePct, setBankFeePct] = useState(0.3);

  const hasDataRef = useRef(false);
  const isMountedRef = useRef(true);
  const onPairsDetectedRef = useRef(onPairsDetected);
  onPairsDetectedRef.current = onPairsDetected;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTodayDashboard = useCallback(
    async (options = {}) => {
      // Protegerse si se pasa directamente a un onClick y recibe el SyntheticEvent
      const isInitial = typeof options === 'boolean' ? options : Boolean(options?.isInitial);

      if (!hasDataRef.current || isInitial) {
        if (isMountedRef.current) setLoading(true);
      } else {
        if (isMountedRef.current) setRefreshing(true);
      }

      try {
        const queryParams = {
          only_today: true,
          bank_fee_pct: bankFeePct || 0,
        };
        if (selectedAsset !== 'ALL') queryParams.asset = selectedAsset;
        if (fiatCurrency !== 'ALL') queryParams.fiat_currency = fiatCurrency;

        const json = await operationsApi.getOperations(queryParams);

        if (isMountedRef.current) {
          setData(json);
          setError(null);
          hasDataRef.current = true;
        }

        if (json?.available_assets && onPairsDetectedRef.current) {
          onPairsDetectedRef.current(json.available_assets, json.available_fiats || ['VES']);
        }
      } catch (err) {
        console.error('Error cargando operaciones de hoy:', err);
        if (isMountedRef.current) {
          setError(err?.message || 'Error cargando operaciones');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedAsset, fiatCurrency, bankFeePct]
  );

  useEffect(() => {
    fetchTodayDashboard();
  }, [fetchTodayDashboard, refreshTrigger]);

  // Sincronizar automáticamente la tasa de comisión configurada en los ajustes de bancos sin disparar bucles
  useEffect(() => {
    const acc =
      data?.bank_inventory?.accounts?.find((a) => a.is_default) ||
      data?.bank_inventory?.accounts?.[0];
    if (acc?.pago_movil_fee_pct != null) {
      const parsedFee = Number(acc.pago_movil_fee_pct);
      setBankFeePct((prev) => (prev !== parsedFee ? parsedFee : prev));
    }
  }, [data?.bank_inventory?.accounts]);

  const handleSeedDemo = useCallback(async () => {
    try {
      await operationsApi.seedDemo();
      await fetchTodayDashboard(true);
    } catch (err) {
      console.error('Error al poblar demo:', err);
    }
  }, [fetchTodayDashboard]);

  const handleClearDemo = useCallback(async () => {
    try {
      await operationsApi.clearOperations(true);
      await fetchTodayDashboard(true);
    } catch (err) {
      console.error('Error al limpiar demo:', err);
    }
  }, [fetchTodayDashboard]);

  const updateBankInventory = useCallback((updatedInv) => {
    setData((prev) => (prev ? { ...prev, bank_inventory: updatedInv } : prev));
  }, []);

  return {
    data,
    loading,
    refreshing,
    error,
    bankFeePct,
    setBankFeePct,
    fetchTodayDashboard,
    handleSeedDemo,
    handleClearDemo,
    updateBankInventory,
  };
}
