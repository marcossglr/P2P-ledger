import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Plus,
} from 'lucide-react';
import BankAccountFormModal from './BankAccountFormModal';

export default function BankReconcileModal({
  isOpen,
  onClose,
  accounts = [],
  initialAccountId = null,
  onSuccess,
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [mode, setMode] = useState('CUADRE_CONSOLIDADO'); // 'CUADRE_CONSOLIDADO' | 'MOVIMIENTO_MANUAL'
  const [manualSign, setManualSign] = useState('MINUS'); // 'PLUS' | 'MINUS'
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  // Inicializar estado al abrir el modal
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setNoteInput('');
    setMode('CUADRE_CONSOLIDADO');
    setManualSign('MINUS');

    const targetAcc =
      accounts.find((a) => Number(a.id) === Number(initialAccountId)) ||
      accounts.find((a) => a.is_default) ||
      accounts[0] ||
      null;

    if (targetAcc) {
      setSelectedAccountId(targetAcc.id);
      setAmountInput(String(targetAcc.calculated_balance ?? '0'));
    } else {
      setAmountInput('');
    }
  }, [isOpen, initialAccountId, accounts]);

  // Soporte para cerrar con tecla Escape (si el sub-modal de añadir banco no está abierto)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isAddBankOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddBankOpen, onClose]);

  if (!isOpen) return null;

  const selectedAccount =
    accounts.find((a) => Number(a.id) === Number(selectedAccountId)) ||
    accounts[0];

  const handleAccountSelect = (accId) => {
    const acc = accounts.find((a) => Number(a.id) === Number(accId));
    setSelectedAccountId(Number(accId));
    setErrorMsg('');
    if (mode === 'CUADRE_CONSOLIDADO') {
      setAmountInput(String(acc?.calculated_balance ?? '0'));
    } else {
      setAmountInput('');
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    if (newMode === 'CUADRE_CONSOLIDADO') {
      setAmountInput(String(selectedAccount?.calculated_balance ?? '0'));
    } else {
      setAmountInput('');
    }
  };

  const fmtBs = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const parsedAmount = parseFloat(String(amountInput).replace(',', '.')) || 0;
  const currentSysBalance = Number(selectedAccount?.calculated_balance || 0);

  // Cálculo de diferencia y nuevo saldo en tiempo real
  let previewNewBalance = currentSysBalance;
  let previewDelta = 0;

  if (mode === 'CUADRE_CONSOLIDADO') {
    previewNewBalance = parsedAmount;
    previewDelta = parsedAmount - currentSysBalance;
  } else if (mode === 'MOVIMIENTO_MANUAL') {
    const signed = manualSign === 'PLUS' ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
    previewNewBalance = currentSysBalance + signed;
    previewDelta = signed;
  }

  // Total consolidado resultante de todos los bancos combinados
  const totalAllBanksBs = accounts.reduce((sum, a) => {
    if (Number(a.id) === Number(selectedAccount?.id)) {
      return sum + previewNewBalance;
    }
    return sum + Number(a.calculated_balance || 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setErrorMsg('');

    let finalAmount = parsedAmount;
    if (mode === 'MOVIMIENTO_MANUAL') {
      if (Math.abs(parsedAmount) <= 0) {
        setErrorMsg('Ingresa un monto mayor a 0,00 Bs para el movimiento manual.');
        return;
      }
      finalAmount = manualSign === 'PLUS' ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bank-inventory/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccount.id,
          mode,
          amount: finalAmount,
          note: noteInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al actualizar el saldo de la cuenta');
      }
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Pinned */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-bold text-white tracking-tight leading-none">
                Cuadre de Cuentas Bancarias
              </h3>
              <p className="text-xs text-slate-400">
                Sincroniza el saldo calculado del sistema con tu banca en línea
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

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="shrink-0 mx-6 mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. Selector de Cuenta en Pills */}
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Selecciona la Cuenta Bancaria
              </span>
              <div className="flex flex-wrap gap-2">
                {accounts.map((acc) => {
                  const isSel = Number(acc.id) === Number(selectedAccount?.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleAccountSelect(acc.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all ${
                        isSel
                          ? 'border border-amber-500/35 bg-amber-500/15 text-amber-200 shadow-xs font-semibold'
                          : 'border border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200 font-medium'
                      }`}
                    >
                      <span>{acc.name}</span>
                      {acc.is_default && (
                        <span
                          className="rounded bg-amber-500/10 border border-amber-500/25 px-1 py-0.5 text-[9px] font-semibold text-amber-300"
                          title="Cuenta principal predeterminada"
                        >
                          Principal
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Botón rápido para registrar un banco nacional del catálogo */}
                <button
                  type="button"
                  onClick={() => setIsAddBankOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer shadow-xs"
                  title="Añadir una nueva cuenta bancaria nacional (BDV, Banesco, Mercantil, etc.)"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" />
                  <span>Añadir Banco</span>
                </button>
              </div>
            </div>

            {/* 2. Tipo de Operación: Saldo Real vs Movimiento */}
            <div className="flex rounded-xl border border-slate-800/80 bg-slate-950/90 p-1 text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('CUADRE_CONSOLIDADO')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'CUADRE_CONSOLIDADO'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                Saldo Real
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('MOVIMIENTO_MANUAL')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'MOVIMIENTO_MANUAL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                Movimiento
              </button>
            </div>

            {/* 3. Tarjeta Principal de Ajuste */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3.5">
              {/* Selector de Signo en caso de Movimiento Manual */}
              {mode === 'MOVIMIENTO_MANUAL' && (
                <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setManualSign('MINUS')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 font-semibold transition-colors ${
                      manualSign === 'MINUS'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'border border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <MinusCircle className="h-3.5 w-3.5" />
                    <span>Restar Salida</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSign('PLUS')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 font-semibold transition-colors ${
                      manualSign === 'PLUS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'border border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Sumar Entrada</span>
                  </button>
                </div>
              )}

              {/* Input Principal */}
              <div>
                {/* <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  {mode === 'CUADRE_CONSOLIDADO'
                    ? `Nuevo saldo real en ${selectedAccount?.name || 'la cuenta'}:`
                    : `Monto a ${manualSign === 'PLUS' ? 'sumar' : 'restar'}:`}
                </label> */}
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 pr-14 tabular-nums text-lg font-bold text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    VES
                  </span>
                </div>
              </div>

              {/* Diferencia / Ajuste resultante en tiempo real */}
              <div
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${
                  Math.abs(previewDelta) < 0.005
                    ? 'border-slate-800 bg-slate-900/60 text-slate-400'
                    : previewDelta > 0.005
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <span className="font-medium text-[11px]">
                  {mode === 'MOVIMIENTO_MANUAL'
                    ? 'Saldo resultante tras movimiento:'
                    : Math.abs(previewDelta) < 0.005
                    ? 'Saldo exacto (sin diferencia)'
                    : previewDelta > 0.005
                    ? 'Ajuste automático (+Sobrante):'
                    : 'Ajuste automático (-Faltante):'}
                </span>
                <span className="tabular-nums text-xs font-bold">
                  {mode === 'MOVIMIENTO_MANUAL'
                    ? `${fmtBs(previewNewBalance)} Bs`
                    : Math.abs(previewDelta) < 0.005
                    ? '0,00 Bs'
                    : `${previewDelta > 0.005 ? '+' : ''}${fmtBs(previewDelta)} Bs`}
                </span>
              </div>
            </div>

            {/* 4. Nota opcional */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Nota o motivo del ajuste (Opcional):
              </label>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ej. Cuadre cierre de turno, gasto externo, comisión bancaria..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Footer Pinned */}
          <div className="shrink-0 flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-5 py-3 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Atajo:</span>
              <kbd className="inline-flex h-5 items-center justify-center rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] text-slate-300 shadow-xs">
                Esc
              </kbd>
              <span className="hidden sm:inline">para salir ·</span>
              <span className="tabular-nums">Total bancos: </span>
              <strong className="text-white font-bold">{fmtBs(totalAllBanksBs)} Bs</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/90 px-4 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                <span>{submitting ? 'Guardando...' : 'Guardar Saldo'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Modal de añadir nueva cuenta bancaria desde el catálogo */}
        <BankAccountFormModal
          isOpen={isAddBankOpen}
          onClose={() => setIsAddBankOpen(false)}
          existingAccounts={accounts}
          onSuccess={(updatedInventory) => {
            if (onSuccess) {
              onSuccess(updatedInventory);
            }
            // Si la cuenta recién creada está disponible, seleccionarla
            const newAccounts = updatedInventory?.accounts || [];
            const lastCreated = newAccounts[newAccounts.length - 1];
            if (lastCreated) {
              setSelectedAccountId(lastCreated.id);
              setAmountInput(String(lastCreated.calculated_balance ?? '0'));
            }
          }}
        />
      </div>
    </div>
  );
}
