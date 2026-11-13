import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Radio,
  History,
  Building2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import OperationsDashboard from './components/views/OperationsDashboard';
import AppHeader from './components/layout/AppHeader';
import OnboardingBanner from './components/layout/OnboardingBanner';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { playCompletedTradeSound } from './utils/audioAlerts';

// Carga diferida (code-splitting) de vistas secundarias y modales de configuración
const HistoryOperationsView = lazy(() => import('./components/views/HistoryOperationsView'));
const TreasuryView = lazy(() => import('./components/views/TreasuryView'));
const SettingsView = lazy(() => import('./components/views/SettingsView'));
const BinanceApiModal = lazy(() => import('./components/modals/BinanceApiModal'));

function ViewFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center gap-2 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-amber-500/70" />
      <span className="font-mono text-xs uppercase tracking-wider">Cargando módulo...</span>
    </div>
  );
}

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
  { id: 'DASHBOARD', label: 'Operaciones', icon: Radio },
  { id: 'HISTORY', label: 'Histórico', icon: History },
  { id: 'TREASURY', label: 'Tesorería', icon: Building2 },
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
  const [visitedViews, setVisitedViews] = useState(() => new Set(['DASHBOARD', activeView]));
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(() => localStorage.getItem('user_selected_asset') || 'USDT');
  const [fiatCurrency, setFiatCurrency] = useState(() => localStorage.getItem('user_selected_fiat') || 'VES');
  const [availableAssets, setAvailableAssets] = useState(['USDT']);
  const [, setAvailableFiats] = useState(['VES']);

  const {
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
  } = useAppLifecycle();

  useEffect(() => {
    setVisitedViews((prev) => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);

  const openSettings = useCallback((section = 'CONNECTIONS') => {
    setSettingsSection(section);
    setActiveView('SETTINGS');
  }, [setActiveView]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      appTheme === 'OLED_BLACK' ? 'bg-black text-slate-100' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Header Modularizado */}
      <AppHeader
        navItems={NAV_ITEMS}
        activeView={activeView}
        onSelectView={setActiveView}
        health={health}
        syncError={syncError}
        isSyncingBg={isSyncingBg}
        onTriggerSync={() => {
          if (syncError) {
            setIsApiModalOpen(true);
          } else {
            runIncrementalSync(false);
            setRefreshTrigger((prev) => prev + 1);
          }
        }}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          localStorage.setItem('p2p_sound_alerts_enabled', String(next));
          if (next) {
            playCompletedTradeSound();
            showToast('Alertas de audio activadas');
          } else {
            showToast('Alertas de audio silenciadas');
          }
        }}
        onOpenSettings={openSettings}
        timeFormat={timeFormat}
        timeShowSeconds={timeShowSeconds}
      />

      {/* Contenido Principal con Keep-Alive */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        {/* Banner global de entorno: Onboarding inicial o Alerta/Depuración de Operaciones Demo */}
        <OnboardingBanner
          apiConfigured={health?.binance_api_configured}
          demoCount={Number(health?.stored_demo_orders || 0)}
          storedOrders={Number(health?.stored_orders || 0)}
          onOpenApiModal={() => setIsApiModalOpen(true)}
          onStateChanged={() => {
            checkHealth();
            setRefreshTrigger((prev) => prev + 1);
          }}
        />

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
            <Suspense fallback={<ViewFallback />}>
              <HistoryOperationsView
                refreshTrigger={refreshTrigger}
                onNavigateFormulas={() => openSettings('DOCS')}
                selectedAsset={selectedAsset}
                onSelectAsset={(asset) => {
                  setSelectedAsset(asset);
                  localStorage.setItem('user_selected_asset', asset);
                }}
                availableAssets={availableAssets}
                fiatCurrency={fiatCurrency}
                onPairsDetected={(assets, fiats) => {
                  if (assets?.length) setAvailableAssets(assets);
                  if (fiats?.length) setAvailableFiats(fiats);
                }}
              />
            </Suspense>
          </div>
        )}

        {visitedViews.has('TREASURY') && (
          <div className={activeView === 'TREASURY' ? 'contents' : 'hidden'}>
            <Suspense fallback={<ViewFallback />}>
              <TreasuryView
                isActive={activeView === 'TREASURY'}
                refreshTrigger={refreshTrigger}
                onInventoryChange={() => setRefreshTrigger((prev) => prev + 1)}
              />
            </Suspense>
          </div>
        )}

        {visitedViews.has('SETTINGS') && (
          <div className={activeView === 'SETTINGS' ? 'contents' : 'hidden'}>
            <Suspense fallback={<ViewFallback />}>
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
            </Suspense>
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
      {isApiModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </div>
  );
}
