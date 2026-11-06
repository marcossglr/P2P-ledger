import React, { useState, useEffect, useRef } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  Plus,
} from 'lucide-react';
import BankAccountFormModal from './BankAccountFormModal';
import { bankInventoryApi } from '../services/api';
import { Modal, Button, Input } from './ui';

export default function BankReconcileModal({
  isOpen,
  onClose,
  accounts = [],
  initialAccountId = null,
  hideAccountSelector = false,
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
  const prevIsOpenRef = useRef(false);

  // Inicializar estado únicamente al abrir el modal (evitar reseteos por auto-sync de fondo)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
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
    }
    prevIsOpenRef.current = Boolean(isOpen);
  }, [isOpen, initialAccountId, accounts]);

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
      const data = await bankInventoryApi.reconcileAccount({
        account_id: selectedAccount.id,
        mode,
        amount: finalAmount,
        note: noteInput.trim(),
      });
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reconcileFooter = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span>Total bancos:</span>
        <strong className="text-white font-mono font-bold">{fmtBs(totalAllBanksBs)} Bs</strong>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          form="bank-reconcile-form"
          variant="primary"
          loading={submitting}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={hideAccountSelector && selectedAccount ? `Cuadre · ${selectedAccount.name}` : "Cuadre de Cuentas Bancarias"}
        icon={Scale}
        footer={reconcileFooter}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="bank-reconcile-form" onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Selector de Cuenta en Pills (o indicador si hideAccountSelector es true) */}
          {!hideAccountSelector && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cuenta Bancaria
              </label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((acc) => {
                  const isSel = Number(acc.id) === Number(selectedAccount?.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleAccountSelect(acc.id)}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                        isSel
                          ? 'border border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-xs font-semibold'
                          : 'border border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-slate-100 font-medium'
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
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer shadow-xs"
                  title="Añadir una nueva cuenta bancaria nacional (BDV, Banesco, Mercantil, etc.)"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-400" />
                  <span>Añadir Banco</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Tipo de Operación: Saldo Real vs Movimiento (Segmented Control concéntrico) */}
          <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleModeChange('CUADRE_CONSOLIDADO')}
              className={`flex-1 h-6 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'CUADRE_CONSOLIDADO'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              Saldo Real Auditado
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('MOVIMIENTO_MANUAL')}
              className={`flex-1 h-6 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'MOVIMIENTO_MANUAL'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              Movimiento Manual (±)
            </button>
          </div>

          {/* 3. Bloque Principal de Ajuste */}
          <div className="space-y-2.5">
            {/* Selector de Signo en caso de Movimiento Manual */}
            {mode === 'MOVIMIENTO_MANUAL' && (
              <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setManualSign('MINUS')}
                  className={`flex-1 h-6 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    manualSign === 'MINUS'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs'
                      : 'border border-transparent text-slate-400 hover:text-white font-medium'
                  }`}
                >
                  <MinusCircle className="h-3.5 w-3.5" />
                  <span>Restar Salida (-Bs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualSign('PLUS')}
                  className={`flex-1 h-6 flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    manualSign === 'PLUS'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                      : 'border border-transparent text-slate-400 hover:text-white font-medium'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Sumar Entrada (+Bs)</span>
                </button>
              </div>
            )}

            {/* Input Principal */}
            <Input
              type="number"
              step="0.01"
              required
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="font-mono text-base font-bold tabular-nums"
              rightElement={
                <span className="text-xs font-semibold text-slate-400 font-mono select-none">
                  VES
                </span>
              }
            />

            {/* Saldo de referencia y Diferencia / Ajuste resultante en tiempo real */}
            <div className="space-y-1 px-1 pt-1 text-xs">
              {mode === 'CUADRE_CONSOLIDADO' && (
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Saldo en sistema:</span>
                  <span className="tabular-nums font-mono font-medium text-slate-300">
                    {fmtBs(selectedAccount?.calculated_balance ?? 0)} Bs
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-slate-300">
                  {mode === 'MOVIMIENTO_MANUAL'
                    ? 'Saldo resultante tras movimiento:'
                    : Math.abs(previewDelta) < 0.005
                    ? 'Saldo exacto (sin diferencia)'
                    : previewDelta > 0.005
                    ? 'Ajuste automático (+Sobrante):'
                    : 'Ajuste automático (-Faltante):'}
                </span>
                <span
                  className={`tabular-nums text-xs font-bold font-mono ${
                    mode === 'MOVIMIENTO_MANUAL'
                      ? 'text-slate-200'
                      : Math.abs(previewDelta) < 0.005
                      ? 'text-slate-400'
                      : previewDelta > 0.005
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {mode === 'MOVIMIENTO_MANUAL'
                    ? `${fmtBs(previewNewBalance)} Bs`
                    : Math.abs(previewDelta) < 0.005
                    ? '0,00 Bs'
                    : `${previewDelta > 0.005 ? '+' : ''}${fmtBs(previewDelta)} Bs`}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Nota opcional */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nota (Opcional)
            </label>
            <Input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ej. Cuadre cierre de turno, gasto externo..."
            />
          </div>
        </form>
      </div>
    </Modal>

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
  </>
  );
}
