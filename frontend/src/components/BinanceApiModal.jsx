import React, { useState } from 'react';
import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { binanceApi, reconciliationApi } from '../services/api';
import { Modal, Button, Input, Badge } from './ui';

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

      const data = await binanceApi.syncOrders(payload);

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
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor selecciona un archivo con extensión .csv válido.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('El archivo CSV excede el tamaño máximo permitido (25 MB).');
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await reconciliationApi.uploadBinanceCsv(formData);
      setMessage(`CSV importado correctamente: ${data.valid_rows} órdenes agregadas a la base de datos.`);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = apiConfigured || (apiKey.trim().length > 0 && apiSecret.trim().length > 0);

  const binanceModalFooter = (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onClose}
      >
        Cerrar
      </Button>
      {apiConfigured && !apiKey.trim() && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={(ev) => handleConnectAndSync(ev, true)}
        >
          Completa (180d)
        </Button>
      )}
      <Button
        type="submit"
        form="binance-api-form"
        variant="primary"
        size="sm"
        icon={RefreshCw}
        loading={loading}
        disabled={!canSubmit}
      >
        <span>
          {loading
            ? 'Sincronizando...'
            : apiConfigured && !apiKey.trim()
            ? 'Sincronizar órdenes nuevas'
            : 'Conectar y Sincronizar'}
        </span>
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conexión API Binance P2P"
      icon={KeyRound}
      footer={binanceModalFooter}
      maxWidth="max-w-lg"
    >
      <form id="binance-api-form" onSubmit={handleConnectAndSync} className="space-y-4">
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
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="success" dot size="xs">
                    API Key activa
                  </Badge>
                  <span className="font-mono text-slate-200 text-xs">{maskedKey}</span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-amber-400">Ingresa tu API Key para conectar</p>
              )}
            </div>
            {apiConfigured && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowKeyForm(!showKeyForm)}
                className="text-amber-400 hover:text-amber-300"
              >
                {showKeyForm ? 'Ocultar' : 'Cambiar API Key'}
              </Button>
            )}
          </div>

          {(showKeyForm || !apiConfigured) && (
            <div className="space-y-3 border-t border-slate-800/80 pt-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Binance API Key
                </label>
                <Input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Pega tu API Key de solo lectura..."
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Binance Secret Key
                </label>
                <Input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Pega tu Secret Key..."
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Alternativa CSV */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-400">
          <span>¿Operaciones anteriores a 6 meses?</span>
          <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-300 hover:text-amber-300 transition-colors">
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
      </form>
    </Modal>
  );
}
