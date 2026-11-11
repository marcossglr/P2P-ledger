import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { bankInventoryApi } from '../../services/api';
import { Modal, Button, Input, Checkbox, Badge } from '../ui';

export default function BankAccountFormModal({
  isOpen,
  onClose,
  editingAccount = null,
  onSuccess,
}) {
  const [accAlias, setAccAlias] = useState('');
  const [accKeywords, setAccKeywords] = useState('');
  const [accIsDefault, setAccIsDefault] = useState(false);
  const [accApplyFee, setAccApplyFee] = useState(true);
  const [accPmFeePct, setAccPmFeePct] = useState(0.3);
  const [accTransfFeePct, setAccTransfFeePct] = useState(0.0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');

    if (editingAccount) {
      setAccAlias(editingAccount.account_alias || editingAccount.name || '');
      setAccKeywords(editingAccount.match_keywords || '');
      setAccIsDefault(Boolean(editingAccount.is_default));
      setAccApplyFee(Boolean(editingAccount.apply_buy_fee));
      setAccPmFeePct(Number(editingAccount.pago_movil_fee_pct ?? 0.3));
      setAccTransfFeePct(Number(editingAccount.transfer_fee_pct ?? 0.0));
    }
  }, [isOpen, editingAccount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;

    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        name: editingAccount.name,
        binance_pay_id: editingAccount.binance_pay_id || '',
        pay_method_identifier: editingAccount.pay_method_identifier || '',
        fiat_currency: editingAccount.fiat_currency || 'VES',
        account_alias: accAlias.trim() || editingAccount.name,
        match_keywords: accKeywords.trim() || editingAccount.name.toLowerCase(),
        is_default: accIsDefault,
        apply_buy_fee: accApplyFee,
        pago_movil_fee_pct: parseFloat(accPmFeePct) || 0,
        transfer_fee_pct: parseFloat(accTransfFeePct) || 0,
      };

      const updatedInventory = await bankInventoryApi.updateAccount(editingAccount.id, payload);

      if (onSuccess) {
        onSuccess(updatedInventory);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la configuración de la cuenta.');
    } finally {
      setSaving(false);
    }
  };

  const modalFooter = (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form="bank-account-form"
        variant="primary"
        loading={saving}
      >
        Guardar Cambios
      </Button>
    </div>
  );

  if (!editingAccount) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configurar ${editingAccount.name}`}
      icon={Building2}
      footer={modalFooter}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200 shrink-0">
            {errorMsg}
          </div>
        )}

        <form id="bank-account-form" onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Identidad Oficial Binance (Simetría 100%) */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {editingAccount.name}
                  </span>
                  <Badge variant="warning" size="xs">
                    {editingAccount.fiat_currency || 'VES'}
                  </Badge>
                  {editingAccount.is_default && (
                    <Badge variant="warning" size="xs">
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID Binance: #{editingAccount.binance_pay_id || 'N/A'} · Canal: {editingAccount.pay_method_identifier || editingAccount.name}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Alias Operativo de Trabajo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Alias de la Cuenta
              </label>
              <span className="text-[10px] text-slate-500">Nombre corto en pantalla</span>
            </div>
            <Input
              type="text"
              value={accAlias}
              onChange={(e) => setAccAlias(e.target.value)}
              placeholder="Ej: Cuenta Principal, Caja Chica..."
            />
          </div>

          {/* 3. Comisiones Bancarias en Salidas (Compras P2P) */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-3">
            <Checkbox
              checked={accApplyFee}
              onChange={setAccApplyFee}
              label="Descontar comisión bancaria en Compras P2P"
              description="Aplica porcentaje según si la salida es interbancaria (Pago Móvil) o mismo banco"
            />

            {accApplyFee && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Comisión Pago Móvil / Interbancaria (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={accPmFeePct}
                    onChange={(e) => setAccPmFeePct(e.target.value)}
                    className="tabular-nums font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">0.3% estándar</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Comisión Mismo Banco / Directa (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={accTransfFeePct}
                    onChange={(e) => setAccTransfFeePct(e.target.value)}
                    className="tabular-nums font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">0.0% estándar</span>
                </div>
              </div>
            )}
          </div>

          {/* 5. Cuenta Principal Predeterminada */}
          <Checkbox
            checked={accIsDefault}
            onChange={setAccIsDefault}
            label={
              <span>
                Marcar como <strong>Cuenta Principal por Defecto</strong>
              </span>
            }
          />
        </form>
      </div>
    </Modal>
  );
}
