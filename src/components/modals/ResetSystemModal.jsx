import React, { useState } from 'react';
import { AlertTriangle, Trash2, Database, ShieldAlert, KeyRound, Archive, RefreshCw } from 'lucide-react';
import { Modal, Button, Checkbox, Input } from '../ui';
import { operationsApi } from '../../services/api';

const CONFIRMATION_PHRASE = 'BORRAR TODO';

export default function ResetSystemModal({
  isOpen,
  onClose,
  onSuccess,
  hasRealData = false,
  ordersCount = 0,
}) {
  const [deleteOrders, setDeleteOrders] = useState(true);
  const [deleteBankAccounts, setDeleteBankAccounts] = useState(true);
  const [deleteApiCredentials, setDeleteApiCredentials] = useState(false);
  const [deleteBackups, setDeleteBackups] = useState(false);
  const [clearBrowserPreferences, setClearBrowserPreferences] = useState(false);

  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isConfirmed = confirmInput.trim().toUpperCase() === CONFIRMATION_PHRASE;
  const hasSelection =
    deleteOrders ||
    deleteBankAccounts ||
    deleteApiCredentials ||
    deleteBackups ||
    clearBrowserPreferences;

  const handleClose = () => {
    if (loading) return;
    setConfirmInput('');
    setErrorMsg('');
    onClose?.();
  };

  const handleReset = async (e) => {
    e?.preventDefault();
    if (!isConfirmed || !hasSelection || loading) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        delete_orders: deleteOrders,
        delete_bank_accounts: deleteBankAccounts,
        delete_api_credentials: deleteApiCredentials,
        delete_backups: deleteBackups,
      };

      const res = await operationsApi.systemReset(payload);

      if (clearBrowserPreferences) {
        try {
          const keysToRemove = [
            'p2p_ads_expanded',
            'p2p_sound_alerts_enabled',
            'p2p_sound_new_order_enabled',
            'p2p_sound_completed_order_enabled',
            'p2p_toasts_enabled',
            'p2p_app_theme',
            'p2p_time_format',
            'p2p_time_show_seconds',
            'user_selected_asset',
            'user_selected_fiat',
            'binance_sync_interval_seconds',
          ];
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {
          // Si el acceso a localStorage está restringido, ignorar
        }
      }

      setConfirmInput('');
      onSuccess?.(res?.summary || res);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'Error al ejecutar el restablecimiento de datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Borrar Data Guardada del Sistema"
      subtitle="Personaliza los elementos que deseas eliminar de forma definitiva"
      icon={AlertTriangle}
      iconClassName="bg-rose-500/15 border-rose-500/30 text-rose-400"
      maxWidth="max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={loading}
          >
            <span>Cancelar</span>
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={Trash2}
            disabled={!isConfirmed || !hasSelection || loading}
            loading={loading}
            onClick={handleReset}
          >
            <span>Confirmar y Borrar Datos</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleReset} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Advertencia Destacada */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Zona de Alta Sensibilidad</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Selecciona cuidadosamente qué componentes deseas purgar. Las selecciones marcadas serán eliminadas de la base de datos local de manera irreversible.
          </p>
        </div>

        {/* Casillas de Verificación Personalizables */}
        <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <span className="text-xs font-semibold text-slate-300 block mb-1">
            Selecciona qué datos deseas borrar:
          </span>

          {/* Opción 1: Órdenes y Lotes */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 hover:border-slate-700 transition-colors">
            <Checkbox
              checked={deleteOrders}
              onChange={setDeleteOrders}
              label={
                <span className="text-xs font-semibold text-slate-200">
                  Órdenes P2P y Lotes de Importación
                </span>
              }
              description={
                <span className="text-xs text-slate-400 block mt-0.5">
                  Elimina todas las operaciones registradas (API, CSV o Demo) y reinicia el inventario de compras (WAC).
                  {ordersCount > 0 && ` (${ordersCount} órdenes registradas actualmente)`}
                </span>
              }
            />
          </div>

          {/* Opción 2: Cuentas Bancarias y Arqueos */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 hover:border-slate-700 transition-colors">
            <Checkbox
              checked={deleteBankAccounts}
              onChange={setDeleteBankAccounts}
              label={
                <span className="text-xs font-semibold text-slate-200">
                  Cuentas Bancarias y Arqueos de Saldo
                </span>
              }
              description={
                <span className="text-xs text-slate-400 block mt-0.5">
                  Elimina los métodos bancarios registrados, balances ancla y el historial de cuadres de caja.
                </span>
              }
            />
          </div>

          {/* Opción 3: Credenciales de Binance API */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 hover:border-slate-700 transition-colors">
            <Checkbox
              checked={deleteApiCredentials}
              onChange={setDeleteApiCredentials}
              label={
                <span className="text-xs font-semibold text-rose-200">
                  Credenciales de Binance API y Configuración P2P
                </span>
              }
              description={
                <span className="text-xs text-slate-400 block mt-0.5">
                  Desvincula y borra las API Keys cifradas locales y la configuración de pizarra pública de mercado.
                </span>
              }
            />
          </div>

          {/* Opción 4: Respaldos .db existentes */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 hover:border-slate-700 transition-colors">
            <Checkbox
              checked={deleteBackups}
              onChange={setDeleteBackups}
              label={
                <span className="text-xs font-semibold text-rose-200">
                  Archivos de Respaldo (.db) de Seguridad
                </span>
              }
              description={
                <span className="text-xs text-slate-400 block mt-0.5">
                  Elimina los snapshots y copias de seguridad de la base de datos almacenados en la carpeta de respaldos.
                </span>
              }
            />
          </div>

          {/* Opción 5: Preferencias Locales del Navegador */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 hover:border-slate-700 transition-colors">
            <Checkbox
              checked={clearBrowserPreferences}
              onChange={setClearBrowserPreferences}
              label={
                <span className="text-xs font-semibold text-slate-300">
                  Preferencias del Navegador / LocalStorage
                </span>
              }
              description={
                <span className="text-xs text-slate-400 block mt-0.5">
                  Restablece tema, configuración de alertas sonoras y filtros guardados en este dispositivo.
                </span>
              }
            />
          </div>
        </div>

        {/* Confirmación obligatoria escribiendo BORRAR TODO */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
          <label className="text-xs text-slate-300 block">
            Para autorizar el borrado, escribe con exactitud{' '}
            <strong className="text-rose-400 font-mono font-bold tracking-wider">
              {CONFIRMATION_PHRASE}
            </strong>:
          </label>
          <Input
            type="text"
            size="sm"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`Escribe ${CONFIRMATION_PHRASE}`}
            autoComplete="off"
            className="font-mono text-center uppercase tracking-wider"
          />
        </div>
      </form>
    </Modal>
  );
}
