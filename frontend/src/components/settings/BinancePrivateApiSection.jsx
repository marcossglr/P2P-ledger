import React, { useState } from 'react';
import {
  KeyRound,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Clock,
} from 'lucide-react';
import { binanceApi } from '../../services/api';

export default function BinancePrivateApiSection({
  health = {},
  syncIntervalSeconds = 60,
  onChangeSyncInterval,
  onSyncComplete,
  setMessage,
  setError,
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(!health.binance_api_configured);

  const apiConfigured = Boolean(health.binance_api_configured);
  const maskedKey = health.masked_api_key || '';
  const canSubmit = Boolean(apiKey.trim() && apiSecret.trim());

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKey(text.trim());
    } catch {
      // Ignorar restricciones de portapapeles
    }
  };

  const handleConnectAndSync = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setLoading(true);

    try {
      if (canSubmit) {
        await binanceApi.saveConfig(apiKey.trim(), apiSecret.trim());
        if (setMessage) setMessage('Credenciales de Binance guardadas localmente.');
      }

      const syncResult = await binanceApi.syncOrders({ force_full_90d: false });
      if (setMessage) {
        setMessage(
          `Sincronización finalizada: ${syncResult.new_orders || 0} nuevas órdenes.`
        );
      }
      setApiKey('');
      setApiSecret('');
      setShowKeyForm(false);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al conectar con Binance API');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectApi = async () => {
    if (!window.confirm('¿Desvincular llaves de Binance? El historial guardado no se borrará.')) {
      return;
    }
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setLoading(true);
    try {
      await binanceApi.deleteConfig();
      if (setMessage) setMessage('Credenciales desvinculadas correctamente.');
      setShowKeyForm(true);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al desvincular credenciales');
    } finally {
      setLoading(false);
    }
  };

  return (
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
          ].map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => onChangeSyncInterval && onChangeSyncInterval(opt.val)}
              className={`rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                syncIntervalSeconds === opt.val
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-xs'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span className="text-xs font-bold block">{opt.label}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
