import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  Search,
  Check,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Plus,
} from 'lucide-react';

export default function BankAccountFormModal({
  isOpen,
  onClose,
  editingAccount = null,
  existingAccounts = [],
  onSuccess,
}) {
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogBank, setSelectedCatalogBank] = useState(null);

  // Form states
  const [accName, setAccName] = useState('');
  const [accAlias, setAccAlias] = useState('');
  const [accKeywords, setAccKeywords] = useState('');
  const [accIsDefault, setAccIsDefault] = useState(false);
  const [accApplyFee, setAccApplyFee] = useState(true);
  const [accPmFeePct, setAccPmFeePct] = useState(0.3);
  const [accTransfFeePct, setAccTransfFeePct] = useState(0.0);
  const [accInitialBalance, setAccInitialBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cargar catálogo de bancos nacionales
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setCatalogSearch('');

    const fetchCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetch('/api/banks/catalog');
        if (res.ok) {
          const json = await res.json();
          setCatalog(json.banks || []);
        }
      } catch (err) {
        console.error('Error cargando catálogo de bancos:', err);
      } finally {
        setLoadingCatalog(false);
      }
    };

    fetchCatalog();

    if (editingAccount) {
      setAccName(editingAccount.name || '');
      setAccAlias(editingAccount.account_alias || '');
      setAccKeywords(editingAccount.match_keywords || '');
      setAccIsDefault(Boolean(editingAccount.is_default));
      setAccApplyFee(Boolean(editingAccount.apply_buy_fee));
      setAccPmFeePct(Number(editingAccount.pago_movil_fee_pct ?? 0.3));
      setAccTransfFeePct(Number(editingAccount.transfer_fee_pct ?? 0.0));
      setAccInitialBalance('');
      setSelectedCatalogBank(null);
    } else {
      setAccName('');
      setAccAlias('');
      setAccKeywords('');
      setAccIsDefault(existingAccounts.length === 0);
      setAccApplyFee(true);
      setAccPmFeePct(0.3);
      setAccTransfFeePct(0.0);
      setAccInitialBalance('');
      setSelectedCatalogBank(null);
    }
  }, [isOpen, editingAccount, existingAccounts]);

  // Soporte para cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Selección inteligente de un banco del catálogo
  const handleSelectCatalogBank = (b) => {
    setSelectedCatalogBank(b);
    setAccName(b.name);
    setAccAlias(b.alias_template);
    setAccKeywords(b.keywords.join(', '));
    setAccPmFeePct(b.default_pago_movil_fee ?? 0.3);
    setAccTransfFeePct(b.default_transfer_fee ?? 0.0);
    setErrorMsg('');
  };

  // Filtrado de bancos en el catálogo
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const existingNames = new Set(
      existingAccounts.map((a) => (a.name || '').trim().toLowerCase())
    );

    return catalog.map((b) => {
      const isAlreadyAdded = existingNames.has(b.name.toLowerCase());
      const matches =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.code.includes(q) ||
        b.short_name.toLowerCase().includes(q) ||
        b.keywords.some((k) => k.toLowerCase().includes(q));

      return {
        ...b,
        isAlreadyAdded,
        matches,
      };
    }).filter((b) => b.matches);
  }, [catalog, catalogSearch, existingAccounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accName.trim()) {
      setErrorMsg('El nombre del banco es obligatorio.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const isEdit = Boolean(editingAccount);
      const url = isEdit
        ? `/api/bank-inventory/accounts/${editingAccount.id}`
        : '/api/bank-inventory/accounts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accName.trim(),
          account_alias: accAlias.trim(),
          match_keywords: accKeywords.trim() || accName.trim().toLowerCase(),
          is_default: accIsDefault,
          apply_buy_fee: accApplyFee,
          pago_movil_fee_pct: parseFloat(accPmFeePct) || 0,
          transfer_fee_pct: parseFloat(accTransfFeePct) || 0,
          initial_balance: isEdit ? undefined : parseFloat(accInitialBalance) || 0,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Error al guardar la cuenta bancaria.');
      }

      const updatedInventory = await res.json();
      if (onSuccess) {
        onSuccess(updatedInventory);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-bold text-white tracking-tight leading-none">
                {editingAccount
                  ? `Configurar ${editingAccount.name}`
                  : 'Añadir Cuenta Bancaria en Bs'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingAccount
                  ? 'Ajusta alias, palabras clave y comisiones'
                  : 'Selecciona del catálogo nacional o ingresa una cuenta personalizada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar modal (Esc)"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Si es creación nueva: Mostrar Catálogo Oficial de Bancos Nacionales */}
            {!editingAccount && (
              <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Catálogo Nacional de Bancos (SUDEBAN)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    21 bancos disponibles
                  </span>
                </div>

                {/* Buscador de Banco */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Buscar por nombre (ej. Venezuela, BDV, Mercantil) o código..."
                    className="h-8 w-full rounded-xl border border-slate-700/80 bg-slate-900/90 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Grid / Lista compacta de Bancos con Scroll */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredCatalog.map((b) => {
                    const isSelected = selectedCatalogBank?.code === b.code || accName.trim().toLowerCase() === b.name.toLowerCase();
                    const isAlready = b.isAlreadyAdded;

                    return (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => handleSelectCatalogBank(b)}
                        disabled={isAlready}
                        className={`group relative flex flex-col items-start justify-between rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
                          isAlready
                            ? 'border-slate-800/40 bg-slate-950/40 opacity-40 cursor-not-allowed'
                            : isSelected
                            ? 'border-amber-500 bg-amber-500/15 shadow-sm text-white'
                            : 'border-slate-800/80 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-amber-400/90">
                            {b.code}
                          </span>
                          {isAlready ? (
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">Ya creada</span>
                          ) : isSelected ? (
                            <Check className="h-3.5 w-3.5 text-amber-400" />
                          ) : null}
                        </div>
                        <span className="text-xs font-bold leading-tight mt-1 truncate w-full">
                          {b.name}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">
                          {b.short_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Datos Principales de la Cuenta */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre del Banco *
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ej: Banco de Venezuela"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Alias / Titular (Opcional)
                </label>
                <input
                  type="text"
                  value={accAlias}
                  onChange={(e) => setAccAlias(e.target.value)}
                  placeholder="Ej: Cuenta BDV Principal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Palabras clave de vinculación P2P */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Palabras Clave de Vinculación Automática en Binance
                </label>
                <span className="text-[10px] text-slate-500">Separadas por comas</span>
              </div>
              <input
                type="text"
                value={accKeywords}
                onChange={(e) => setAccKeywords(e.target.value)}
                placeholder="venezuela, bdv, bancodevenezuela, pagomovil bdv"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Cualquier orden P2P cuyo método contenga alguno de estos términos se imputará automáticamente a esta cuenta.
              </p>
            </div>

            {/* Saldo Inicial (solo en creación) */}
            {!editingAccount && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1.5">
                <label className="block text-xs font-semibold text-amber-300">
                  Saldo Actual en el Banco (Bs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={accInitialBalance}
                  onChange={(e) => setAccInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold tabular-nums text-white focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  Punto de partida en Bs para tu posición consolidada. Las órdenes completadas desde este momento sumarán o restarán a partir de este monto.
                </p>
              </div>
            )}

            {/* Configuración de Comisiones Bancarias */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Descontar comisión bancaria en órdenes de COMPRA
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Aplica automáticamente al salir Bolívares de tu cuenta
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={accApplyFee}
                  onChange={(e) => setAccApplyFee(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </label>

              {accApplyFee && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Comisión Pago Móvil (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={accPmFeePct}
                      onChange={(e) => setAccPmFeePct(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none tabular-nums"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">0.3% estándar</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Comisión Transferencia (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={accTransfFeePct}
                      onChange={(e) => setAccTransfFeePct(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none tabular-nums"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">0.0% mismo banco</span>
                  </div>
                </div>
              )}
            </div>

            {/* Checkbox Cuenta Principal */}
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={accIsDefault}
                onChange={(e) => setAccIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>
                Establecer como <strong>Cuenta Principal por Defecto</strong> (recibe órdenes genéricas como "PagoMovil")
              </span>
            </label>
          </div>

          {/* Footer Pinned */}
          <div className="shrink-0 flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-5 py-3 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Atajo:</span>
              <kbd className="inline-flex h-5 items-center justify-center rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] text-slate-300 shadow-xs">
                Esc
              </kbd>
              <span className="hidden sm:inline">para salir</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex h-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/90 px-4 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 text-amber-400" />
                    <span>{editingAccount ? 'Actualizar Cuenta' : 'Guardar Cuenta'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
