import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  KeyRound,
  RefreshCw,
  FileText,
  Settings,
  CheckCircle2,
  Calculator,
  Radio,
  History,
  Building2,
  ChevronDown,
  Volume2,
  VolumeX,
} from 'lucide-react';
import OperationsDashboard from './components/OperationsDashboard';
import HistoryOperationsView from './components/HistoryOperationsView';
import TreasuryView from './components/TreasuryView';
import SettingsView from './components/SettingsView';
import BinanceApiModal from './components/BinanceApiModal';
import MarketPairModal from './components/MarketPairModal';
import { playNewTradeSound, playCompletedTradeSound } from './utils/audioAlerts';
import { fmtTime } from './utils/formatters';
import { healthApi, binanceApi } from './services/api';
import { Button, Badge, Logo } from './components/ui';

const ROUTE_TO_VIEW = {
  '/': 'DASHBOARD',
  '/dashboard': 'DASHBOARD',
  '/history': 'HISTORY',
  '/treasury': 'TREASURY',
  '/settings': 'SETTINGS',
};

const VIEW_TO_ROUTE = {
  DASHBOARD: '/dashboard',
  HISTORY: '/history',
  TREASURY: '/treasury',
  SETTINGS: '/settings',
};

const NAV_ITEMS = [
  {
    id: 'DASHBOARD',
    label: 'Operaciones',
    icon: Radio,
  },
  {
    id: 'HISTORY',
    label: 'Histórico',
    icon: History,
  },
  {
    id: 'TREASURY',
    label: 'Tesorería',
    icon: Building2,
  },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sincronizar ruta con activeView
  const currentPath = location.pathname.toLowerCase();
  const activeView = ROUTE_TO_VIEW[currentPath] || 'DASHBOARD';

  const setActiveView = useCallback(
    (view) => {
      const targetRoute = VIEW_TO_ROUTE[view] || '/dashboard';
      navigate(targetRoute);
    },
    [navigate]
  );

  const [settingsSection, setSettingsSection] = useState('CONNECTIONS');

  // Vistas visitadas para mantener el estado en memoria (Keep-Alive) sin re-cargas
  const [visitedViews, setVisitedViews] = useState(() => new Set(['DASHBOARD', activeView]));

  useEffect(() => {
    setVisitedViews((prev) => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);


  const [health, setHealth] = useState({
    status: 'checking',
    binance_api_configured: false,
    masked_api_key: '',
    stored_binance_orders: 0,
    last_synced_at: null,
  });
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(() => localStorage.getItem('user_selected_asset') || 'USDT');
  const [fiatCurrency, setFiatCurrency] = useState(() => localStorage.getItem('user_selected_fiat') || 'VES');
  const [availableAssets, setAvailableAssets] = useState(['USDT']);
  const [availableFiats, setAvailableFiats] = useState(['VES']);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSyncingBg, setIsSyncingBg] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncToast, setSyncToast] = useState(null);
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

  const openSettings = useCallback((section = 'CONNECTIONS') => {
    setSettingsSection(section);
    setActiveView('SETTINGS');
  }, []);

  const [hasActiveTrades, setHasActiveTrades] = useState(false);
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

  const formatSyncTime = (timeStr) => {
    if (!timeStr) return 'En línea';
    const clean = String(timeStr).trim();
    if (clean.includes(' ')) {
      const parts = clean.split(' ');
      return parts[1] ? parts[1].slice(0, 5) : clean;
    }
    if (clean.includes(':')) {
      return clean.slice(0, 5);
    }
    return clean;
  };

  const checkHealth = useCallback(async () => {
    try {
      const data = await healthApi.check();
      setHealth(data);

      const inProgress = data?.stored_in_progress_orders || 0;
      const totalStored = data?.stored_binance_orders || 0;

      // Disparador de alerta sonora: si entra una nueva orden abierta en proceso
      if (inProgress > prevInProgressCountRef.current) {
        playNewTradeSound();
      }
      // Si la cuenta total de órdenes creció o una orden abierta se completó
      else if (
        prevTotalOrdersRef.current !== null &&
        (totalStored > prevTotalOrdersRef.current || (prevInProgressCountRef.current > 0 && inProgress === 0))
      ) {
        playCompletedTradeSound();
      }

      prevInProgressCountRef.current = inProgress;
      prevTotalOrdersRef.current = totalStored;

      if (inProgress > 0) {
        setHasActiveTrades(true);
      } else {
        setHasActiveTrades(false);
      }
      return data;
    } catch {
      setHealth((prev) => ({ ...prev, status: 'offline' }));
      return null;
    }
  }, []);

  // Sincronización incremental estable
  const runIncrementalSync = useCallback(
    async (silent = false) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsSyncingBg(true);
      try {
        const data = await binanceApi.syncOrders({ force_full_90d: false });
        setSyncError(null);
        setRefreshTrigger((prev) => prev + 1);
        if (data.has_in_progress) {
          setHasActiveTrades(true);
        } else if (data.in_progress_count === 0) {
          setHasActiveTrades(false);
        }
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

  // 1. Al iniciar la aplicación: verificar estado y lanzar auto-sync inicial si hay API configurada
  useEffect(() => {
    checkHealth().then((data) => {
      if (data?.binance_api_configured && !initialAutoSyncDone.current) {
        initialAutoSyncDone.current = true;
        runIncrementalSync(true);
      }
    });
  }, [checkHealth, runIncrementalSync]);

  // 2. Polling inteligente adaptativo:
  // - Modo Ráfaga (Fast Polling cada 10s): Si hay órdenes activas en curso (IN_PROGRESS).
  // - Modo Normal / Reposo: Según el intervalo configurado por el usuario (por defecto 60s).
  useEffect(() => {
    if (!health.binance_api_configured || !syncIntervalSeconds || syncIntervalSeconds <= 0) return;

    // Si hay órdenes abiertas en curso, aceleramos a 10s para ver cambios en tiempo real
    const effectiveIntervalSeconds = hasActiveTrades ? Math.min(10, syncIntervalSeconds) : syncIntervalSeconds;

    const interval = setInterval(() => {
      // Pausar auto-sync si el navegador está en segundo plano para ahorrar peticiones a Binance
      if (typeof document !== 'undefined' && document.hidden) return;
      runIncrementalSync(true);
    }, effectiveIntervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [health.binance_api_configured, syncIntervalSeconds, hasActiveTrades, runIncrementalSync]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', appTheme);
      document.body.setAttribute('data-theme', appTheme);
    }
  }, [appTheme]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      appTheme === 'OLED_BLACK' ? 'bg-black text-slate-100' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Barra de Navegación Principal Optimizada para Desktop */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          {/* 1. Izquierda: Logo y Menú de Navegación Principal agrupados */}
          <div className="flex items-center gap-3.5 lg:gap-5 shrink-0">
            {/* Logo y Nombre en una sola línea */}
            <div
              onClick={() => setActiveView('DASHBOARD')}
              className="cursor-pointer group select-none"
              title="Ir a Operaciones"
            >
              <Logo size="sm" withText textClassName="group-hover:text-amber-300 transition-colors" />
            </div>

            {/* Separador vertical sutil entre Logo y Navegación */}
            <div className="h-4 w-px bg-slate-800" />

            {/* Pestañas de Navegación alineadas a la izquierda */}
            <nav
              aria-label="Navegación principal"
              className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35 font-semibold shadow-xs'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 2. Derecha: Selector de Par P2P, Estatus de Binance y Botón de Ajustes */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Selector de Par de Mercado (Cripto / Fiat) en la barra de navegación */}
            <button
              type="button"
              onClick={() => setIsPairModalOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-2.5 text-xs font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-850 hover:text-white transition-all shadow-xs cursor-pointer group"
              title="Cambiar Criptoactivo y Moneda Fiat de análisis"
            >
              <span className="font-mono font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                {selectedAsset}
              </span>
              <span className="text-slate-500">/</span>
              <span className="font-mono font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                {fiatCurrency}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-slate-200 transition-colors ml-0.5" />
            </button>

            {health.binance_api_configured ? (
              <button
                type="button"
                onClick={() => {
                  if (syncError) {
                    setIsApiModalOpen(true);
                  } else {
                    runIncrementalSync(false);
                    setRefreshTrigger((prev) => prev + 1);
                  }
                }}
                disabled={isSyncingBg && !syncError}
                title={
                  syncError
                    ? `Atención: ${syncError} · Clic para revisar credenciales`
                    : `Sistema conectado y en vivo${
                        health.last_synced_at ? ` · Último sync: ${fmtTime(health.last_synced_at, { timeFormat, showSeconds: timeShowSeconds })}` : ''
                      } · Clic para refrescar`
                }
                className={`group flex h-8 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all shadow-xs cursor-pointer select-none ${
                  syncError
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                    : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:bg-slate-850 hover:text-white'
                }`}
              >
                {/* Indicador de estado: Verde sereno constante. Solo pulsa/cambia a rojo si hay error */}
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                  {syncError ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  )}
                </span>

                {/* Texto estable: Ancho idéntico en operación normal */}
                <span
                  className={`font-semibold tracking-tight transition-colors ${
                    syncError
                      ? 'text-rose-300 font-bold'
                      : 'text-slate-200 group-hover:text-emerald-300'
                  }`}
                >
                  {syncError ? 'Revisar Conexión' : 'En Vivo'}
                </span>
              </button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={KeyRound}
                onClick={() => setIsApiModalOpen(true)}
                title="Conectar API Key de Binance para sincronización automática"
              >
                <span>Conectar Binance</span>
              </Button>
            )}

            {/* Botón de Sonido / Alertas de Audio */}
            <Button
              type="button"
              variant={soundEnabled ? 'emerald' : 'secondary'}
              size="icon"
              icon={soundEnabled ? Volume2 : VolumeX}
              onClick={() => {
                const nextState = !soundEnabled;
                setSoundEnabled(nextState);
                localStorage.setItem('p2p_sound_alerts_enabled', String(nextState));
                if (nextState) {
                  playCompletedTradeSound();
                  showToast('Alertas de audio activadas');
                } else {
                  showToast('Alertas de audio silenciadas');
                }
              }}
              title={soundEnabled ? 'Alertas sonoras activadas (clic para silenciar)' : 'Alertas sonoras silenciadas (clic para activar)'}
            />

            <Button
              type="button"
              variant={activeView === 'SETTINGS' ? 'primary' : 'secondary'}
              size="sm"
              icon={Settings}
              onClick={() => openSettings('CONNECTIONS')}
              title="Ajustes: Conexiones, Base de Datos y Sistema"
            >
              <span className="hidden sm:inline">Ajustes</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido Principal de las Vistas con Keep-Alive (Navegación Instantánea) */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        {visitedViews.has('DASHBOARD') && (
          <div className={activeView === 'DASHBOARD' ? 'contents' : 'hidden'}>
            <OperationsDashboard
              onOpenApiModal={() => setIsApiModalOpen(true)}
              apiConfigured={health.binance_api_configured}
              refreshTrigger={refreshTrigger}
              onNavigateHistory={() => setActiveView('HISTORY')}
              onNavigateSettings={(section = 'BANKS') => openSettings(section)}
              onManualSync={() => runIncrementalSync(false)}
              isSyncingBg={isSyncingBg}
              lastSyncedAt={health.last_synced_at}
              selectedAsset={selectedAsset}
              fiatCurrency={fiatCurrency}
              onPairsDetected={(assets, fiats) => {
                if (assets?.length) setAvailableAssets(assets);
                if (fiats?.length) setAvailableFiats(fiats);
              }}
            />
          </div>
        )}

        {visitedViews.has('HISTORY') && (
          <div className={activeView === 'HISTORY' ? 'contents' : 'hidden'}>
            <HistoryOperationsView
              refreshTrigger={refreshTrigger}
              onNavigateFormulas={() => openSettings('DOCS')}
              selectedAsset={selectedAsset}
              fiatCurrency={fiatCurrency}
              onPairsDetected={(assets, fiats) => {
                if (assets?.length) setAvailableAssets(assets);
                if (fiats?.length) setAvailableFiats(fiats);
              }}
            />
          </div>
        )}

        {visitedViews.has('TREASURY') && (
          <div className={activeView === 'TREASURY' ? 'contents' : 'hidden'}>
            <TreasuryView
              isActive={activeView === 'TREASURY'}
              refreshTrigger={refreshTrigger}
              onInventoryChange={() => {
                setRefreshTrigger((prev) => prev + 1);
              }}
            />
          </div>
        )}

        {visitedViews.has('SETTINGS') && (
          <div className={activeView === 'SETTINGS' ? 'contents' : 'hidden'}>
            <SettingsView
              initialSection={settingsSection}
              health={health}
              refreshTrigger={refreshTrigger}
              syncIntervalSeconds={syncIntervalSeconds}
              onUpdateSyncInterval={(val) => {
                setSyncIntervalSeconds(val);
                localStorage.setItem('binance_sync_interval_seconds', String(val));
              }}
              soundEnabled={soundEnabled}
              onToggleSound={(val) => {
                setSoundEnabled(val);
                localStorage.setItem('p2p_sound_alerts_enabled', String(val));
              }}
              soundNewOrderEnabled={soundNewOrderEnabled}
              onToggleSoundNewOrder={(val) => {
                setSoundNewOrderEnabled(val);
                localStorage.setItem('p2p_sound_new_order_enabled', String(val));
              }}
              soundCompletedOrderEnabled={soundCompletedOrderEnabled}
              onToggleSoundCompletedOrder={(val) => {
                setSoundCompletedOrderEnabled(val);
                localStorage.setItem('p2p_sound_completed_order_enabled', String(val));
              }}
              toastsEnabled={toastsEnabled}
              onToggleToasts={(val) => {
                setToastsEnabled(val);
                localStorage.setItem('p2p_toasts_enabled', String(val));
              }}
              appTheme={appTheme}
              onUpdateAppTheme={(val) => {
                setAppTheme(val);
                localStorage.setItem('p2p_app_theme', val);
              }}
              timeFormat={timeFormat}
              onUpdateTimeFormat={(val) => {
                setTimeFormat(val);
                localStorage.setItem('p2p_time_format', val);
              }}
              timeShowSeconds={timeShowSeconds}
              onToggleTimeShowSeconds={(val) => {
                setTimeShowSeconds(val);
                localStorage.setItem('p2p_time_show_seconds', String(val));
              }}
              onSyncComplete={() => {
                setRefreshTrigger((prev) => prev + 1);
                checkHealth();
              }}
              onReturnDashboard={() => setActiveView('DASHBOARD')}
              onNavigateTreasury={() => setActiveView('TREASURY')}
            />
          </div>
        )}
      </main>

      {/* Notificación Toast Flotante */}
      {syncToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-emerald-300 shadow-xl shadow-slate-950/80 backdrop-blur-md">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Modal de Configuración de API Binance */}
      <BinanceApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiConfigured={health.binance_api_configured}
        maskedKey={health.masked_api_key}
        onSyncComplete={() => {
          setRefreshTrigger((prev) => prev + 1);
          checkHealth();
        }}
      />

      {/* Modal Selector de Par de Mercado (Cripto / Fiat) */}
      <MarketPairModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        selectedAsset={selectedAsset}
        selectedFiat={fiatCurrency}
        availableAssets={availableAssets}
        availableFiats={availableFiats}
        onSelectPair={(newAsset, newFiat) => {
          setSelectedAsset(newAsset);
          setFiatCurrency(newFiat);
          localStorage.setItem('user_selected_asset', newAsset);
          localStorage.setItem('user_selected_fiat', newFiat);
        }}
      />
    </div>
  );
}
