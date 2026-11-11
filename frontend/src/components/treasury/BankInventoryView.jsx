import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Scale,
  Settings2,
  History,
  RefreshCw,
  Receipt,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import BankReconcileModal from '../modals/BankReconcileModal';
import BankMovementsModal from '../modals/BankMovementsModal';
import BankAdjustmentsModal from '../modals/BankAdjustmentsModal';
import BankAccountFormModal from '../modals/BankAccountFormModal';
import { bankInventoryApi } from '../../services/api';
import { Button, Badge } from '../ui';

// Formateador numérico estático de alta velocidad (sin recreación en cada render)
const amountFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtAmount = (n) => amountFormatter.format(Number(n || 0));

export default function BankInventoryView({ isActive = true, refreshTrigger, onInventoryChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDirtyRef = React.useRef(false);

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

  // Modal de Configurar Cuenta Bancaria
  const [accountFormModal, setAccountFormModal] = useState({
    open: false,
    editingAccount: null,
  });

  const [syncingBanks, setSyncingBanks] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const json = await bankInventoryApi.getInventory();
      setData(json);
    } catch (err) {
      console.error('Error cargando inventario bancario:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncBinanceBanks = async () => {
    setSyncingBanks(true);
    setSyncFeedback(null);
    try {
      const updated = await bankInventoryApi.syncBinanceMethods();
      setData(updated);
      if (onInventoryChange) {
        onInventoryChange(updated);
      }
      const meta = updated.sync_meta;
      if (meta) {
        if (meta.created_count > 0) {
          setSyncFeedback({
            type: 'success',
            msg: `Se agregaron ${meta.created_count} cuenta(s): ${meta.created_names.join(', ')}`,
          });
        } else if (meta.detected_count > 0) {
          setSyncFeedback({
            type: 'info',
            msg: `Se detectaron ${meta.detected_count} método(s) de tu perfil (${meta.detected_names.join(', ')}). Ya estaban registradas.`,
          });
        } else {
          setSyncFeedback({
            type: 'neutral',
            msg: 'No se detectaron métodos de pago de VES en tu perfil de Binance.',
          });
        }
      }
    } catch (err) {
      console.error('Error sincronizando métodos de pago de Binance:', err);
      setSyncFeedback({
        type: 'danger',
        msg: err.message || 'Error al conectar con la API de Binance',
      });
    } finally {
      setSyncingBanks(false);
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  };

  useEffect(() => {
    if (!isActive) {
      isDirtyRef.current = true;
      return;
    }
    fetchInventory();
    isDirtyRef.current = false;
  }, [fetchInventory, refreshTrigger, isActive]);

  const openEditAccountModal = (acc) => {
    setAccountFormModal({ open: true, editingAccount: acc });
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

  const accounts = data?.accounts || [];
  const adjustments = data?.adjustments_history || [];

  const currentAccount = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    return accounts.find((a) => String(a.id) === String(selectedAccountId)) || accounts[0];
  }, [accounts, selectedAccountId]);

  // Agrupar movimientos recientes de la cuenta por fecha (YYYY-MM-DD)
  const groupedMovements = useMemo(() => {
    const list = currentAccount?.recent_movements || [];
    if (!list.length) return [];

    const groups = {};
    list.slice(0, 15).forEach((m) => {
      const dateKey = m.order_date ? m.order_date.slice(0, 10) : 'Sin Fecha';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(m);
    });

    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  }, [currentAccount]);

  return (
    <div className="space-y-4">
      {/* Banner de Feedback si se ejecutó detección */}
      {syncFeedback && (
        <div
          className={`flex items-center justify-between rounded-xl px-3.5 py-2 text-xs border transition-all ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : syncFeedback.type === 'danger'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : syncFeedback.type === 'info'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-300'
          }`}
        >
          <span>{syncFeedback.msg}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-slate-400 hover:text-white ml-2 text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Master-Detail: Columna Izquierda (Lista de Cuentas) / Columna Derecha (Ficha & Configuración) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* Columna Izquierda (5 cols): Master List */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Cuentas Vinculadas</h3>
              <Badge variant="default" size="xs">
                {accounts.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="xs"
                icon={RefreshCw}
                loading={syncingBanks}
                onClick={handleSyncBinanceBanks}
                title="Sincronizar métodos de pago registrados en tu cuenta de Binance P2P"
              >
                <span>{syncingBanks ? 'Sincronizando...' : 'Sincronizar'}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                icon={History}
                onClick={() => setHistoryModalOpen(true)}
                title="Ver la bitácora de cortes, cuadres de auditoría y movimientos manuales"
              >
                <span>Historial</span>
              </Button>
            </div>
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
                const isInactive = acc.is_active === false || acc.is_active === 0;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`w-full text-left rounded-xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-500/40 bg-amber-500/10 shadow-sm'
                        : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50 hover:border-slate-700'
                    } ${isInactive ? 'opacity-65' : ''}`}
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
                          <Badge variant="default" size="xs">
                            {acc.fiat_currency || 'VES'}
                          </Badge>
                          {acc.is_default && (
                            <Badge variant="warning" size="xs">
                              Principal
                            </Badge>
                          )}
                          {isInactive && (
                            <Badge variant="neutral" size="xs">
                              Inactiva
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
                          className={`text-xs font-bold font-mono tabular-nums ${
                            isPositive ? 'text-white' : 'text-rose-400'
                          }`}
                        >
                          {fmtAmount(acc.calculated_balance)} {acc.fiat_currency || 'VES'}
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
                      <Badge variant="warning" size="xs">
                        {currentAccount.fiat_currency || 'VES'}
                      </Badge>
                      {currentAccount.is_default && (
                        <Badge variant="warning" size="xs">
                          Cuenta Principal
                        </Badge>
                      )}
                      {(currentAccount.is_active === false || currentAccount.is_active === 0) && (
                        <Badge variant="neutral" size="xs">
                          Inactiva
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
                    {fmtAmount(currentAccount.calculated_balance)} {currentAccount.fiat_currency || 'VES'}
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

              {/* Lista de Movimientos Recientes de Esta Cuenta */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
                {(!groupedMovements || groupedMovements.length === 0) ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No hay movimientos registrados para esta cuenta.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupedMovements.map(({ date, items }) => (
                      <div key={date} className="space-y-1.5">
                        {/* Cabecera de Fecha del Grupo */}
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[11px] font-mono font-bold text-amber-400/90 tracking-wider">
                            {date}
                          </span>
                          <span className="h-px flex-1 bg-slate-800/80" />
                          <span className="text-[10px] text-slate-500 font-medium">
                            {items.length} {items.length === 1 ? 'operación' : 'operaciones'}
                          </span>
                        </div>

                        {/* Lista con alto consistente (h-10) por fila */}
                        <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden">
                          {items.map((m) => {
                            const isSell = m.order_type === 'VENTA';
                            const fiatSymbol = currentAccount.fiat_currency || 'VES';
                            const timeStr = m.order_date && m.order_date.length >= 16 ? m.order_date.slice(11, 16) : '--:--';

                            return (
                              <div
                                key={m.order_id}
                                className="flex h-10 items-center justify-between px-3.5 hover:bg-slate-900/60 transition-colors gap-3"
                              >
                                {/* Izquierda: Indicador compacto + Tipo + Orden + Contraparte */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 ${
                                      isSell
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    }`}
                                  >
                                    {isSell ? (
                                      <ArrowDownLeft className="h-3.5 w-3.5" />
                                    ) : (
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 min-w-0">
                                    <Badge
                                      variant={isSell ? 'success' : 'danger'}
                                      size="xs"
                                      className="font-bold uppercase tracking-wider shrink-0"
                                    >
                                      {isSell ? 'Venta' : 'Compra'}
                                    </Badge>
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      #{m.order_number ? m.order_number.slice(-6) : m.order_id}
                                    </span>
                                    <span className="text-slate-700 hidden sm:inline">·</span>
                                    <span className="text-xs text-slate-300 truncate font-medium max-w-[140px] sm:max-w-[200px]">
                                      {m.counterparty || 'Contraparte anónima'}
                                    </span>
                                    <span className="text-slate-700 hidden sm:inline">·</span>
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      {timeStr}
                                    </span>
                                  </div>
                                </div>

                                {/* Derecha: Monto con alto fijo */}
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  {m.bank_fee_bs > 0 && (
                                    <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                                      Com: -{fmtAmount(m.bank_fee_bs)}
                                    </span>
                                  )}
                                  <span
                                    className={`text-xs font-bold font-mono tabular-nums ${
                                      isSell ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {isSell ? '+' : '-'}{fmtAmount(m.fiat_amount)} {fiatSymbol}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
      {movementsModal.open && (
        <BankMovementsModal
          isOpen={movementsModal.open}
          onClose={() => setMovementsModal({ open: false, accountId: null })}
          initialAccountId={movementsModal.accountId}
          accounts={accounts}
          onReassignOrderBank={handleReassignOrderBank}
        />
      )}

      {/* Modal de Bitácora de Cuadres y Ajustes */}
      {historyModalOpen && (
        <BankAdjustmentsModal
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          adjustments={adjustments}
          accounts={accounts}
        />
      )}

      {/* Modal de Cuadre Manual de Posición */}
      {reconcileModal.open && (
        <BankReconcileModal
          isOpen={reconcileModal.open}
          onClose={() => setReconcileModal((prev) => ({ ...prev, open: false }))}
          accounts={accounts}
          initialAccountId={reconcileModal.accountId}
          hideAccountSelector={true}
          onSuccess={(updatedData) => setData(updatedData)}
        />
      )}

      {/* Modal para Crear / Configurar Cuenta Bancaria */}
      {accountFormModal.open && (
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
      )}
    </div>
  );
}
