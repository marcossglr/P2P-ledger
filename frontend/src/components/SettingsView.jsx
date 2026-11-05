import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Database,
  Sparkles,
  Trash2,
  SlidersHorizontal,
  Link2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Globe,
  Radio,
  ChevronRight,
  Lock,
  Zap,
  Info,
  Download,
  AlertTriangle,
  Activity,
  FileSpreadsheet,
  Clock,
  Timer,
  Volume2,
  VolumeX,
  Palette,
  Bell,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import DatabaseBackupsSection from './settings/DatabaseBackupsSection';
import SystemMaintenanceSection from './settings/SystemMaintenanceSection';
import BinancePrivateApiSection from './settings/BinancePrivateApiSection';
import { playNewTradeSound, playCompletedTradeSound } from '../utils/audioAlerts';
import { fmtDateTime } from '../utils/formatters';
import SystemDocumentationSection from './SystemDocumentationSection';
import { Button, Badge } from './ui';

const TABS = [
  { id: 'CONNECTIONS', label: 'Conexiones', icon: Link2 },
  { id: 'DATABASE', label: 'Base de Datos y Respaldo', icon: Database },
  { id: 'PREFERENCES', label: 'Preferencias', icon: Palette },
  { id: 'DOCS', label: 'Información y Cálculos', icon: Info },
  { id: 'MAINTENANCE', label: 'Mantenimiento y Diagnóstico', icon: SlidersHorizontal },
];

export default function SettingsView({
  initialSection = 'CONNECTIONS',
  health = {},
  refreshTrigger = 0,
  syncIntervalSeconds = 60,
  onUpdateSyncInterval,
  soundEnabled = true,
  onToggleSound,
  soundNewOrderEnabled = true,
  onToggleSoundNewOrder,
  soundCompletedOrderEnabled = true,
  onToggleSoundCompletedOrder,
  toastsEnabled = true,
  onToggleToasts,
  appTheme = 'DEEP_SLATE',
  onUpdateAppTheme,
  timeFormat = '24H',
  onUpdateTimeFormat,
  timeShowSeconds = false,
  onToggleTimeShowSeconds,
  onSyncComplete,
  onReturnDashboard,
  onNavigateTreasury,
}) {
  const normalizeSection = (sec) => {
    if (sec === 'DATABASE') return 'DATABASE';
    if (sec === 'PREFERENCES') return 'PREFERENCES';
    if (sec === 'DOCS' || sec === 'FORMULAS' || sec === 'INFO') return 'DOCS';
    if (sec === 'MAINTENANCE') return 'MAINTENANCE';
    return 'CONNECTIONS';
  };

  const [activeSection, setActiveSection] = useState(() => normalizeSection(initialSection));

  useEffect(() => {
    if (initialSection) {
      setActiveSection(normalizeSection(initialSection));
    }
  }, [initialSection]);

  // Sub-sección seleccionada dentro de Conexiones: BINANCE es la principal
  const [selectedProvider, setSelectedProvider] = useState('BINANCE');

  // Sub-pestañas internas dentro de la sección de Binance
  const [binanceSubTab, setBinanceSubTab] = useState('PRIVATE_API'); // 'PRIVATE_API' | 'PUBLIC_API' | 'GUIDE'

  // Estados para credenciales de Binance API
  // Estados para alertas de mensaje
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const apiConfigured = Boolean(health.binance_api_configured);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* COLUMNA LATERAL IZQUIERDA: Menú de Ajustes Compacto, Vertical y Sticky */}
        <aside className="w-full md:w-56 shrink-0 md:sticky md:top-20 space-y-3">
          <div className="flex items-center justify-between pb-1 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ajustes
            </span>
            {onReturnDashboard && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon={ArrowLeft}
                onClick={onReturnDashboard}
                title="Volver al panel principal"
                className="text-slate-400 hover:text-amber-300"
              >
                <span>Volver</span>
              </Button>
            )}
          </div>

          <nav aria-label="Menú de ajustes" className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all cursor-pointer text-left ${
                    isActive
                      ? 'border border-amber-500/35 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                      : 'border border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* COLUMNA PRINCIPAL DERECHA: Contenido Enfocado y de Ancho Natural */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Mensajes Globales de Estado */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-fadeIn">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{message}</span>
            </div>
          )}

      {/* 1. SECCIÓN CONEXIONES (GENERAL CON SECCIÓN BINANCE) */}
      {activeSection === 'CONNECTIONS' && (
        <div className="space-y-4">
          {/* Selector Sintetizado de Proveedores de Conexión */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Proveedor: Binance */}
            <button
              type="button"
              onClick={() => setSelectedProvider('BINANCE')}
              className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                selectedProvider === 'BINANCE'
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 shrink-0">
                  <svg className="h-4 w-4 fill-amber-400" viewBox="0 0 24 24">
                    <path d="M12 3.02L7.04 7.98l2.48 2.48L12 7.98l2.48 2.48 2.48-2.48L12 3.02zM3.02 12l2.48-2.48 2.48 2.48-2.48 2.48L3.02 12zm8.98 8.98l-4.96-4.96 2.48-2.48 2.48 2.48 2.48-2.48 2.48 2.48-4.96 4.96zM18.5 12l2.48-2.48L23.46 12l-2.48 2.48-2.48-2.48zM12 9.94L9.94 12 12 14.06 14.06 12 12 9.94z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-white block leading-tight">Binance P2P</span>
                  <span className="text-xs text-slate-400 mt-0.5 block">Órdenes & Mercado</span>
                </div>
              </div>
              {apiConfigured ? (
                <Badge variant="success" dot size="xs">
                  Conectado
                </Badge>
              ) : (
                <Badge variant="warning" dot size="xs">
                  Configurar
                </Badge>
              )}
            </button>

            {/* Proveedor: Bancos en Bs */}
            <button
              type="button"
              onClick={() => setSelectedProvider('BANKS_API')}
              className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                selectedProvider === 'BANKS_API'
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block leading-tight">Bancos en Bs</span>
                  <span className="text-xs text-slate-400 mt-0.5 block">SMS & Webhooks</span>
                </div>
              </div>
              <Badge variant="default" size="xs">
                Próximamente
              </Badge>
            </button>

            {/* Proveedor: Otras Plataformas P2P */}
            <button
              type="button"
              onClick={() => setSelectedProvider('OTHER_EXCHANGES')}
              className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                selectedProvider === 'OTHER_EXCHANGES'
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block leading-tight">Otros Exchanges</span>
                  <span className="text-xs text-slate-400 mt-0.5 block">Bybit / El Dorado</span>
                </div>
              </div>
              <Badge variant="default" size="xs">
                En Roadmap
              </Badge>
            </button>
          </div>

          {/* VISTA DETALLADA DEL PROVEEDOR SELECCIONADO */}

          {/* CASO 1: SECCIÓN DEDICADA A BINANCE (SIN SUB-PESTAÑAS NI RELLENO) */}
          {selectedProvider === 'BINANCE' && (
            <BinancePrivateApiSection
              health={health}
              syncIntervalSeconds={syncIntervalSeconds}
              onChangeSyncInterval={onUpdateSyncInterval}
              onSyncComplete={onSyncComplete}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* CASO 2: SECCIÓN BANCOS EN BS (PREVIEW SOBRIO) */}
          {selectedProvider === 'BANKS_API' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Integración Directa Bancaria</h3>
                  <p className="text-xs text-slate-400">
                    Captura automática de transferencias y pagos móviles en Bolívares
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-w-2xl">
                <p>
                  Estamos desarrollando módulos de integración para procesar de manera automática los movimientos entrantes y salientes de tus cuentas bancarias nacionales (Banesco, Mercantil, Provincial, Banco de Venezuela, Bancamiga, etc.).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-slate-200 block">Lectura de Notificaciones SMS / Email</span>
                    <p className="text-[11px] text-slate-400">
                      Recepción de alertas bancarias para conciliar referencias en tiempo real sin salir de la app.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-slate-200 block">Webhooks Locales</span>
                    <p className="text-[11px] text-slate-400">
                      Conecta tus bots de mensajería o servicios de pasarela para alimentar tu libro de caja en Bs.
                    </p>
                  </div>
                </div>
                <div className="pt-3">
                  {onNavigateTreasury && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onNavigateTreasury}
                    >
                      <span>Ir a Tesorería y Cuentas Bancarias</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CASO 3: SECCIÓN OTROS EXCHANGES (PREVIEW SOBRIO) */}
          {selectedProvider === 'OTHER_EXCHANGES' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Soporte Multi-Exchange</h3>
                  <p className="text-xs text-slate-400">
                    Conexión con mercados secundarios y otros CEX para consolidación global
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-w-2xl">
                <p>
                  El motor del reconciliador está preparado para recibir transacciones de plataformas como Bybit P2P, El Dorado, Zinli y KuCoin para unificar tu costo promedio ponderado (WAC) y saldo de tesorería sin importar dónde operes.
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                  <span className="text-xs font-bold text-slate-200 block mb-1">
                    ¿Deseas que prioricemos una plataforma específica?
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Mientras tanto, puedes importar cualquier operación de otras plataformas cargando reportes compatibles en la sección de Base de Datos y Respaldo.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedProvider('BINANCE')}
                  >
                    <span>Volver a la Conexión de Binance</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SECCIÓN BASE DE DATOS Y RESPALDO (ARQUITECTURA DE DATOS + GESTOR DE BACKUPS) */}
      {/* 3. SECCIÓN GESTIÓN DE BASE DE DATOS Y RESPALDOS */}
      {activeSection === 'DATABASE' && (
        <DatabaseBackupsSection
          health={health}
          refreshTrigger={refreshTrigger}
          onSyncComplete={onSyncComplete}
          setMessage={setMessage}
          setError={setError}
        />
      )}

      {/* 4. SECCIÓN PREFERENCIAS DEL USUARIO */}
      {activeSection === 'PREFERENCES' && (
        <div className="space-y-4">
          {/* Bloque 1: Alertas Sonoras y Notificaciones de Audio */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Alertas Sonoras y Audio</h3>
                  <p className="text-xs text-slate-400">
                    Notificaciones audibles sutiles generadas mediante Web Audio API (cero latencia)
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={soundEnabled ? 'emerald' : 'secondary'}
                size="sm"
                icon={soundEnabled ? Volume2 : VolumeX}
                onClick={() => onToggleSound && onToggleSound(!soundEnabled)}
              >
                <span>{soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {/* Evento 1: Nueva orden en progreso */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Órdenes Nuevas en Proceso</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundNewOrderEnabled}
                        onChange={(e) => onToggleSoundNewOrder && onToggleSoundNewOrder(e.target.checked)}
                        disabled={!soundEnabled}
                        className="h-4 w-4 accent-amber-500 rounded cursor-pointer disabled:opacity-30"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Arpegio ascendente suave (D5 ➔ A5) que te avisa al instante cuando un comerciante abre un trade.
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={Volume2}
                    onClick={() => playNewTradeSound(true)}
                  >
                    <span>Probar Tono</span>
                  </Button>
                </div>
              </div>

              {/* Evento 2: Orden completada */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Órdenes Completadas / Liberadas</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundCompletedOrderEnabled}
                        onChange={(e) => onToggleSoundCompletedOrder && onToggleSoundCompletedOrder(e.target.checked)}
                        disabled={!soundEnabled}
                        className="h-4 w-4 accent-amber-500 rounded cursor-pointer disabled:opacity-30"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Doble campana armónica (A5 + E6) que confirma cuando un trade se completa y se acredita el saldo.
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={Volume2}
                    onClick={() => playCompletedTradeSound(true)}
                  >
                    <span>Probar Tono</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 2: Apariencia y Tema Visual */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                <Palette className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Apariencia y Contraste Visual</h3>
                <p className="text-xs text-slate-400">
                  Selecciona la paleta de fondo y descanso visual más cómoda para tus sesiones
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Tema 1: Deep Slate (Predeterminado) */}
              <button
                type="button"
                onClick={() => onUpdateAppTheme && onUpdateAppTheme('DEEP_SLATE')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  appTheme === 'DEEP_SLATE'
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Oscuro Profundo (Slate/Onyx)</span>
                  </div>
                  {appTheme === 'DEEP_SLATE' && (
                    <Badge variant="warning" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Tono oscuro equilibrado con matices azul pizarra, óptimo para el descanso visual.
                </p>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="h-4 w-8 rounded bg-slate-950 border border-slate-800" />
                  <div className="h-4 w-8 rounded bg-slate-900 border border-slate-700" />
                  <div className="h-4 w-8 rounded bg-amber-500" />
                  <div className="h-4 w-8 rounded bg-emerald-500" />
                </div>
              </button>

              {/* Tema 2: Pure OLED Black */}
              <button
                type="button"
                onClick={() => onUpdateAppTheme && onUpdateAppTheme('OLED_BLACK')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  appTheme === 'OLED_BLACK'
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Negro Puro (OLED / Pitch Black)</span>
                  </div>
                  {appTheme === 'OLED_BLACK' && (
                    <Badge variant="warning" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Fondo negro absoluto (#000000) que maximiza el contraste de números y ahorra batería.
                </p>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="h-4 w-8 rounded bg-black border border-neutral-800" />
                  <div className="h-4 w-8 rounded bg-neutral-900 border border-neutral-700" />
                  <div className="h-4 w-8 rounded bg-amber-500" />
                  <div className="h-4 w-8 rounded bg-emerald-500" />
                </div>
              </button>

              {/* Tema 3: Navy Midnight (Azul Marino Nocturno) */}
              <button
                type="button"
                onClick={() => onUpdateAppTheme && onUpdateAppTheme('NAVY_MIDNIGHT')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  appTheme === 'NAVY_MIDNIGHT'
                    ? 'border-sky-500/60 bg-sky-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">Azul Marino Nocturno (Navy)</span>
                  </div>
                  {appTheme === 'NAVY_MIDNIGHT' && (
                    <Badge variant="info" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Atmósfera financiera inspirada en terminales Bloomberg con matices azul ultramarino.
                </p>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="h-4 w-8 rounded bg-[#030712] border border-blue-950" />
                  <div className="h-4 w-8 rounded bg-[#0f172a] border border-blue-900" />
                  <div className="h-4 w-8 rounded bg-sky-400" />
                  <div className="h-4 w-8 rounded bg-emerald-400" />
                </div>
              </button>

              {/* Tema 4: Light Elegant (Modo Claro de Alto Contraste) */}
              <button
                type="button"
                onClick={() => onUpdateAppTheme && onUpdateAppTheme('LIGHT_ELEGANT')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  appTheme === 'LIGHT_ELEGANT'
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-white">Luz Natural (Modo Claro)</span>
                  </div>
                  {appTheme === 'LIGHT_ELEGANT' && (
                    <Badge variant="warning" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Fondo claro (#f8fafc) con tarjetas nítidas para trabajar de día o en ambientes iluminados.
                </p>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="h-4 w-8 rounded bg-slate-50 border border-slate-300" />
                  <div className="h-4 w-8 rounded bg-white border border-slate-300" />
                  <div className="h-4 w-8 rounded bg-amber-500" />
                  <div className="h-4 w-8 rounded bg-emerald-600" />
                </div>
              </button>
            </div>
          </div>

          {/* Bloque 3: Formato de Fecha y Hora */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Formato de Fecha y Hora</h3>
                  <p className="text-xs text-slate-400">
                    Personaliza cómo se visualiza el reloj y las marcas temporales en toda la aplicación
                  </p>
                </div>
              </div>

              {/* Vista Previa En Vivo */}
              <div className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-1.5 text-xs font-mono text-slate-300">
                <span className="text-slate-400 font-sans text-[11px]">Vista previa:</span>
                <span className="font-semibold text-amber-300">
                  {fmtDateTime(new Date(), { timeFormat, showSeconds: timeShowSeconds })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Opción 24 Horas */}
              <button
                type="button"
                onClick={() => onUpdateTimeFormat && onUpdateTimeFormat('24H')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  timeFormat === '24H'
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">Formato 24 Horas</span>
                  </div>
                  {timeFormat === '24H' && (
                    <Badge variant="warning" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  Estándar militar/internacional (ej: <span className="font-mono text-slate-200">14:42{timeShowSeconds ? ':00' : ''}</span>).
                </p>
              </button>

              {/* Opción 12 Horas (AM/PM) */}
              <button
                type="button"
                onClick={() => onUpdateTimeFormat && onUpdateTimeFormat('12H')}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  timeFormat === '12H'
                    ? 'border-amber-500/60 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">Formato 12 Horas (AM / PM)</span>
                  </div>
                  {timeFormat === '12H' && (
                    <Badge variant="warning" size="xs">
                      Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  Estándar tradicional con sufijo de meridiano (ej: <span className="font-mono text-slate-200">02:42{timeShowSeconds ? ':00' : ''} PM</span>).
                </p>
              </button>
            </div>

            {/* Toggle Mostrar Segundos */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 pt-3 mt-2">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Mostrar Segundos (:SS)</span>
                <p className="text-xs text-slate-400">
                  Incluye los segundos en las horas de órdenes, sincronizaciones y eventos temporales.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeShowSeconds}
                  onChange={(e) => onToggleTimeShowSeconds && onToggleTimeShowSeconds(e.target.checked)}
                  className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Bloque 4: Mensajes Emergentes y Toasts */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Notificaciones Emergentes en Pantalla</h3>
                  <p className="text-xs text-slate-400">
                    Mensajes flotantes en la esquina inferior al completar sincronizaciones
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={toastsEnabled ? 'emerald' : 'secondary'}
                size="sm"
                icon={Bell}
                onClick={() => onToggleToasts && onToggleToasts(!toastsEnabled)}
              >
                {toastsEnabled ? 'Mensajes Activos' : 'Silenciados'}
              </Button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Muestra pequeñas etiquetas discretas como <span className="text-slate-300 font-mono">"+2 nuevas órdenes sincronizadas"</span> o <span className="text-slate-300 font-mono">"Al día con Binance P2P"</span> cuando finaliza cada ciclo de polling en segundo plano.
            </p>
          </div>
        </div>
      )}

      {/* 5. SECCIÓN INFORMACIÓN Y CÁLCULOS */}
      {activeSection === 'DOCS' && (
        <SystemDocumentationSection />
      )}

      {/* 4. SECCIÓN MANTENIMIENTO Y DIAGNÓSTICO */}
      {activeSection === 'MAINTENANCE' && (
        <SystemMaintenanceSection
          health={health}
          syncIntervalSeconds={syncIntervalSeconds}
          onSyncComplete={onSyncComplete}
          setMessage={setMessage}
          setError={setError}
        />
      )}
        </div>
      </div>
    </div>
  );
}
