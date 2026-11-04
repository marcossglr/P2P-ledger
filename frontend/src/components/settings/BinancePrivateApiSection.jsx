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
import { Button, Input, Badge } from '../ui';

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
      if (text) {
        // Sanitizar espacios en blanco, tabulaciones y saltos de línea de la clave
        const clean = text.replace(/[\r\n\t\s]/g, '');
        setApiKey(clean);
      }
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
            <Badge variant="success" dot size="sm">
              <span>Conectado</span>
              {maskedKey && (
                <span className="font-mono text-slate-300 text-xs border-l border-emerald-500/30 pl-2">
                  {maskedKey}
                </span>
              )}
            </Badge>
          ) : (
            <Badge variant="warning" dot size="sm">
              <span>Sin Configurar</span>
            </Badge>
          )}

          {apiConfigured && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={RefreshCw}
              loading={loading}
              onClick={handleConnectAndSync}
              title="Sincronizar órdenes nuevas ahora"
            >
              {loading ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          )}
        </div>
      </div>

      {/* Formulario Compacto de API Key & Secret */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">Llaves de Acceso Local (HMAC-SHA256)</span>
          {apiConfigured && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowKeyForm(!showKeyForm)}
                className="text-amber-400 hover:text-amber-300"
              >
                {showKeyForm ? 'Ocultar campos' : 'Modificar llaves'}
              </Button>
              <span className="text-slate-600 text-xs">·</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDisconnectApi}
                disabled={loading}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Desvincular
              </Button>
            </div>
          )}
        </div>

        {(showKeyForm || !apiConfigured) && (
          <div className="space-y-3 pt-1 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-1.5">
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
              <Input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Pega tu API Key de Binance..."
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Binance Secret Key
              </label>
              <Input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Pega tu Secret Key de Binance..."
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                }
              />
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={RefreshCw}
                loading={loading}
                disabled={!canSubmit}
                onClick={handleConnectAndSync}
              >
                {loading ? 'Guardando...' : 'Guardar Llaves y Sincronizar'}
              </Button>
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
            <Badge variant="success" dot size="sm">
              <span>Activo ({syncIntervalSeconds >= 60 ? `${syncIntervalSeconds / 60}m` : `${syncIntervalSeconds}s`})</span>
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              <span>Solo manual</span>
            </Badge>
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
