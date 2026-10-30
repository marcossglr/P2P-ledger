import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ShieldCheck,
  Upload,
  RefreshCw,
  AlertTriangle,
  Download,
  Trash2,
} from 'lucide-react';
import { backupsApi, reconciliationApi } from '../../services/api';

export default function DatabaseBackupsSection({
  health = {},
  refreshTrigger,
  onSyncComplete,
  setMessage,
  setError,
}) {
  const [backups, setBackups] = useState([]);
  const [dbSizeMb, setDbSizeMb] = useState(0);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState(null);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  const fetchBackupsList = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const data = await backupsApi.list();
      setBackups(data.backups || []);
      setDbSizeMb(data.current_db_size_mb || 0);
    } catch {
      // Ignorar error silencioso
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    fetchBackupsList();
  }, [fetchBackupsList, refreshTrigger]);

  const handleCreateBackup = async () => {
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setBackupActionLoading(true);
    try {
      const data = await backupsApi.create();
      if (setMessage) {
        setMessage(`Copia de seguridad creada con éxito: ${data.filename} (${data.size_mb} MB)`);
      }
      fetchBackupsList();
    } catch (err) {
      if (setError) setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setBackupActionLoading(true);
    setRestoreConfirmModal(null);
    try {
      const data = await backupsApi.restore(filename);
      if (setMessage) {
        setMessage(data.message || 'Base de datos restaurada correctamente.');
      }
      fetchBackupsList();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el respaldo ${filename}?`)) return;
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setBackupActionLoading(true);
    try {
      await backupsApi.delete(filename);
      if (setMessage) {
        setMessage(`Respaldo ${filename} eliminado.`);
      }
      fetchBackupsList();
    } catch (err) {
      if (setError) setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleUploadBackup = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.db')) {
      if (setError) setError('El archivo seleccionado debe ser una base de datos SQLite (.db)');
      return;
    }
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    setBackupActionLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await backupsApi.upload(formData);
      if (setMessage) {
        setMessage(`Respaldo incorporado a la lista: ${data.filename}`);
      }
      fetchBackupsList();
    } catch (err) {
      if (setError) setError(err.message);
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleCsvFallback = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      if (setError) setError('Por favor selecciona un archivo con extensión .csv');
      return;
    }
    if (setError) setError(null);
    if (setMessage) setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await reconciliationApi.uploadBinanceCsv(formData);
      if (setMessage) {
        setMessage(`Archivo CSV importado: ${data.valid_rows} órdenes incorporadas a la base de datos.`);
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      if (setError) setError(err.message || 'Error al procesar el archivo CSV');
    }
  };

  return (
    <div className="space-y-4">
      {/* Fila 1: Estado del Almacenamiento Local (SQLite) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Almacenamiento Local Transaccional (SQLite)</h3>
              <p className="text-[11px] text-slate-400">
                Motor de persistencia integrado con modo Write-Ahead Logging (WAL)
              </p>
            </div>
          </div>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            Operativo (WAL)
          </span>
        </div>

        {/* Métricas de Base de Datos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Órdenes Guardadas</span>
            <span className="tabular-nums text-lg font-bold text-white mt-0.5 block">
              {health.stored_binance_orders || 0} <span className="text-xs font-normal text-slate-400">regs</span>
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Tamaño Base de Datos</span>
            <span className="tabular-nums text-lg font-bold text-white mt-0.5 block">
              {dbSizeMb > 0 ? `${dbSizeMb} MB` : '< 1 MB'}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Última Sincronización</span>
            <span
              className="tabular-nums text-xs font-semibold text-slate-200 mt-1.5 block truncate"
              title={health.last_synced_at || 'Sin registros'}
            >
              {health.last_synced_at || 'Sin registros'}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <span className="text-[11px] text-slate-400 block font-medium">Privacidad de Datos</span>
            <span className="text-xs font-semibold text-emerald-400 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Offline
            </span>
          </div>
        </div>
      </div>

      {/* Fila 2: GESTOR DE RESPALDOS (.DB) REALES */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Copias de Seguridad (Snapshots SQLite)</h3>
              <p className="text-[11px] text-slate-400">
                Crea copias exactas instantáneas, restáuralas en caso de contingencia o descárgalas a tu equipo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs">
              <Upload className="h-3.5 w-3.5 text-slate-400" />
              <span>Subir Respaldo (.db)</span>
              <input
                type="file"
                accept=".db"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleUploadBackup(e.target.files[0]);
                }}
              />
            </label>
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={backupActionLoading}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${backupActionLoading ? 'animate-spin' : ''}`} />
              <span>Crear Respaldo Ahora</span>
            </button>
          </div>
        </div>

        {/* Modal de Confirmación para Restaurar Respaldo */}
        {restoreConfirmModal && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-200">
                  ¿Restaurar la base de datos desde "{restoreConfirmModal}"?
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  El sistema reemplazará los datos actuales por los contenidos en esta copia de seguridad. 
                  Se generará automáticamente un respaldo preventivo de tu estado actual por seguridad.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRestoreConfirmModal(null)}
                disabled={backupActionLoading}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleRestoreBackup(restoreConfirmModal)}
                disabled={backupActionLoading}
                className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer shadow-xs"
              >
                {backupActionLoading ? 'Restaurando...' : 'Confirmar Restauración'}
              </button>
            </div>
          </div>
        )}

        {/* Tabla de Respaldos Disponibles */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Archivo de Respaldo</th>
                  <th className="px-4 py-2.5">Fecha y Hora</th>
                  <th className="px-4 py-2.5">Tamaño</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadingBackups ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1 text-slate-400" />
                      Cargando respaldos disponibles...
                    </td>
                  </tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-slate-500">
                      Aún no se han generado respaldos de la base de datos. Haz clic en "Crear Respaldo Ahora".
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.filename} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-200 font-medium">
                        {b.filename}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                        {b.created_at}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 tabular-nums">
                        {b.size_mb >= 1 ? `${b.size_mb} MB` : `${b.size_kb} KB`}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={backupsApi.getDownloadUrl(b.filename)}
                            download={b.filename}
                            title="Descargar archivo .db a tu equipo"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer shadow-xs"
                          >
                            <Download className="h-3 w-3 text-slate-400" />
                            <span>Descargar</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setRestoreConfirmModal(b.filename)}
                            disabled={backupActionLoading}
                            title="Restaurar base de datos a este punto"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer shadow-xs"
                          >
                            <RefreshCw className="h-3 w-3 text-amber-400" />
                            <span>Restaurar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(b.filename)}
                            disabled={backupActionLoading}
                            title="Eliminar copia de seguridad"
                            className="inline-flex items-center p-1.5 rounded-lg border border-transparent text-slate-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fila 3: Importador de Archivos CSV de Binance */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Importación Histórica de Binance (.CSV)</h3>
              <p className="text-[11px] text-slate-400">
                Carga reportes descargados desde Binance P2P con antigüedad mayor a 6 meses
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingCsv(true);
            }}
            onDragLeave={() => setIsDraggingCsv(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingCsv(false);
              if (e.dataTransfer.files?.[0]) {
                handleCsvFallback(e.dataTransfer.files[0]);
              }
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all ${
              isDraggingCsv
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
            }`}
          >
            <Upload className="h-7 w-7 text-amber-400 mb-2" />
            <span className="text-xs font-bold text-white block mb-0.5">
              Arrastra tu archivo .CSV o selecciónalo
            </span>
            <p className="text-[11px] text-slate-400 mb-2.5">
              Reportes de exportación oficiales de Binance P2P
            </p>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors shadow-xs">
              <Upload className="h-3.5 w-3.5 text-amber-400" />
              <span>Examinar Archivos .CSV</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleCsvFallback(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400 space-y-1.5">
            <span className="text-xs font-bold text-slate-200 block mb-1">
              Pasos para exportar desde Binance:
            </span>
            <p className="text-[11px] leading-relaxed">
              1. En Binance P2P, ve a <em>Órdenes</em> &gt; <em>Historial de Órdenes P2P</em>.
              <br />
              2. Haz clic en el botón <em>Exportar</em> en la esquina superior derecha.
              <br />
              3. Selecciona el rango deseado (hasta 1 año o personalizado) y descarga el archivo .CSV.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
