import React, { useState } from 'react';
import {
  Sparkles,
  Trash2,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { operationsApi } from '../../services/api';
import { Button, Badge } from '../ui';

export default function SystemMaintenanceSection({
  health = {},
  syncIntervalSeconds = 0,
  onSyncComplete,
  setMessage,
  setError,
}) {
  const [loading, setLoading] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const demoCount = Number(health.stored_demo_orders || 0);
  const realCount = Number(health.stored_real_orders || 0);
  const hasApiConfigured = Boolean(health.binance_api_configured);
  const hasRealData = realCount > 0 || hasApiConfigured;

  const handleSeedDemo = async () => {
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setLoading(true);
    try {
      await operationsApi.seedDemo();
      if (setMessage) {
        setMessage('Operaciones demo cargadas con éxito. Explora los dashboards de Hoy y el Histórico.');
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al sembrar datos de prueba.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDemo = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar todas las órdenes y cuentas de prueba (DEMO)?')) {
      return;
    }
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setLoading(true);
    try {
      await operationsApi.clearOperations(true);
      if (setMessage) {
        setMessage('Órdenes y datos demo eliminados con éxito de la base de datos.');
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al eliminar órdenes demo.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDatabase = async () => {
    if (!confirmDeleteAll) return;
    if (
      !window.confirm(
        '¡PELIGRO! ¿Estás ABSOLUTAMENTE SEGURO de que deseas vaciar toda la base de datos? Se perderán todas las órdenes y cuentas bancarias.'
      )
    ) {
      return;
    }
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setLoading(true);
    try {
      await operationsApi.clearOperations(false);
      setConfirmDeleteAll(false);
      if (setMessage) {
        setMessage('Base de datos restablecida a cero. Todo el historial ha sido eliminado.');
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al restablecer la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${!hasRealData ? 'lg:grid-cols-2' : ''} gap-4`}>
        {/* Tarjeta 1: Entorno de Pruebas y Simulación (Solo visible si no hay datos reales ni API conectada) */}
        {!hasRealData && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Entorno de Pruebas y Demo</h3>
                    <p className="text-xs text-slate-400">
                      Generación de órdenes simuladas para evaluar cálculos contables
                    </p>
                  </div>
                </div>
                <Badge variant="warning" size="xs">
                  Modo Seguro
                </Badge>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-400 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-300 font-medium">Estado de órdenes en Base de Datos:</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-emerald-400 font-semibold">{realCount} reales</span>
                    <span className="text-slate-600">•</span>
                    <span className={demoCount > 0 ? "text-amber-400 font-semibold" : "text-slate-400"}>
                      {demoCount} demo
                    </span>
                  </div>
                </div>
                <p className="leading-relaxed">
                  Este módulo genera operaciones simuladas de Compra y Venta con tasas representativas del mercado venezolano para verificar los cálculos de costo promedio ponderado (WAC), margen de ganancia diaria y cuadres de saldo bancario.
                </p>
                <p className="text-xs text-slate-500">
                  • Las órdenes de prueba se eliminan automáticamente en cuanto conectes tu API de Binance o importes un archivo CSV real.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Sparkles}
                loading={loading}
                onClick={handleSeedDemo}
              >
                <span>Cargar Operaciones Demo</span>
              </Button>
              {demoCount > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  loading={loading}
                  onClick={handleClearDemo}
                >
                  <span>Eliminar {demoCount} Órdenes Demo</span>
                </Button>
              )}
              {demoCount === 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  disabled={true}
                >
                  <span>Sin Órdenes Demo</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tarjeta 2: Diagnóstico y Salud del Sistema */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300">
                  <Activity className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Diagnóstico y Salud del Sistema</h3>
                  <p className="text-xs text-slate-400">
                    Estado operativo de los servicios internos
                  </p>
                </div>
              </div>
              <Badge variant="success" dot size="xs">
                Sistema En Línea
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="text-xs text-slate-500 block">Servidor API</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">FastAPI (Python 3)</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="text-xs text-slate-500 block">Interfaz de Usuario</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">Vite + React 18</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="text-xs text-slate-500 block">Motor de Datos</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">SQLite 3 (Local)</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <span className="text-xs text-slate-500 block">Frecuencia Auto-Sync</span>
                <span className="font-semibold text-emerald-400 mt-0.5 block">
                  {syncIntervalSeconds > 0 ? `Cada ${syncIntervalSeconds}s` : 'Manual'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Versión del Reconciliador: v1.0.0</span>
            <span>Modo: Monousuario Local</span>
          </div>
        </div>
      </div>

      {/* Tarjeta 3: Zona de Restablecimiento Crítico (Alto Riesgo) */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-200">Zona de Restablecimiento Crítico</h3>
              <p className="text-xs text-slate-400">
                Restablece la base de datos local y limpia todos los registros
              </p>
            </div>
          </div>
          <Badge variant="danger" size="xs">
            Acción Irreversible
          </Badge>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Esta operación vaciará completamente el archivo de base de datos local: eliminará permanentemente todas las órdenes P2P registradas, lotes de inventario de costo (WAC), balances acumulados y cuentas bancarias creadas. Úsalo únicamente si necesitas empezar el reconciliador desde cero.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/20 bg-slate-950/60 p-3.5">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmDeleteAll}
              onChange={(e) => setConfirmDeleteAll(e.target.checked)}
              className="h-4 w-4 accent-rose-500 rounded cursor-pointer"
            />
            <span className="font-semibold text-rose-300">
              Entiendo que esta acción destruirá permanentemente toda la base de datos local.
            </span>
          </label>

          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={Trash2}
            disabled={!confirmDeleteAll}
            loading={loading}
            onClick={handleClearAllDatabase}
          >
            <span>Vaciar Base de Datos por Completo</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
