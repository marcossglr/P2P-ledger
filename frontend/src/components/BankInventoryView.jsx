import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Scale,
  Plus,
  Settings2,
  History,
  RefreshCw,
  Trash2,
  Receipt,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import BankReconcileModal from './BankReconcileModal';
import BankMovementsModal from './BankMovementsModal';
import BankAdjustmentsModal from './BankAdjustmentsModal';
import BankAccountFormModal from './BankAccountFormModal';
import { bankInventoryApi } from '../services/api';
import { Button, Badge } from './ui';

export default function BankInventoryView({ refreshTrigger, onInventoryChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cuenta seleccionada en la vista Master-Detail
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Modales de Movimientos e Historial
  const [movementsModal, setMovementsModal] = useState({
    open: false,
    accountId: null,
  });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Modal de Cuadre de Posición Consolidada
  const [reconcileModal, setReconcileModal] = useState({
    open: false,
    accountId: null,
    tab: 'SINGLE',
  });

  // Modal de Crear / Editar Cuenta Bancaria (Comisiones, Nombre, Keywords)
  const [accountFormModal, setAccountFormModal] = useState({
    open: false,
    editingAccount: null,
  });
  const [accName, setAccName] = useState('');
  const [accAlias, setAccAlias] = useState('');
  const [accKeywords, setAccKeywords] = useState('');
  const [accIsDefault, setAccIsDefault] = useState(false);
  const [accApplyFee, setAccApplyFee] = useState(true);
  const [accPmFeePct, setAccPmFeePct] = useState(0.3);
  const [accTransfFeePct, setAccTransfFeePct] = useState(0.0);
  const [accInitialBalance, setAccInitialBalance] = useState(0);
  const [savingAccount, setSavingAccount] = useState(false);
  const [syncingBanks, setSyncingBanks] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const json = await bankInventoryApi.getInventory();
      setData(json);
    } catch (err) {
      console.error('Error cargando inventario bancario en Bs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncBinanceBanks = async () => {
    setSyncingBanks(true);
    try {
      const updated = await bankInventoryApi.syncBinanceMethods();
      setData(updated);
      if (onInventoryChange) {
        onInventoryChange(updated);
      }
    } catch (err) {
      console.error('Error sincronizando métodos de pago de Binance:', err);
    } finally {
      setSyncingBanks(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, refreshTrigger]);

  const openCreateAccountModal = () => {
    setAccName('');
    setAccAlias('');
    setAccKeywords('');
    setAccIsDefault(false);
    setAccApplyFee(true);
    setAccPmFeePct(0.3);
    setAccTransfFeePct(0.0);
    setAccInitialBalance(0);
    setAccountFormModal({ open: true, editingAccount: null });
  };

  const openEditAccountModal = (acc) => {
    setAccName(acc.name);
    setAccAlias(acc.account_alias || '');
    setAccKeywords(acc.match_keywords || acc.name.toLowerCase());
    setAccIsDefault(Boolean(acc.is_default));
    setAccApplyFee(Boolean(acc.apply_buy_fee));
    setAccPmFeePct(acc.pago_movil_fee_pct ?? 0.3);
    setAccTransfFeePct(acc.transfer_fee_pct ?? 0.0);
    setAccInitialBalance(acc.anchor_balance ?? 0);
    setAccountFormModal({ open: true, editingAccount: acc });
  };

  const handleSaveAccountForm = async (e) => {
    e.preventDefault();
    if (!accName.trim()) return;
    setSavingAccount(true);
    try {
      const editing = accountFormModal.editingAccount;
      const payload = {
        name: accName.trim(),
        account_alias: accAlias.trim(),
        match_keywords: accKeywords.trim() || accName.trim().toLowerCase(),
        is_default: accIsDefault,
        apply_buy_fee: accApplyFee,
        pago_movil_fee_pct: parseFloat(accPmFeePct) || 0,
        transfer_fee_pct: parseFloat(accTransfFeePct) || 0,
        initial_balance: editing ? undefined : parseFloat(accInitialBalance) || 0,
      };

      const updated = editing
        ? await bankInventoryApi.updateAccount(editing.id, payload)
        : await bankInventoryApi.createAccount(payload);

      setData(updated);
      setAccountFormModal({ open: false, editingAccount: null });
    } catch (err) {
      console.error('Error guardando cuenta bancaria:', err);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (acc) => {
    if (!window.confirm(`¿Eliminar la cuenta bancaria "${acc.name}"?`)) return;
    try {
      const updated = await bankInventoryApi.deleteAccount(acc.id);
      setData(updated);
      if (String(selectedBankFilter) === String(acc.id)) {
        setSelectedBankFilter('ALL');
      }
    } catch (err) {
      console.error('Error eliminando cuenta:', err);
    }
  };

  const handleToggleAccountFee = async (acc) => {
    try {
      const updated = await bankInventoryApi.updateAccount(acc.id, {
        name: acc.name,
        account_alias: acc.account_alias,
        match_keywords: acc.match_keywords,
        is_default: acc.is_default,
        apply_buy_fee: !acc.apply_buy_fee,
        pago_movil_fee_pct: acc.pago_movil_fee_pct,
        transfer_fee_pct: acc.transfer_fee_pct,
      });
      setData(updated);
      if (onInventoryChange) {
        onInventoryChange(updated);
      }
    } catch (err) {
      console.error('Error cambiando comisión de cuenta:', err);
    }
  };

  const handleReassignOrderBank = async (orderId, newBankId) => {
    try {
      const updated = await bankInventoryApi.assignOrder(orderId, Number(newBankId));
      setData(updated);
      if (onInventoryChange) {
        onInventoryChange(updated);
      }
    } catch (err) {
      console.error('Error reasignando banco:', err);
    }
  };

  const consolidated = data?.consolidated || {};
  const accounts = data?.accounts || [];
  const adjustments = data?.adjustments_history || [];

  const currentAccount = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    return accounts.find((a) => String(a.id) === String(selectedAccountId)) || accounts[0];
  }, [accounts, selectedAccountId]);

  const fmtBs = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtUsdt = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-4">
      {/* Cabecera y Barra de Acciones Generales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Cuentas Bancarias en Bolívares
            </h2>
            <Badge variant="default" size="xs">
              {accounts.length}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Administración de cuentas, comisiones de salida, conciliación automática con Binance P2P y auditoría de saldos.
          </p>
        </div>

        {/* Acciones Generales Relevantes */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Detectar Métodos de Binance P2P */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={syncingBanks}
            onClick={handleSyncBinanceBanks}
            title="Lee los métodos de pago de tus anuncios de Binance P2P y los auto-registra aquí"
          >
            <span>{syncingBanks ? 'Detectando...' : 'Detectar de Binance'}</span>
          </Button>

          {/* Bitácora / Historial de Cuadres */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={History}
            onClick={() => setHistoryModalOpen(true)}
            title="Ver la bitácora de cortes, cuadres de auditoría y movimientos manuales"
          >
            <span>Historial ({adjustments.length})</span>
          </Button>
        </div>
      </div>

      {/* Banner de Posición Consolidada Total en Bs (Compacto y sobrio) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60 text-amber-400 shrink-0">
            <Scale className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Saldo Total en Cuentas Bancarias
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold tabular-nums text-white">
                {fmtBs(consolidated.total_calculated_balance_bs)} Bs
              </span>
              <span className="text-xs text-slate-400">
                ≈ <strong className="text-slate-200 font-semibold">{fmtUsdt(consolidated.equivalent_usdt)} USDT</strong> (Tasa WAC {consolidated.ref_wac_rate || 0})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Ventas (+Bs)</div>
            <div className="font-semibold text-emerald-400 tabular-nums">
              +{fmtBs(consolidated.total_inflow_sell_bs)} Bs
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Compras (-Bs)</div>
            <div className="font-semibold text-rose-300 tabular-nums">
              -{fmtBs(consolidated.total_outflow_buy_bs)} Bs
            </div>
          </div>
        </div>
      </div>

      {/* Master-Detail: Columna Izquierda (Lista de Cuentas) / Columna Derecha (Ficha & Configuración) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* Columna Izquierda (5 cols): Master List */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Cuentas Registradas</h3>
              <Badge variant="default" size="xs">
                {accounts.length}
              </Badge>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              icon={Plus}
              onClick={openCreateAccountModal}
            >
              <span>Nueva Cuenta</span>
            </Button>
          </div>

          {accounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No hay cuentas bancarias configuradas.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => {
                const isSelected = currentAccount && String(currentAccount.id) === String(acc.id);
                const isPositive = Number(acc.calculated_balance || 0) >= 0;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-500/40 bg-amber-500/10 shadow-sm'
                        : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {acc.name}
                          </span>
                          {acc.is_default && (
                            <Badge variant="warning" size="xs">
                              Principal
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {acc.account_alias || acc.match_keywords || 'Sin alias'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div
                          className={`text-xs font-bold tabular-nums ${
                            isPositive ? 'text-white' : 'text-rose-400'
                          }`}
                        >
                          {fmtBs(acc.calculated_balance)} Bs
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {acc.total_historical_orders || 0} órdenes
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-600'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
            Selecciona una cuenta para auditar su saldo, ajustar palabras clave de P2P o configurar comisiones.
          </p>
        </div>

        {/* Columna Derecha (7 cols): Detail / Inspector */}
        <div className="lg:col-span-7">
          {currentAccount ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
              {/* Header de la Cuenta Seleccionada */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">
                        {currentAccount.name}
                      </h3>
                      {currentAccount.is_default && (
                        <Badge variant="warning" size="xs">
                          Cuenta Principal
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentAccount.account_alias || 'Sin alias descriptivo asignado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon={Settings2}
                    onClick={() => openEditAccountModal(currentAccount)}
                    title="Editar nombre, alias, palabras clave y comisiones"
                  >
                    <span>Configurar</span>
                  </Button>

                  {accounts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteAccount(currentAccount)}
                      title="Eliminar esta cuenta bancaria"
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Saldo Calculado & Acciones Inmediatas */}
              <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Saldo Calculado en Sistema</span>
                  <span className="text-[11px] tabular-nums text-slate-500">
                    Corte de referencia: {currentAccount.anchor_date_label}
                  </span>
                </div>

                <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                  <span
                    className={`text-3xl font-bold tabular-nums ${
                      Number(currentAccount.calculated_balance || 0) >= 0 ? 'text-white' : 'text-rose-400'
                    }`}
                  >
                    {fmtBs(currentAccount.calculated_balance)} Bs
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={Scale}
                      onClick={() =>
                        setReconcileModal({
                          open: true,
                          accountId: currentAccount.id,
                          tab: 'SINGLE',
                        })
                      }
                    >
                      <span>Cuadrar Saldo</span>
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={Receipt}
                      onClick={() =>
                        setMovementsModal({
                          open: true,
                          accountId: currentAccount.id,
                        })
                      }
                      title="Ver los movimientos detallados de esta cuenta"
                    >
                      <span>Ver Movimientos ({currentAccount.total_historical_orders || 0})</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Auditoría del Saldo desde el Último Cuadre */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-2 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800/60">
                  Ecuación de Auditoría (Desde último cuadre)
                </div>

                <div className="flex justify-between py-1 text-slate-300">
                  <span className="text-slate-400">Saldo Base / Último Cuadre:</span>
                  <span className="font-semibold tabular-nums text-white">
                    {fmtBs(currentAccount.anchor_balance)} Bs
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">
                    + Ventas P2P ({currentAccount.sell_since_anchor_count} ops):
                  </span>
                  <span className="font-semibold tabular-nums text-emerald-400">
                    {Number(currentAccount.inflow_sell_bs || 0) > 0.01 ? '+' : ''}{fmtBs(currentAccount.inflow_sell_bs)} Bs
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-400">
                    - Compras P2P ({currentAccount.buy_since_anchor_count} ops):
                  </span>
                  <span className="font-semibold tabular-nums text-rose-300">
                    {Number(currentAccount.outflow_buy_bs || 0) > 0.01 ? '-' : ''}{fmtBs(currentAccount.outflow_buy_bs)} Bs
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <button
                    type="button"
                    onClick={() => handleToggleAccountFee(currentAccount)}
                    title="Haz clic para activar o desactivar el descuento automático de comisión bancaria en salidas"
                    className="flex items-center gap-1.5 text-left text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        currentAccount.apply_buy_fee ? 'bg-amber-400' : 'bg-slate-600'
                      }`}
                    />
                    <span>
                      - Comisión Salidas (
                      {currentAccount.apply_buy_fee
                        ? `PM ${currentAccount.pago_movil_fee_pct}% activo`
                        : 'Desactivada'}
                      ):
                    </span>
                  </button>
                  <span className="text-slate-300 tabular-nums">
                    {Number(currentAccount.outflow_buy_fees_bs || 0) > 0.01 ? '-' : ''}{fmtBs(currentAccount.outflow_buy_fees_bs)} Bs
                  </span>
                </div>

                {Math.abs(currentAccount.manual_delta_bs || 0) > 0.001 && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">± Movimientos Manuales / Ajustes:</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        Number(currentAccount.manual_delta_bs || 0) > 0.01
                          ? 'text-slate-200'
                          : Number(currentAccount.manual_delta_bs || 0) < -0.01
                          ? 'text-rose-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {Number(currentAccount.manual_delta_bs || 0) > 0.01 ? '+' : ''}
                      {fmtBs(currentAccount.manual_delta_bs)} Bs
                    </span>
                  </div>
                )}
              </div>

              {/* Reglas de Conciliación & Detección P2P */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Reglas de Conciliación Automática
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400">
                    Palabras clave de coincidencia en Binance P2P:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentAccount.match_keywords || '')
                      .split(',')
                      .map((kw) => kw.trim())
                      .filter(Boolean)
                      .map((kw, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-slate-700 bg-slate-800/90 px-2 py-0.5 text-xs font-mono text-slate-200"
                        >
                          {kw}
                        </span>
                      ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Las órdenes de Binance P2P cuyo método de pago contenga estas palabras se asociarán automáticamente a esta cuenta.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Comisión Pago Móvil:</span>
                    <p className="font-semibold text-slate-200 mt-0.5">
                      {currentAccount.pago_movil_fee_pct ?? 0.3}%
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Comisión Transferencia:</span>
                    <p className="font-semibold text-slate-200 mt-0.5">
                      {currentAccount.transfer_fee_pct ?? 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              Selecciona una cuenta en la lista de la izquierda para ver su configuración y auditoría.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Movimientos de Órdenes P2P */}
      <BankMovementsModal
        isOpen={movementsModal.open}
        onClose={() => setMovementsModal({ open: false, accountId: null })}
        initialAccountId={movementsModal.accountId}
        accounts={accounts}
        onReassignOrderBank={handleReassignOrderBank}
      />

      {/* Modal de Bitácora de Cuadres y Ajustes */}
      <BankAdjustmentsModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        adjustments={adjustments}
        accounts={accounts}
      />

      {/* Modal de Cuadre Manual de Posición */}
      <BankReconcileModal
        isOpen={reconcileModal.open}
        onClose={() => setReconcileModal((prev) => ({ ...prev, open: false }))}
        accounts={accounts}
        initialAccountId={reconcileModal.accountId}
        hideAccountSelector={true}
        onSuccess={(updatedData) => setData(updatedData)}
      />

      {/* Modal para Crear / Configurar Cuenta Bancaria */}
      <BankAccountFormModal
        isOpen={accountFormModal.open}
        onClose={() => setAccountFormModal({ open: false, editingAccount: null })}
        editingAccount={accountFormModal.editingAccount}
        existingAccounts={accounts}
        onSuccess={(updatedData) => {
          setData(updatedData);
          setAccountFormModal({ open: false, editingAccount: null });
        }}
      />
    </div>
  );
}
