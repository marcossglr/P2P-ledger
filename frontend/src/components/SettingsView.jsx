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
} from 'lucide-react';
import BankInventoryView from './BankInventoryView';
import BinanceP2PPublicApiCard from './BinanceP2PPublicApiCard';
import SystemDocumentationSection from './SystemDocumentationSection';

const TABS = [
  { id: 'CONNECTIONS', label: 'Conexiones', icon: Link2 },
  { id: 'DATABASE', label: 'Base de Datos y Respaldo', icon: Database },
  { id: 'DOCS', label: 'Información y Cálculos', icon: Info },
  { id: 'MAINTENANCE', label: 'Mantenimiento y Diagnóstico', icon: SlidersHorizontal },
  { id: 'BANKS', label: 'Cuentas Bancarias', icon: Building2 },
];

export default function SettingsView({
  initialSection = 'CONNECTIONS',
  health = {},
  refreshTrigger = 0,
  syncIntervalSeconds = 60,
  onUpdateSyncInterval,
  onSyncComplete,
  onReturnDashboard,
}) {
  const normalizeSection = (sec) => {
    if (sec === 'BANKS') return 'BANKS';
    if (sec === 'DATABASE') return 'DATABASE';
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
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showKeyForm, setShowKeyForm] = useState(!health.binance_api_configured);
  const [copiedKey, setCopiedKey] = useState(false);

  // Estados para Base de Datos y Mantenimiento
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const apiConfigured = Boolean(health.binance_api_configured);
  const maskedKey = health.masked_api_key || '';

  const handleCopyKey = () => {
    if (maskedKey) {
      navigator.clipboard.writeText(maskedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKey(text.trim());
    } catch {
      // Ignorar si el navegador restringe portapapeles
    }
  };

  const handleConnectAndSync = async (e, forceFull = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const hasNewKeys = Boolean(apiKey.trim() && apiSecret.trim());
    // Con llaves nuevas el backend siempre hace sincronización completa; se avisa antes de ejecutarla.
    if (forceFull || hasNewKeys) {
      const confirmed = window.confirm(
        'Se descargará el historial completo de los últimos 180 días desde Binance. ' +
          'Puede tardar y realiza muchas consultas a la API. ¿Deseas continuar?'
      );
      if (!confirmed) return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const payload = forceFull ? { force_full_180d: true, days: 180 } : {};
      if (hasNewKeys) {
        payload.api_key = apiKey.trim();
        payload.api_secret = apiSecret.trim();
      }

      const res = await fetch('/api/binance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al sincronizar con Binance API');

      setApiKey('');
      setApiSecret('');
      setShowKeyForm(false);
      setMessage(
        `Sincronización ${data.sync_mode === 'INCREMENTAL' ? 'incremental' : 'completa de 180 días'} completada: ${data.fetched_count} órdenes verificadas (${data.new_orders} nuevas incorporadas).`
      );
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvFallback = async (file) => {
    if (!file) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload/binance-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al importar CSV');
      setMessage(`CSV importado correctamente: ${data.valid_rows} órdenes agregadas a la base de datos.`);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    window.open('/api/operations/export?bank_fee_pct=0.0', '_blank');
  };

  const handleSeedDemo = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await fetch('/api/binance/demo-seed', { method: 'POST' });
      setMessage('Operaciones de demostración cargadas correctamente.');
      if (onSyncComplete) onSyncComplete();
    } catch {
      setError('Error al cargar operaciones de demostración.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await fetch('/api/operations/clear?only_demo=true', { method: 'DELETE' });
      setMessage('Operaciones de demostración eliminadas correctamente.');
      if (onSyncComplete) onSyncComplete();
    } catch {
      setError('Error al limpiar datos de demostración.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDatabase = async () => {
    if (!confirmDeleteAll) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await fetch('/api/operations/clear?only_demo=false', { method: 'DELETE' });
      setConfirmDeleteAll(false);
      setMessage('Base de datos restablecida por completo.');
      if (onSyncComplete) onSyncComplete();
    } catch {
      setError('Error al restablecer la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectApi = async () => {
    if (!window.confirm('¿Deseas desvincular tus credenciales de Binance API de este equipo?')) {
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await fetch('/api/binance/config', { method: 'DELETE' });
      setShowKeyForm(true);
      setMessage('Credenciales de Binance API eliminadas correctamente.');
      if (onSyncComplete) onSyncComplete();
    } catch {
      setError('Error al eliminar las credenciales de API.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = apiConfigured || (apiKey.trim().length > 0 && apiSecret.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Cabecera Superior Unificada y Sobria */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <Settings className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Ajustes y Configuración</h2>
              <span className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                Sistema
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Administración de tesorería en Bs, conexiones externas, almacenamiento local y herramientas de mantenimiento
            </p>
          </div>
        </div>

        {onReturnDashboard && (
          <button
            type="button"
            onClick={onReturnDashboard}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
            <span>Volver a Operaciones de Hoy</span>
          </button>
        )}
      </div>

      {/* Navegación por Pestañas Principales (Diseño Maduro, Profesional y Consistente) */}
      <nav
        aria-label="Pestañas de ajustes"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-sm"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-all cursor-pointer ${
                isActive
                  ? 'border border-amber-500/35 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                  : 'border border-transparent text-slate-400 hover:border-slate-700/60 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
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

      {/* 1. SECCIÓN CUENTAS BANCARIAS */}
      {activeSection === 'BANKS' && (
        <BankInventoryView
          refreshTrigger={refreshTrigger}
          onInventoryChange={onSyncComplete}
        />
      )}

      {/* 2. SECCIÓN CONEXIONES (GENERAL CON SECCIÓN BINANCE) */}
      {activeSection === 'CONNECTIONS' && (
        <div className="space-y-4">
          {/* Banner Resumen del Centro de Conexiones */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Centro de Conexiones e Integraciones</h3>
              </div>
              <p className="text-xs text-slate-400">
                Gestiona las pasarelas externas, APIs de exchanges y proveedores de datos conectados al reconciliador.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-slate-300">
                <Radio className={`h-3 w-3 ${syncIntervalSeconds > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>
                  {syncIntervalSeconds > 0
                    ? `Auto-sync cada ${syncIntervalSeconds >= 60 ? `${syncIntervalSeconds / 60}m` : `${syncIntervalSeconds}s`}`
                    : 'Auto-sync desactivado'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-slate-300">
                <Lock className="h-3 w-3 text-amber-400" />
                <span>Permisos Locales 0600</span>
              </span>
            </div>
          </div>

          {/* Selector de Proveedores de Conexión (Colores Sobrios y Consistentes) */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">
              Proveedores y Plataformas Disponibles
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Proveedor: Binance (Activo / Destacado) */}
              <button
                type="button"
                onClick={() => setSelectedProvider('BINANCE')}
                className={`relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  selectedProvider === 'BINANCE'
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Icono Diamante de Binance */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-400 shadow-xs">
                      <svg className="h-4.5 w-4.5 fill-amber-400" viewBox="0 0 24 24">
                        <path d="M12 3.02L7.04 7.98l2.48 2.48L12 7.98l2.48 2.48 2.48-2.48L12 3.02zM3.02 12l2.48-2.48 2.48 2.48-2.48 2.48L3.02 12zm8.98 8.98l-4.96-4.96 2.48-2.48 2.48 2.48 2.48-2.48 2.48 2.48-4.96 4.96zM18.5 12l2.48-2.48L23.46 12l-2.48 2.48-2.48-2.48zM12 9.94L9.94 12 12 14.06 14.06 12 12 9.94z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Binance</span>
                      <span className="text-[10px] text-slate-400">P2P & Mercado</span>
                    </div>
                  </div>

                  {apiConfigured ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Configurar
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[11px] text-slate-400 line-clamp-2">
                  Sincronización de órdenes P2P (180 días) y cotizaciones públicas en vivo.
                </p>
              </button>

              {/* Proveedor: Bancos en Bs (Próximamente) */}
              <button
                type="button"
                onClick={() => setSelectedProvider('BANKS_API')}
                className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  selectedProvider === 'BANKS_API'
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Bancos en Bs</span>
                      <span className="text-[10px] text-slate-400">SMS / Webhooks</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    Próximamente
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-slate-400 line-clamp-2">
                  Recepción directa de pagos móviles y transferencias vía API bancaria o SMS.
                </p>
              </button>

              {/* Proveedor: Otras Plataformas P2P / CEX (Próximamente) */}
              <button
                type="button"
                onClick={() => setSelectedProvider('OTHER_EXCHANGES')}
                className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  selectedProvider === 'OTHER_EXCHANGES'
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                      <Globe className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Otros Exchanges</span>
                      <span className="text-[10px] text-slate-400">Bybit / El Dorado</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-md border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    En Roadmap
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-slate-400 line-clamp-2">
                  Soporte multi-exchange para consolidar operaciones P2P de varias plataformas.
                </p>
              </button>
            </div>
          </div>

          {/* VISTA DETALLADA DEL PROVEEDOR SELECCIONADO */}

          {/* CASO 1: SECCIÓN DEDICADA A BINANCE */}
          {selectedProvider === 'BINANCE' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-5">
              {/* Encabezado Principal de Binance */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400 shadow-sm">
                    <svg className="h-5 w-5 fill-amber-400" viewBox="0 0 24 24">
                      <path d="M12 3.02L7.04 7.98l2.48 2.48L12 7.98l2.48 2.48 2.48-2.48L12 3.02zM3.02 12l2.48-2.48 2.48 2.48-2.48 2.48L3.02 12zm8.98 8.98l-4.96-4.96 2.48-2.48 2.48 2.48 2.48-2.48 2.48 2.48-4.96 4.96zM18.5 12l2.48-2.48L23.46 12l-2.48 2.48-2.48-2.48zM12 9.94L9.94 12 12 14.06 14.06 12 12 9.94z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Conexión Binance</h3>
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        P2P API Oficial
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Sincronización automatizada de transacciones y consulta de estadísticas de mercado en tiempo real
                    </p>
                  </div>
                </div>

                {/* Estatus y Botón Rápido */}
                <div className="flex items-center gap-2.5">
                  {apiConfigured ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>API Vinculada</span>
                      {maskedKey && (
                        <span className="font-mono text-slate-300 text-[11px] border-l border-emerald-500/30 pl-2">
                          {maskedKey}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span>Configuración Pendiente</span>
                    </div>
                  )}

                  {apiConfigured && (
                    <button
                      type="button"
                      onClick={handleConnectAndSync}
                      disabled={loading}
                      title="Sincronizar solo las órdenes nuevas desde la última actualización"
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-navegación tipo Segmented Control para Binance */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
                <button
                  type="button"
                  onClick={() => setBinanceSubTab('PRIVATE_API')}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-all cursor-pointer ${
                    binanceSubTab === 'PRIVATE_API'
                      ? 'border border-amber-500/35 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                      : 'border border-transparent text-slate-400 hover:border-slate-700/60 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Órdenes y Transacciones (API Privada)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBinanceSubTab('PUBLIC_API')}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-all cursor-pointer ${
                    binanceSubTab === 'PUBLIC_API'
                      ? 'border border-amber-500/35 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                      : 'border border-transparent text-slate-400 hover:border-slate-700/60 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Mercado y Precios P2P (API Pública)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBinanceSubTab('GUIDE')}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-all cursor-pointer ${
                    binanceSubTab === 'GUIDE'
                      ? 'border border-amber-500/35 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                      : 'border border-transparent text-slate-400 hover:border-slate-700/60 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Seguridad y Guía de Permisos</span>
                </button>
              </div>

              {/* SUB-PESTAÑA 1: API PRIVADA (ÓRDENES E HISTORIAL P2P) */}
              {binanceSubTab === 'PRIVATE_API' && (
                <div className="space-y-4">
                  {/* Tarjeta de Resumen de Estado */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                          Estado de Credenciales de Lectura
                        </span>
                        {apiConfigured ? (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">
                              Credenciales Activas y Verificadas
                            </span>
                            <span className="font-mono text-xs text-slate-300 ml-1">
                              ({maskedKey})
                            </span>
                            {maskedKey && (
                              <button
                                type="button"
                                onClick={handleCopyKey}
                                className="ml-1 inline-flex items-center text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                                title="Copiar identificador enmascarado"
                              >
                                {copiedKey ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                            <span className="text-xs font-semibold text-amber-300">
                              Sin credenciales configuradas
                            </span>
                          </div>
                        )}
                      </div>

                      {apiConfigured && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowKeyForm(!showKeyForm)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            {showKeyForm ? 'Ocultar Formulario' : 'Cambiar Credenciales'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDisconnectApi}
                            disabled={loading}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          >
                            Desvincular
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Formulario de Llaves (visible si no está configurada o si el usuario quiere cambiarla) */}
                    {(showKeyForm || !apiConfigured) && (
                      <div className="mt-4 space-y-3.5 border-t border-slate-800 pt-4 animate-fadeIn">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-300">
                              Binance API Key <span className="text-slate-500 font-normal">(Solo Lectura)</span>
                            </label>
                            <button
                              type="button"
                              onClick={handlePasteKey}
                              className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="h-3 w-3" /> Pegar Portapapeles
                            </button>
                          </div>
                          <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Pega tu API Key de Binance..."
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Binance Secret Key
                          </label>
                          <div className="relative">
                            <input
                              type={showSecret ? 'text' : 'password'}
                              value={apiSecret}
                              onChange={(e) => setApiSecret(e.target.value)}
                              placeholder="Pega tu Secret Key de Binance..."
                              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pr-10 font-mono text-xs text-white focus:border-amber-500 focus:outline-none transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecret(!showSecret)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                              title={showSecret ? 'Ocultar Secret' : 'Mostrar Secret'}
                            >
                              {showSecret ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
                          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            Solo requieres habilitar el permiso de <strong className="text-slate-200">Enable Reading</strong> (Lectura). Nunca actives retiros ni trading spot. Tus credenciales se almacenan localmente en tu equipo.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selector de Frecuencia de Sincronización Automática */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <div>
                          <span className="text-xs font-bold text-white block">
                            Frecuencia de Sincronización Automática
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Intervalo en segundo plano para consultar órdenes nuevas de Binance P2P
                          </span>
                        </div>
                      </div>

                      {syncIntervalSeconds > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Activo ({syncIntervalSeconds >= 60 ? `${syncIntervalSeconds / 60} min` : `${syncIntervalSeconds}s`})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                          <span>Solo manual</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {[
                        { label: 'Desactivado', val: 0, desc: 'Solo manual' },
                        { label: '15 segundos', val: 15, desc: 'Alta frecuencia' },
                        { label: '30 segundos', val: 30, desc: 'Trading activo' },
                        { label: '60 segundos', val: 60, desc: 'Recomendado', defaultTag: true },
                        { label: '2 minutos', val: 120, desc: 'Bajo consumo' },
                        { label: '5 minutos', val: 300, desc: 'Modo reposo' },
                      ].map((opt) => {
                        const isSelected = syncIntervalSeconds === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => onUpdateSyncInterval && onUpdateSyncInterval(opt.val)}
                            className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-xs font-bold block">{opt.label}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-800/60">
                      💡 <strong>Límites de Binance:</strong> Binance permite hasta 1.200 peticiones/minuto por IP. La consulta incremental consume únicamente ~3 peticiones por ciclo (&lt; 0.5% del cupo a 60s). El ajuste se almacena de forma persistente.
                    </p>
                  </div>

                  {/* Botón de Sincronización Principal */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleConnectAndSync}
                      disabled={loading || !canSubmit}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      <span>
                        {loading
                          ? 'Sincronizando...'
                          : apiConfigured && !apiKey.trim()
                          ? 'Sincronizar Órdenes Nuevas'
                          : 'Guardar Llaves y Sincronizar Historial'}
                      </span>
                    </button>

                    {apiConfigured && !apiKey.trim() && (
                      <button
                        type="button"
                        onClick={(ev) => handleConnectAndSync(ev, true)}
                        disabled={loading}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        Sincronización completa (180 días)
                      </button>
                    )}

                    <div className="text-[11px] text-slate-500">
                      La sincronización normal trae solo lo nuevo; la completa recorre hasta 180 días continuos de la API de Binance
                    </div>
                  </div>

                  {/* Respaldo / Historial mayor a 6 meses con CSV */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">
                        ¿Tienes operaciones de más de 6 meses? Importación CSV
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      La API de Binance restringe el historial P2P a 180 días. Si necesitas incorporar operaciones más antiguas generadas desde el portal web de Binance, puedes subir el reporte en formato <code className="font-mono text-slate-300">.csv</code>:
                    </p>
                    <div className="pt-1.5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors shadow-xs">
                        <Upload className="h-3.5 w-3.5 text-amber-400" />
                        <span>Seleccionar Archivo .CSV de Binance</span>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => handleCsvFallback(e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-PESTAÑA 2: API PÚBLICA DE MERCADO (PRECIOS Y SPREAD) */}
              {binanceSubTab === 'PUBLIC_API' && (
                <BinanceP2PPublicApiCard />
              )}

              {/* SUB-PESTAÑA 3: SEGURIDAD Y GUÍA DE PERMISOS */}
              {binanceSubTab === 'GUIDE' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      <span>Guía de Creación y Permisos de la API de Binance</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Sigue estos sencillos pasos en tu cuenta de Binance para generar tus llaves con la máxima seguridad:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold">
                            1
                          </span>
                          <span>Acceder a Gestión de API</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Inicia sesión en <strong className="text-slate-300">Binance.com</strong>, dirígete a tu Perfil (ícono de usuario) y haz clic en <em>Gestión de API</em>.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold">
                            2
                          </span>
                          <span>Crear Clave de Sistema</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Elige <strong className="text-slate-300">Generada por el Sistema</strong> (System Generated HMAC) y asígnale una etiqueta identificadora, por ejemplo <em>P2P Ledger</em>.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                            3
                          </span>
                          <span>Permiso: Solo Lectura</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Marca únicamente la casilla <strong className="text-emerald-300">Enable Reading</strong> (Habilitar Lectura). Es el único permiso necesario para sincronizar tus órdenes P2P.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-bold">
                            4
                          </span>
                          <span>Prohibir Retiros y Trading</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Asegúrate de que <strong className="text-rose-300">Enable Withdrawals</strong> y <strong className="text-rose-300">Spot & Margin Trading</strong> estén <em>desactivados</em>. Esta aplicación nunca solicitará permisos transaccionales.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Garantías de Privacidad */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Lock className="h-4 w-4 text-emerald-400" />
                      <span>Compromiso de Privacidad y Ejecución 100% Local</span>
                    </h4>
                    <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                      <p>
                        • <strong className="text-white">Almacenamiento Local Aislado:</strong> Tus credenciales se guardan exclusivamente en el disco duro de esta máquina local con permisos de archivo restringidos (<code className="font-mono text-slate-300">chmod 0600</code>).
                      </p>
                      <p>
                        • <strong className="text-white">Sin Servidores Intermedios:</strong> El reconciliador se comunica de forma directa y cifrada mediante HTTPS con los servidores oficiales de Binance (<code className="font-mono text-slate-300">api.binance.com</code>). Ningún tercero tiene acceso a tus claves.
                      </p>
                      <p>
                        • <strong className="text-white">Desvinculación Instantánea:</strong> Si en cualquier momento deseas eliminar tus llaves de este equipo, puedes hacer clic en <em className="text-slate-300">Desvincular</em> en la pestaña de Órdenes y se borrarán de forma inmediata e irreversible.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                  <button
                    type="button"
                    onClick={() => setActiveSection('BANKS')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <span>Gestionar Cuentas Bancarias Manuales</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
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
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('BINANCE')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <span>Volver a la Conexión de Binance</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SECCIÓN BASE DE DATOS Y RESPALDO (GRID BALANCEADO DE ANCHO COMPLETO) */}
      {activeSection === 'DATABASE' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tarjeta 1: Motor y Estado de Almacenamiento Local (SQLite) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Almacenamiento Local (SQLite)</h3>
                      <p className="text-[11px] text-slate-400">
                        Base de datos transaccional persistente y exportación de respaldos
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Operativo
                  </span>
                </div>

                {/* Métricas de Base de Datos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <span className="text-[11px] text-slate-400 block font-semibold">
                      Órdenes Almacenadas
                    </span>
                    <span className="tabular-nums text-xl font-bold text-white mt-0.5 block">
                      {health.stored_binance_orders || 0}{' '}
                      <span className="text-xs font-normal text-slate-400">op.</span>
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <span className="text-[11px] text-slate-400 block font-semibold">
                      Última Sincronización
                    </span>
                    <span className="tabular-nums text-xs font-semibold text-slate-200 mt-1 block">
                      {health.last_synced_at || 'Sin registros'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                    <span className="text-[11px] text-slate-400 block font-semibold">
                      Motor de Datos
                    </span>
                    <span className="text-xs font-semibold text-slate-200 mt-1 block">
                      SQLite 3 (Local WAL)
                    </span>
                  </div>
                </div>

                {/* Características de Privacidad */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Persistencia Segura en tu Equipo</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Toda la información de tus órdenes, libros contables, inventario WAC y cuentas bancarias reside en el archivo local <code className="font-mono text-slate-300">backend/p2p_reconciliation.db</code>. No se transmite información financiera a servidores externos.
                  </p>
                </div>
              </div>

              {/* Botón de Exportación Excel Sobrio */}
              <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  Descarga un reporte consolidado con estadísticas y detalles completos:
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                  <span>Exportar Respaldo Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Tarjeta 2: Importador de Archivos CSV de Binance */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Importación Histórica (.CSV)</h3>
                    <p className="text-[11px] text-slate-400">
                      Incorpora reportes descargados de Binance de más de 6 meses
                    </p>
                  </div>
                </div>

                {/* Dropzone Estilizado */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingCsv(true);
                  }}
                  onDragLeave={() => setIsDraggingCsv(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingCsv(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleCsvFallback(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    isDraggingCsv
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-amber-400 mb-3 shadow-xs">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-white block mb-1">
                    Arrastra aquí tu reporte .CSV o selecciónalo de tu equipo
                  </span>
                  <p className="text-[11px] text-slate-400 max-w-sm mb-3">
                    Compatible con el archivo de exportación estándar de órdenes P2P de Binance.
                  </p>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 transition-colors">
                    <span>Examinar Archivos .CSV</span>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => handleCsvFallback(e.target.files?.[0])}
                    />
                  </label>
                </div>

                {/* Guía Rápida de Exportación */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-400 space-y-1.5">
                  <span className="text-xs font-semibold text-slate-200 block">
                    ¿Cómo exportar desde Binance?
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    1. En Binance P2P, ingresa en <em>Órdenes</em> &gt; <em>Historial de Órdenes P2P</em>.
                    <br />
                    2. Haz clic en el botón superior derecho <em>Exportar</em>.
                    <br />
                    3. Elige el rango deseado (hasta 1 año o personalizado) y descarga el archivo .CSV.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECCIÓN INFORMACIÓN Y CÁLCULOS */}
      {activeSection === 'DOCS' && (
        <SystemDocumentationSection />
      )}

      {/* 5. SECCIÓN MANTENIMIENTO Y DIAGNÓSTICO (GRID Y ZONA CRÍTICA SEPARADA) */}
      {activeSection === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tarjeta 1: Entorno de Pruebas y Simulación (Seguro) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Entorno de Pruebas y Demo</h3>
                      <p className="text-[11px] text-slate-400">
                        Generación de órdenes simuladas para evaluar cálculos contables
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    Modo Seguro
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-400 space-y-2">
                  <p className="leading-relaxed">
                    Este módulo genera operaciones simuladas de Compra y Venta con tasas representativas del mercado venezolano para verificar los cálculos de costo promedio ponderado (WAC), margen de ganancia diaria y cuadres de saldo bancario.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    • Las órdenes de prueba se etiquetan automáticamente como 'DEMO' y se pueden eliminar en cualquier momento sin afectar tus órdenes reales importadas por API.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cargar Operaciones Demo</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>Eliminar Órdenes Demo</span>
                </button>
              </div>
            </div>

            {/* Tarjeta 2: Diagnóstico y Salud del Sistema */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300">
                      <Activity className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Diagnóstico y Salud del Sistema</h3>
                      <p className="text-[11px] text-slate-400">
                        Estado operativo de los servicios internos
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Sistema En Línea
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-[11px] text-slate-500 block">Servidor API</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">FastAPI (Python 3)</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-[11px] text-slate-500 block">Interfaz de Usuario</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">Vite + React 18</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-[11px] text-slate-500 block">Motor de Datos</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">SQLite 3 (Local)</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-[11px] text-slate-500 block">Frecuencia Auto-Sync</span>
                    <span className="font-semibold text-emerald-400 mt-0.5 block">Cada 60 segundos</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>Versión del Reconciliador: v1.0.0</span>
                <span>Modo: Monousuario Local</span>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Zona de Restablecimiento Crítico (Alto Riesgo) con Confirmación en 2 Pasos */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-200">Zona de Restablecimiento Crítico</h3>
                  <p className="text-[11px] text-slate-400">
                    Restablece la base de datos local y limpia todos los registros
                  </p>
                </div>
              </div>
              <span className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                Acción Irreversible
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta operación vaciará completamente el archivo de base de datos local: eliminará permanentemente todas las órdenes P2P registradas, lotes de inventario de costo (WAC), balances acumulados y cuentas bancarias creadas. Úsalo únicamente si necesitas empezar el reconciliador desde cero.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/20 bg-slate-950/60 p-3.5">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmDeleteAll}
                  onChange={(e) => setConfirmDeleteAll(e.target.checked)}
                  className="h-4 w-4 accent-rose-500 rounded cursor-pointer"
                />
                <span className="font-semibold text-rose-300">
                  Entiendo que esta acción destruirá permanentemente toda la base de datos local.
                </span>
              </label>

              <button
                type="button"
                onClick={handleClearAllDatabase}
                disabled={loading || !confirmDeleteAll}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-900/30 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Vaciar Base de Datos por Completo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
