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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header Pinned */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Conexión API de Binance P2P</h2>
              <p className="text-xs text-slate-400">
                Sincronización de órdenes (normal: solo lo nuevo; completa: 180 días)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:border-slate-700 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleConnectAndSync} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Security Notice */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <span className="font-semibold text-emerald-300">Privacidad 100% Local:</span> Tus llaves se guardan
                únicamente en tu disco Linux (<code className="text-slate-200">0600</code>) y descargan automáticamente
                tus órdenes P2P de los <strong>últimos 180 días (6 meses)</strong>. Usa una API Key de{' '}
                <strong>Solo Lectura (Enable Reading)</strong>.
              </div>
            </div>

            {/* Credentials Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Estado de Credenciales
                  </p>
                  {apiConfigured ? (
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      API Key activa: <span className="font-mono text-slate-200">{maskedKey}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-400">Ingresa tu API Key para conectar</p>
                  )}
                </div>
                {apiConfigured && (
                  <button
                    type="button"
                    onClick={() => setShowKeyForm(!showKeyForm)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    {showKeyForm ? 'Ocultar' : 'Cambiar API Key'}
                  </button>
                )}
              </div>

              {(showKeyForm || !apiConfigured) && (
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Binance API Key</label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Pega tu API Key de solo lectura..."
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Binance Secret Key</label>
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Pega tu Secret Key..."
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Fallback: Historical CSV Import */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-2.5 text-xs text-slate-400">
              <span>¿Operaciones anteriores a 6 meses?</span>
              <label className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-200 hover:text-amber-400 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                <span>Importar CSV histórico</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleCsvFallback(e.target.files?.[0])}
                />
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{message}</span>
              </div>
            )}
          </div>

          {/* Pinned Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950/90 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>
                {loading
                  ? 'Sincronizando...'
                  : apiConfigured && !apiKey.trim()
                  ? 'Sincronizar órdenes nuevas'
                  : 'Conectar y Sincronizar'}
              </span>
            </button>
            {apiConfigured && !apiKey.trim() && (
              <button
                type="button"
                onClick={(ev) => handleConnectAndSync(ev, true)}
                disabled={loading}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                Completa (180 días)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
