import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  KeyRound,
  RefreshCw,
  FileText,
  Settings,
  CheckCircle2,
  Calculator,
  Radio,
  History,
} from 'lucide-react';
import OperationsDashboard from './components/OperationsDashboard';
import HistoryOperationsView from './components/HistoryOperationsView';
import BankReconcilerView from './components/BankReconcilerView';
import SettingsView from './components/SettingsView';
import BinanceApiModal from './components/BinanceApiModal';

const NAV_ITEMS = [
  {
    id: 'DASHBOARD',
    label: 'Operaciones de Hoy',
    icon: Radio,
  },
  {
    id: 'HISTORY',
    label: 'Histórico',
    icon: History,
  },
  {
    id: 'RECONCILER',
    label: 'Conciliador PDF',
    icon: FileText,
  },
];

export default function App() {
  const [activeView, setActiveView] = useState('DASHBOARD');
  const [settingsSection, setSettingsSection] = useState('BANKS');

  // Vistas visitadas para mantener el estado en memoria (Keep-Alive) sin re-cargas
  const [visitedViews, setVisitedViews] = useState(() => new Set(['DASHBOARD']));

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSyncingBg, setIsSyncingBg] = useState(false);
  const [syncToast, setSyncToast] = useState(null);

  const openSettings = useCallback((section = 'BANKS') => {
    setSettingsSection(section);
    setActiveView('SETTINGS');
  }, []);

  const initialAutoSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
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
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHealth(data);
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
        const res = await fetch('/api/binance/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force_full_90d: false }),
        });
        const data = await res.json();
        if (res.ok) {
          setRefreshTrigger((prev) => prev + 1);
          await checkHealth();
          if (!silent || data.new_orders > 0) {
            showToast(
              data.new_orders > 0
                ? `+${data.new_orders} nuevas órdenes sincronizadas`
                : 'Al día con Binance P2P'
            );
          }
        }
      } catch (err) {
        console.error('Error en sincronización incremental:', err);
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

  // 2. Polling automático cada 60 segundos mientras la API esté configurada
  useEffect(() => {
    if (!health.binance_api_configured) return;
    const interval = setInterval(() => {
      runIncrementalSync(true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [health.binance_api_configured, runIncrementalSync]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Barra de Navegación Principal Contenida en max-w-7xl */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3 sm:px-6">
          {/* 1. Izquierda: Logo y Nombre de la Aplicación */}
          <div className="order-1 flex items-center gap-3 shrink-0">
            <div
              onClick={() => setActiveView('DASHBOARD')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20 hover:brightness-110 transition-all"
              title="Ir a Operaciones de Hoy"
            >
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white whitespace-nowrap leading-none">
                P2P Ledger
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 leading-tight mt-1">
                Operaciones Binance P2P
              </p>
            </div>
          </div>

          {/* 2. Centro (en Desktop) / Fila inferior completa (en pantallas < lg): Pestañas de Navegación */}
          <nav
            aria-label="Navegación principal"
            className="order-3 lg:order-2 flex w-full lg:w-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2 items-center justify-start sm:justify-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-slate-800 bg-slate-900/90 p-1"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
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

          {/* 3. Derecha: Indicador de Estatus de Binance y Botón de Ajustes */}
          <div className="order-2 lg:order-3 flex items-center justify-end gap-2 shrink-0">
            {health.binance_api_configured ? (
              <button
                type="button"
                onClick={() => runIncrementalSync(false)}
                disabled={isSyncingBg}
                title={`Binance P2P: Conectado (Auto-sync activo cada 60s)${
                  health.last_synced_at ? ` · Última sincronización: ${health.last_synced_at}` : ''
                } · Clic para forzar actualización`}
                className="group flex h-8 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 transition-all shadow-xs cursor-pointer disabled:opacity-70"
              >
                {/* Pulso de estatus en tiempo real */}
                <span className="relative flex h-2 w-2 shrink-0">
                  {isSyncingBg ? (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </>
                  )}
                </span>

                <span className="text-slate-200 font-semibold tracking-tight shrink-0">
                  Binance
                </span>

                <span className="hidden sm:inline-flex items-center text-[11px] text-slate-400 border-l border-slate-800 pl-2 tabular-nums">
                  {isSyncingBg ? (
                    <span className="text-amber-300 flex items-center gap-1.5 font-medium whitespace-nowrap">
                      <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
                      <span>Sincronizando...</span>
                    </span>
                  ) : (
                    <span className="group-hover:text-slate-200 transition-colors whitespace-nowrap">
                      {formatSyncTime(health.last_synced_at)}
                    </span>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                title="Conectar API Key de Binance para sincronización automática"
                className="flex h-8 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-all shadow-xs"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                <span>Conectar Binance</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openSettings('BANKS')}
              title="Ajustes: Bancos, Conexiones y Base de Datos"
              className={`group flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all ${
                activeView === 'SETTINGS'
                  ? 'border-amber-500/35 bg-amber-500/15 text-amber-300 shadow-xs'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Settings
                className={`h-3.5 w-3.5 transition-colors ${
                  activeView === 'SETTINGS' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="hidden sm:inline">Ajustes</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal de las Vistas con Keep-Alive (Navegación Instantánea) */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
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
            />
          </div>
        )}

        {visitedViews.has('HISTORY') && (
          <div className={activeView === 'HISTORY' ? 'contents' : 'hidden'}>
            <HistoryOperationsView
              refreshTrigger={refreshTrigger}
              onNavigateFormulas={() => openSettings('DOCS')}
            />
          </div>
        )}

        {visitedViews.has('RECONCILER') && (
          <div className={activeView === 'RECONCILER' ? 'contents' : 'hidden'}>
            <BankReconcilerView />
          </div>
        )}

        {visitedViews.has('SETTINGS') && (
          <div className={activeView === 'SETTINGS' ? 'contents' : 'hidden'}>
            <SettingsView
              initialSection={settingsSection}
              health={health}
              refreshTrigger={refreshTrigger}
              onSyncComplete={() => {
                setRefreshTrigger((prev) => prev + 1);
                checkHealth();
              }}
              onReturnDashboard={() => setActiveView('DASHBOARD')}
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
    </div>
  );
}
