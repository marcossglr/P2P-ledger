import React, { useEffect, useState } from 'react';
import {
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Activity,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';

const inputCls =
  'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors';

const fmt = (v, digits = 2) =>
  v === null || v === undefined
    ? '—'
    : Number(v).toLocaleString('es-VE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const COMMON_BANKS = [
  'PagoMovil',
  'Banesco',
  'Mercantil',
  'Provincial',
  'Bancamiga',
  'Venezuela',
  'Bancaribe',
  'BNC',
];

/**
 * Tarjeta de configuración de la API pública P2P de Binance (sin credenciales),
 * para obtener cotizaciones y estadísticas del mercado P2P en tiempo real.
 */
export default function BinanceP2PPublicApiCard() {
  const [form, setForm] = useState({
    enabled: true,
    asset: 'USDT',
    fiat: 'VES',
    pay_types: '',
    trans_amount: '',
    rows: 20,
    pages: 1,
    publisher_type: '',
    top_n: 5,
  });
  const [updatedAt, setUpdatedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const applyConfig = (cfg) => {
    setForm({
      enabled: Boolean(cfg.enabled),
      asset: cfg.asset || 'USDT',
      fiat: cfg.fiat || 'VES',
      pay_types: (cfg.pay_types || []).join(', '),
      trans_amount: cfg.trans_amount ?? '',
      rows: cfg.rows ?? 20,
      pages: cfg.pages ?? 1,
      publisher_type: cfg.publisher_type || '',
      top_n: cfg.top_n ?? 5,
    });
    setUpdatedAt(cfg.updated_at || null);
  };

  useEffect(() => {
    fetch('/api/binance/p2p-public/config')
      .then((r) => r.json())
      .then(applyConfig)
      .catch(() => setError('No se pudo cargar la configuración de la API pública P2P.'));
  }, []);

  const buildPayload = () => ({
    enabled: form.enabled,
    asset: form.asset.trim().toUpperCase(),
    fiat: form.fiat.trim().toUpperCase(),
    pay_types: form.pay_types
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    trans_amount: form.trans_amount === '' ? null : Number(form.trans_amount),
    rows: Number(form.rows),
    pages: Number(form.pages),
    publisher_type: form.publisher_type || null,
    top_n: Number(form.top_n),
  });

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleBankChip = (bankName) => {
    const currentBanks = form.pay_types
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    const exists = currentBanks.some((b) => b.toLowerCase() === bankName.toLowerCase());
    let nextBanks;
    if (exists) {
      nextBanks = currentBanks.filter((b) => b.toLowerCase() !== bankName.toLowerCase());
    } else {
      nextBanks = [...currentBanks, bankName];
    }
    setForm((prev) => ({ ...prev, pay_types: nextBanks.join(', ') }));
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/binance/p2p-public/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al guardar la configuración');
      applyConfig(data);
      setMessage('Configuración de la API pública P2P guardada exitosamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/binance/p2p-public/config', { method: 'DELETE' });
      applyConfig(await res.json());
      setTestResult(null);
      setMessage('Configuración restablecida a los valores por defecto.');
    } catch {
      setError('Error al restablecer la configuración.');
    }
  };

  const handleTest = async () => {
    setError(null);
    setMessage(null);
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/binance/p2p-public/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al probar la conexión');
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const currentPayTypesList = form.pay_types
    .split(',')
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Cabecera y Switch de Activación */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <Globe className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white">API Pública P2P (Libro de Ofertas)</h4>
              <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                Sin Credenciales
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Consulta anuncios en vivo para estimar el spread y las cotizaciones del mercado
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-700 transition-colors">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={handleChange('enabled')}
            className="h-4 w-4 accent-amber-500 rounded cursor-pointer"
          />
          <span>{form.enabled ? 'Sondeo Activo' : 'Deshabilitado'}</span>
        </label>
      </div>

      {/* Aviso informativo sobrio */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="leading-relaxed">
          Consulta directamente el endpoint público de Binance P2P (<code className="font-mono text-slate-300">adv/search</code>).
          No requiere API Key y se utiliza para calcular las mejores tasas de compra/venta y el spread en tiempo real de la plaza.
        </div>
      </div>

      {/* Parámetros de Mercado */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            Parámetros del Par y Mercado
          </span>
          {updatedAt && (
            <span className="text-[10px] text-slate-500 tabular-nums">
              Guardado: {new Date(updatedAt).toLocaleTimeString('es-VE')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Criptoactivo</label>
            <input
              value={form.asset}
              onChange={handleChange('asset')}
              placeholder="USDT"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Moneda Fiat</label>
            <input
              value={form.fiat}
              onChange={handleChange('fiat')}
              placeholder="VES"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Monto Mínimo (Fiat)</label>
            <input
              type="number"
              min="0"
              value={form.trans_amount}
              onChange={handleChange('trans_amount')}
              placeholder="Ej: 500 (Opcional)"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Anunciante</label>
            <select
              value={form.publisher_type}
              onChange={handleChange('publisher_type')}
              className={inputCls}
            >
              <option value="">Todos los usuarios</option>
              <option value="merchant">Solo comerciantes verificados</option>
            </select>
          </div>
        </div>

        {/* Métodos de Pago con Chips Rápidos */}
        <div className="space-y-2 border-t border-slate-800/80 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-300">
              Métodos de Pago Filtrados
            </label>
            <span className="text-[10px] text-slate-500">
              (Vacío = consultar todos los bancos)
            </span>
          </div>

          <input
            value={form.pay_types}
            onChange={handleChange('pay_types')}
            placeholder="PagoMovil, Banesco, Mercantil..."
            className={inputCls}
          />

          {/* Chips de selección rápida */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" /> Atajos:
            </span>
            {COMMON_BANKS.map((bank) => {
              const active = currentPayTypesList.includes(bank.toLowerCase());
              return (
                <button
                  key={bank}
                  type="button"
                  onClick={() => toggleBankChip(bank)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                    active
                      ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                      : 'border border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {active ? `✓ ${bank}` : `+ ${bank}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Muestreo y WAP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800/80 pt-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Filas por Página <span className="text-slate-500 font-normal">(máx. 20)</span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={form.rows}
              onChange={handleChange('rows')}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Páginas de Sondeo <span className="text-slate-500 font-normal">(máx. 10)</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.pages}
              onChange={handleChange('pages')}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Top N para Promedio <span className="text-slate-500 font-normal">(WAP)</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={form.top_n}
              onChange={handleChange('top_n')}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Resultado de la prueba en tiempo real */}
      {testResult && (
        <div
          className={`rounded-xl border p-4 text-xs transition-all ${
            testResult.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          {testResult.ok ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Respuesta Exitosa de Binance P2P</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Par: <strong className="text-white">{testResult.asset}/{testResult.fiat}</strong></span>
                  <span>Latencia: <strong className="text-white">{testResult.latency_ms} ms</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5">
                  <span className="block text-[11px] text-slate-400 font-medium">Mejor Compra (BUY)</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-white">{fmt(testResult.best_buy)}</span>
                    <span className="text-[10px] text-slate-400">Bs</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{testResult.buy_ads} anuncios evaluados</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5">
                  <span className="block text-[11px] text-slate-400 font-medium">Mejor Venta (SELL)</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-white">{fmt(testResult.best_sell)}</span>
                    <span className="text-[10px] text-slate-400">Bs</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{testResult.sell_ads} anuncios evaluados</span>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-2.5">
                  <span className="block text-[11px] text-slate-400 font-medium">Spread de Mercado</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-emerald-400">{fmt(testResult.spread?.absolute)}</span>
                    <span className="text-[10px] text-emerald-300/80">({fmt(testResult.spread?.percent, 2)}%)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Diferencial compra/venta</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>Fallo al conectar con el endpoint público: {testResult.error}</span>
            </div>
          )}
        </div>
      )}

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

      {/* Botones de Acción */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            <Activity className={`h-4 w-4 text-slate-300 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Consultando Binance...' : 'Probar Consulta en Vivo'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Restablecer Valores</span>
        </button>
      </div>
    </div>
  );
}
