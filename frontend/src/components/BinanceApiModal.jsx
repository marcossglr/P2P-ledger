import React, { useState } from 'react';
import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';

export default function BinanceApiModal({
  isOpen,
  onClose,
  apiConfigured,
  maskedKey,
  onSyncComplete,
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showKeyForm, setShowKeyForm] = useState(!apiConfigured);

  if (!isOpen) return null;

  const handleConnectAndSync = async (e, forceFull = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const hasNewKeys = Boolean(apiKey.trim() && apiSecret.trim());
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
        `Sincronización ${data.sync_mode === 'INCREMENTAL' ? 'incremental' : 'completa de 180 días'} completada: ${data.fetched_count} órdenes verificadas (${data.new_orders} nuevas).`
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

  const canSubmit = apiConfigured || (apiKey.trim().length > 0 && apiSecret.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      {/* Contenedor del Modal con Estándar Design System */}
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/90 text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera Estándar */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800/80 p-5 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                Conexión API Binance P2P
              </h3>
              <p className="text-[11px] text-slate-400">
                Sincronización automatizada de transacciones y libro de órdenes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Formulario y Cuerpo con Scroll Limpio */}
        <form onSubmit={handleConnectAndSync} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Aviso de Privacidad / Seguridad */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <span className="font-semibold text-emerald-300">Privacidad 100% Local:</span> Tus llaves se almacenan
                únicamente en tu disco local con permisos restringidos. Solo se requiere una API Key con permiso de{' '}
                <strong className="text-white">Lectura (Enable Reading)</strong>.
              </div>
            </div>

            {/* Caja de Estado de Credenciales */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Estado de Credenciales
                  </p>
                  {apiConfigured ? (
                    <p className="mt-1 flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      API Key activa: <span className="font-mono text-slate-200">{maskedKey}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-400">Ingresa tu API Key para conectar</p>
                  )}
                </div>
                {apiConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowKeyForm(!showKeyForm)}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
                  >
                    {showKeyForm ? 'Ocultar' : 'Cambiar API Key'}
                  </button>
                )}
              </div>

              {(showKeyForm || !apiConfigured) && (
                <div className="space-y-3 border-t border-slate-800/80 pt-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Binance API Key
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Pega tu API Key de solo lectura..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Binance Secret Key
                    </label>
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Pega tu Secret Key..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Alternativa CSV */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-400">
              <span>¿Operaciones anteriores a 6 meses?</span>
              <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-300 hover:text-amber-400 transition-colors">
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                <span>Importar CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleCsvFallback(e.target.files?.[0])}
                />
              </label>
            </div>

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
          </div>

          {/* Footer de Acciones Estándar */}
          <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-800/80 bg-slate-950/60 p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {apiConfigured && !apiKey.trim() && (
              <button
                type="button"
                onClick={(ev) => handleConnectAndSync(ev, true)}
                disabled={loading}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                Completa (180d)
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>
                {loading
                  ? 'Sincronizando...'
                  : apiConfigured && !apiKey.trim()
                  ? 'Sincronizar órdenes nuevas'
                  : 'Conectar y Sincronizar'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
