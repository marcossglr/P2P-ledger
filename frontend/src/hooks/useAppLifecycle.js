import { useState, useEffect, useCallback, useRef } from 'react';
import { healthApi, binanceApi } from '../services/api';
import { playNewTradeSound, playCompletedTradeSound } from '../utils/audioAlerts';

export function useAppLifecycle() {
  const [health, setHealth] = useState({
    status: 'checking',
    binance_api_configured: false,
    masked_api_key: '',
    stored_binance_orders: 0,
    last_synced_at: null,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSyncingBg, setIsSyncingBg] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncToast, setSyncToast] = useState(null);
  const [hasActiveTrades, setHasActiveTrades] = useState(false);

  // Configuraciones persistidas
  const [syncIntervalSeconds, setSyncIntervalSeconds] = useState(() => {
    const saved = localStorage.getItem('binance_sync_interval_seconds');
    return saved !== null ? parseInt(saved, 10) : 60;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('p2p_sound_alerts_enabled') !== 'false';
  });

  const [soundNewOrderEnabled, setSoundNewOrderEnabled] = useState(() => {
    return localStorage.getItem('p2p_sound_new_order_enabled') !== 'false';
  });

  const [soundCompletedOrderEnabled, setSoundCompletedOrderEnabled] = useState(() => {
    return localStorage.getItem('p2p_sound_completed_order_enabled') !== 'false';
  });

  const [toastsEnabled, setToastsEnabled] = useState(() => {
    return localStorage.getItem('p2p_toasts_enabled') !== 'false';
  });

  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem('p2p_app_theme') || 'DEEP_SLATE';
  });

  const [timeFormat, setTimeFormat] = useState(() => {
    return localStorage.getItem('p2p_time_format') === '12H' ? '12H' : '24H';
  });

  const [timeShowSeconds, setTimeShowSeconds] = useState(() => {
    return localStorage.getItem('p2p_time_show_seconds') === 'true';
  });

  const prevInProgressCountRef = useRef(0);
  const prevTotalOrdersRef = useRef(null);
  const initialAutoSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    const isToastsActive = localStorage.getItem('p2p_toasts_enabled') !== 'false';
    if (!isToastsActive) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSyncToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setSyncToast(null);
    }, 4000);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const data = await healthApi.check();
      setHealth(data);

      const inProgress = data?.stored_in_progress_orders || 0;
      const totalStored = data?.stored_binance_orders || 0;

      // Alerta sonora para órdenes entrantes
      if (inProgress > prevInProgressCountRef.current) {
        playNewTradeSound();
      } else if (
        prevTotalOrdersRef.current !== null &&
        (totalStored > prevTotalOrdersRef.current || (prevInProgressCountRef.current > 0 && inProgress === 0))
      ) {
        playCompletedTradeSound();
      }

      prevInProgressCountRef.current = inProgress;
      prevTotalOrdersRef.current = totalStored;
      setHasActiveTrades(inProgress > 0);
      return data;
    } catch {
      setHealth((prev) => ({ ...prev, status: 'offline' }));
      return null;
    }
  }, []);

  const runIncrementalSync = useCallback(
    async (silent = false) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsSyncingBg(true);
      try {
        const data = await binanceApi.syncOrders({ force_full_90d: false });
        setSyncError(null);
        setRefreshTrigger((prev) => prev + 1);
        setHasActiveTrades(Boolean(data.has_in_progress));
        await checkHealth();
        if (!silent || data.new_orders > 0) {
          showToast(
            data.new_orders > 0
              ? `+${data.new_orders} nuevas órdenes sincronizadas`
              : 'Al día con Binance P2P'
          );
        }
      } catch (err) {
        console.error('Error en sincronización incremental:', err);
        setSyncError(err.message || 'Error de conexión');
      } finally {
        isSyncingRef.current = false;
        setIsSyncingBg(false);
      }
    },
    [checkHealth, showToast]
  );

  // Auto-sync al inicio si la API está configurada
  useEffect(() => {
    checkHealth().then((data) => {
      if (data?.binance_api_configured && !initialAutoSyncDone.current) {
        initialAutoSyncDone.current = true;
        runIncrementalSync(true);
      }
    });
  }, [checkHealth, runIncrementalSync]);

  // Polling inteligente adaptativo
  useEffect(() => {
    if (!health.binance_api_configured || !syncIntervalSeconds || syncIntervalSeconds <= 0) return;
    const effectiveIntervalSeconds = hasActiveTrades ? Math.min(10, syncIntervalSeconds) : syncIntervalSeconds;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      runIncrementalSync(true);
    }, effectiveIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [health.binance_api_configured, syncIntervalSeconds, hasActiveTrades, runIncrementalSync]);

  // Sincronización de tema en el DOM
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', appTheme);
      document.body.setAttribute('data-theme', appTheme);
    }
  }, [appTheme]);

  return {
    health,
    checkHealth,
    refreshTrigger,
    setRefreshTrigger,
    isSyncingBg,
    syncError,
    syncToast,
    showToast,
    runIncrementalSync,
    syncIntervalSeconds,
    setSyncIntervalSeconds,
    soundEnabled,
    setSoundEnabled,
    soundNewOrderEnabled,
    setSoundNewOrderEnabled,
    soundCompletedOrderEnabled,
    setSoundCompletedOrderEnabled,
    toastsEnabled,
    setToastsEnabled,
    appTheme,
    setAppTheme,
    timeFormat,
    setTimeFormat,
    timeShowSeconds,
    setTimeShowSeconds,
  };
}
