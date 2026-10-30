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
import { playNewTradeSound, playCompletedTradeSound } from '../utils/audioAlerts';
import BinanceP2PPublicApiCard from './BinanceP2PPublicApiCard';
import SystemDocumentationSection from './SystemDocumentationSection';

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

  // Estados para Gestión de Respaldos SQLite
  const [backups, setBackups] = useState([]);
  const [dbSizeMb, setDbSizeMb] = useState(0);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState(null); // filename to confirm
  const [isDraggingBackup, setIsDraggingBackup] = useState(false);

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

  // Efecto para cargar los respaldos cuando se selecciona la pestaña DATABASE
  const fetchBackupsList = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        setDbSizeMb(data.current_db_size_mb || 0);
      }
    } catch {
      // Ignorar error silencioso
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'DATABASE') {
      fetchBackupsList();
    }
  }, [activeSection, refreshTrigger]);

  const handleCreateBackup = async () => {
    setError(null);
    setMessage(null);
    setBackupActionLoading(true);
    try {
      const res = await fetch('/api/backups/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al generar la copia de seguridad.');
      setMessage(`Copia de seguridad creada con éxito: ${data.filename} (${data.size_mb} MB)`);
      fetchBackupsList();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    setError(null);
    setMessage(null);
    setBackupActionLoading(true);
    setRestoreConfirmModal(null);
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al restaurar el respaldo.');
      setMessage(data.message || 'Base de datos restaurada correctamente.');
      fetchBackupsList();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el respaldo ${filename}?`)) return;
    setError(null);
    setMessage(null);
    setBackupActionLoading(true);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al eliminar el respaldo.');
      setMessage(`Respaldo ${filename} eliminado.`);
      fetchBackupsList();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleUploadBackup = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.db')) {
      setError('El archivo seleccionado debe ser una base de datos SQLite (.db)');
      return;
    }
    setError(null);
    setMessage(null);
    setBackupActionLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al subir el archivo de respaldo.');
      setMessage(`Respaldo incorporado a la lista: ${data.filename}`);
      fetchBackupsList();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const canSubmit = apiConfigured || (apiKey.trim().length > 0 && apiSecret.trim().length > 0);

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
              <button
                type="button"
                onClick={onReturnDashboard}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                title="Volver al panel principal"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Volver</span>
              </button>
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
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Configurar
                </span>
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
              <span className="inline-flex items-center rounded-md border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-xs font-semibold text-slate-400">
                Próximamente
              </span>
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
              <span className="inline-flex items-center rounded-md border border-slate-800 bg-slate-950/70 px-2 py-0.5 text-xs font-semibold text-slate-400">
                En Roadmap
              </span>
            </button>
          </div>

          {/* VISTA DETALLADA DEL PROVEEDOR SELECCIONADO */}

          {/* CASO 1: SECCIÓN DEDICADA A BINANCE (SIN SUB-PESTAÑAS NI RELLENO) */}
          {selectedProvider === 'BINANCE' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
              {/* Cabecera de Estado Binance */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Credenciales Binance API (P2P)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sincronización segura de órdenes P2P en tiempo real con WebSocket activo
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {apiConfigured ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Conectado</span>
                      {maskedKey && (
                        <span className="font-mono text-slate-300 text-xs border-l border-emerald-500/30 pl-2">
                          {maskedKey}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span>Sin Configurar</span>
                    </div>
                  )}

                  {apiConfigured && (
                    <button
                      type="button"
                      onClick={handleConnectAndSync}
                      disabled={loading}
                      title="Sincronizar órdenes nuevas ahora"
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                      <span>{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario Compacto de API Key & Secret */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Llaves de Acceso Local (HMAC-SHA256)</span>
                  {apiConfigured && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowKeyForm(!showKeyForm)}
                        className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        {showKeyForm ? 'Ocultar campos' : 'Modificar llaves'}
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        onClick={handleDisconnectApi}
                        disabled={loading}
                        className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        Desvincular
                      </button>
                    </div>
                  )}
                </div>

                {(showKeyForm || !apiConfigured) && (
                  <div className="space-y-3 pt-1 animate-fadeIn">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Binance API Key <span className="text-slate-500 font-normal">(Permiso: Solo Lectura)</span>
                        </label>
                        <button
                          type="button"
                          onClick={handlePasteKey}
                          className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleConnectAndSync}
                        disabled={loading || !canSubmit}
                        className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading ? 'Guardando...' : 'Guardar Llaves y Sincronizar'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Almacenamiento 100% local en tu disco con permisos 0600. Nunca actives retiros ni trading spot en Binance.
                  </span>
                </div>
              </div>

              {/* Selector de Frecuencia de Sincronización Automática */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Frecuencia de Polling en Segundo Plano
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        Intervalo para refrescar órdenes (se acelera automáticamente a 10s si hay trades activos)
                      </span>
                    </div>
                  </div>

                  {syncIntervalSeconds > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Activo ({syncIntervalSeconds >= 60 ? `${syncIntervalSeconds / 60}m` : `${syncIntervalSeconds}s`})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-400">
                      <span>Solo manual</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  {[
                    { label: 'Desactivado', val: 0, desc: 'Solo manual' },
                    { label: '15 seg', val: 15, desc: 'Rápido' },
                    { label: '30 seg', val: 30, desc: 'Activo' },
                    { label: '60 seg', val: 60, desc: 'Recomendado' },
                    { label: '2 min', val: 120, desc: 'Bajo consumo' },
                    { label: '5 min', val: 300, desc: 'Reposo' },
                  ].map((opt) => {
                    const isSelected = syncIntervalSeconds === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => onUpdateSyncInterval && onUpdateSyncInterval(opt.val)}
                        className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-bold block">{opt.label}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                  {onNavigateTreasury && (
                    <button
                      type="button"
                      onClick={onNavigateTreasury}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <span>Ir a Tesorería y Cuentas Bancarias</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
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
              <button
                type="button"
                onClick={() => onToggleSound && onToggleSound(!soundEnabled)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  soundEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Sonido Activado</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                    <span>Sonido Silenciado</span>
                  </>
                )}
              </button>
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
                  <button
                    type="button"
                    onClick={() => playNewTradeSound(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Volume2 className="h-3 w-3 text-amber-400" />
                    <span>Probar Tono</span>
                  </button>
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
                  <button
                    type="button"
                    onClick={() => playCompletedTradeSound(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <Volume2 className="h-3 w-3 text-emerald-400" />
                    <span>Probar Tono</span>
                  </button>
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
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      Activo
                    </span>
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
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      Activo
                    </span>
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
                    <span className="rounded-md border border-sky-500/30 bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
                      Activo
                    </span>
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
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      Activo
                    </span>
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

          {/* Bloque 3: Mensajes Emergentes y Toasts */}
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
              <button
                type="button"
                onClick={() => onToggleToasts && onToggleToasts(!toastsEnabled)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  toastsEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {toastsEnabled ? 'Mensajes Activos' : 'Silenciados'}
              </button>
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

      {/* 4. SECCIÓN MANTENIMIENTO Y DIAGNÓSTICO (GRID Y ZONA CRÍTICA SEPARADA) */}
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
                      <p className="text-xs text-slate-400">
                        Generación de órdenes simuladas para evaluar cálculos contables
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    Modo Seguro
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-400 space-y-2">
                  <p className="leading-relaxed">
                    Este módulo genera operaciones simuladas de Compra y Venta con tasas representativas del mercado venezolano para verificar los cálculos de costo promedio ponderado (WAC), margen de ganancia diaria y cuadres de saldo bancario.
                  </p>
                  <p className="text-xs text-slate-500">
                    • Las órdenes de prueba se etiquetan automáticamente como 'DEMO' y se pueden eliminar en cualquier momento sin afectar tus órdenes reales importadas por API.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Cargar Operaciones Demo</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearDemo}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
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
                      <p className="text-xs text-slate-400">
                        Estado operativo de los servicios internos
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    Sistema En Línea
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-xs text-slate-500 block">Servidor API</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">FastAPI (Python 3)</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-xs text-slate-500 block">Interfaz de Usuario</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">Vite + React 18</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-xs text-slate-500 block">Motor de Datos</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">SQLite 3 (Local)</span>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <span className="text-xs text-slate-500 block">Frecuencia Auto-Sync</span>
                    <span className="font-semibold text-emerald-400 mt-0.5 block">
                      {syncIntervalSeconds > 0 ? `Cada ${syncIntervalSeconds}s` : 'Manual'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500">
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
                  <p className="text-xs text-slate-400">
                    Restablece la base de datos local y limpia todos los registros
                  </p>
                </div>
              </div>
              <span className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
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
                className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>Vaciar Base de Datos por Completo</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
