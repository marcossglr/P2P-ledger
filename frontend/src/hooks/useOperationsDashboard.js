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
  const [bankFeePct, setBankFeePct] = useState(0.3);
  const hasDataRef = useRef(false);

  const fetchTodayDashboard = useCallback(
    async (isInitial = false) => {
      if (isInitial || !hasDataRef.current) {
        setLoading(true);
      }
      try {
        const queryParams = {
          only_today: true,
          bank_fee_pct: bankFeePct || 0,
        };
        if (selectedAsset !== 'ALL') queryParams.asset = selectedAsset;
        if (fiatCurrency !== 'ALL') queryParams.fiat_currency = fiatCurrency;

        const json = await operationsApi.getOperations(queryParams);
        setData(json);
        hasDataRef.current = true;

        if (json?.available_assets && onPairsDetected) {
          onPairsDetected(json.available_assets, json.available_fiats || ['VES']);
        }
      } catch (err) {
        console.error('Error cargando operaciones de hoy:', err);
      } finally {
        setLoading(false);
      }
    },
    [selectedAsset, fiatCurrency, bankFeePct, onPairsDetected]
  );

  useEffect(() => {
    fetchTodayDashboard();
  }, [selectedAsset, fiatCurrency, bankFeePct, refreshTrigger]);

  // Sincronizar automáticamente la tasa de comisión configurada en los ajustes de bancos
  useEffect(() => {
    const acc =
      data?.bank_inventory?.accounts?.find((a) => a.is_default) ||
      data?.bank_inventory?.accounts?.[0];
    if (acc?.pago_movil_fee_pct != null && Number(acc.pago_movil_fee_pct) !== bankFeePct) {
      setBankFeePct(Number(acc.pago_movil_fee_pct));
    }
  }, [data, bankFeePct]);

  const handleSeedDemo = async () => {
    await operationsApi.seedDemo();
    fetchTodayDashboard();
  };

  const handleClearDemo = async () => {
    await operationsApi.clearOperations(true);
    fetchTodayDashboard();
  };

  const updateBankInventory = (updatedInv) => {
    setData((prev) => (prev ? { ...prev, bank_inventory: updatedInv } : prev));
  };

  return {
    data,
    loading,
    bankFeePct,
    setBankFeePct,
    fetchTodayDashboard,
    handleSeedDemo,
    handleClearDemo,
    updateBankInventory,
  };
}
