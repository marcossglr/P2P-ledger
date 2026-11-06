import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Check,
  Sparkles,
} from 'lucide-react';
import { bankInventoryApi } from '../services/api';
import { Modal, Button, Input } from './ui';

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
  const [accBankCode, setAccBankCode] = useState('');
  const [accAccountNumber, setAccAccountNumber] = useState('');
  const [accHolderName, setAccHolderName] = useState('');
  const [accHolderId, setAccHolderId] = useState('');
  const [accPhoneNumber, setAccPhoneNumber] = useState('');
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
        const json = await bankInventoryApi.getCatalog();
        setCatalog(json.banks || []);
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
      setAccBankCode(editingAccount.bank_code || '');
      setAccAccountNumber(editingAccount.account_number || '');
      setAccHolderName(editingAccount.holder_name || '');
      setAccHolderId(editingAccount.holder_id || '');
      setAccPhoneNumber(editingAccount.phone_number || '');
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
      setAccBankCode('');
      setAccAccountNumber('');
      setAccHolderName('');
      setAccHolderId('');
      setAccPhoneNumber('');
      setAccKeywords('');
      setAccIsDefault(existingAccounts.length === 0);
      setAccApplyFee(true);
      setAccPmFeePct(0.3);
      setAccTransfFeePct(0.0);
      setAccInitialBalance('');
      setSelectedCatalogBank(null);
    }
  }, [isOpen, editingAccount, existingAccounts]);

  // Selección inteligente de un banco del catálogo
  const handleSelectCatalogBank = (b) => {
    setSelectedCatalogBank(b);
    setAccName(b.name);
    setAccAlias(b.alias_template || `Cuenta ${b.name}`);
    setAccBankCode(b.code || '');
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
      const payload = {
        name: accName.trim(),
        account_alias: accAlias.trim(),
        bank_code: accBankCode.trim(),
        account_number: accAccountNumber.trim().replace(/\s+/g, ''),
        holder_name: accHolderName.trim(),
        holder_id: accHolderId.trim().toUpperCase(),
        phone_number: accPhoneNumber.trim(),
        match_keywords: accKeywords.trim() || accName.trim().toLowerCase(),
        is_default: accIsDefault,
        apply_buy_fee: accApplyFee,
        pago_movil_fee_pct: parseFloat(accPmFeePct) || 0,
        transfer_fee_pct: parseFloat(accTransfFeePct) || 0,
        initial_balance: isEdit ? undefined : parseFloat(accInitialBalance) || 0,
      };

      const updatedInventory = isEdit
        ? await bankInventoryApi.updateAccount(editingAccount.id, payload)
        : await bankInventoryApi.createAccount(payload);

      if (onSuccess) {
        onSuccess(updatedInventory);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la cuenta bancaria.');
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
        Confirmar
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? `Configurar ${editingAccount.name}` : 'Añadir Cuenta Bancaria'}
      icon={Building2}
      footer={modalFooter}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Error message */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200 shrink-0">
            {errorMsg}
          </div>
        )}

        <form id="bank-account-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-4">
          <div className="flex-1 space-y-4 pr-1 text-xs">
            {/* Si es creación nueva: Mostrar Catálogo Oficial de Bancos Nacionales */}
            {!editingAccount && (
              <div className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Catálogo Nacional de Bancos (SUDEBAN)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredCatalog.length} disponibles
                  </span>
                </div>

                {/* Buscador de Banco */}
                <Input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar banco, sigla o código (ej. BDV, Banesco, 0102)..."
                  icon={Search}
                  size="sm"
                />

                {/* Grid / Lista compacta de Bancos con Scroll */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
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
                            ? 'border-slate-800/40 bg-slate-950/30 opacity-40 cursor-not-allowed'
                            : isSelected
                            ? 'border-amber-500/60 bg-amber-500/15 text-white shadow-xs'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
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
                        <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">
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
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nombre del Banco *
                </label>
                <Input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ej: Banco de Venezuela"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Alias Descriptivo (Opcional)
                </label>
                <Input
                  type="text"
                  value={accAlias}
                  onChange={(e) => setAccAlias(e.target.value)}
                  placeholder="Ej: Cuenta BDV Principal"
                />
              </div>
            </div>

            {/* Datos Detallados de la Cuenta (Número, Titular, CI/RIF, Teléfono) */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                <span>Datos Financieros y Pago Móvil</span>
                <span className="text-[10px] text-slate-500 font-normal">Para conciliar extractos y arqueos</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Código Banco
                  </label>
                  <Input
                    type="text"
                    maxLength={4}
                    value={accBankCode}
                    onChange={(e) => setAccBankCode(e.target.value)}
                    placeholder="0102"
                    className="font-mono text-center"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Número de Cuenta (20 dígitos)
                  </label>
                  <Input
                    type="text"
                    maxLength={23}
                    value={accAccountNumber}
                    onChange={(e) => setAccAccountNumber(e.target.value)}
                    placeholder="0102 0123 45 6789012345"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cédula / RIF
                  </label>
                  <Input
                    type="text"
                    value={accHolderId}
                    onChange={(e) => setAccHolderId(e.target.value)}
                    placeholder="V-12345678"
                    className="font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Teléfono Pago Móvil
                  </label>
                  <Input
                    type="text"
                    value={accPhoneNumber}
                    onChange={(e) => setAccPhoneNumber(e.target.value)}
                    placeholder="04121234567"
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Titular de Cuenta
                  </label>
                  <Input
                    type="text"
                    value={accHolderName}
                    onChange={(e) => setAccHolderName(e.target.value)}
                    placeholder="Nombre y Apellido"
                  />
                </div>
              </div>
            </div>

            {/* Palabras clave de vinculación P2P */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Palabras Clave de Detección Binance P2P
                </label>
                <span className="text-[10px] text-slate-500">Separadas por comas</span>
              </div>
              <Input
                type="text"
                value={accKeywords}
                onChange={(e) => setAccKeywords(e.target.value)}
                placeholder="venezuela, bdv, bancodevenezuela, pagomovil bdv"
              />
            </div>

            {/* Saldo Inicial (solo en creación) */}
            {!editingAccount && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Saldo Inicial en Banco (Bs)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={accInitialBalance}
                  onChange={(e) => setAccInitialBalance(e.target.value)}
                  placeholder="0.00"
                  className="font-mono font-bold tabular-nums"
                  rightElement={
                    <span className="text-xs font-semibold text-slate-400 font-mono select-none">
                      VES
                    </span>
                  }
                />
              </div>
            )}

            {/* Configuración de Comisiones Bancarias */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Descontar comisión bancaria en salidas (Compras P2P)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Aplica automáticamente según el canal de pago
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
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Comisión Pago Móvil (%)
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
                      Comisión Transferencia (%)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={accTransfFeePct}
                      onChange={(e) => setAccTransfFeePct(e.target.value)}
                      className="tabular-nums font-mono"
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
                Establecer como <strong>Cuenta Principal por Defecto</strong>
              </span>
            </label>
          </div>
        </form>
      </div>
    </Modal>
  );
}
