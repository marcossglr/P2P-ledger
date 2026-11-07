import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';
import { Button, Badge } from '../ui';

// Detección segura de si la app está corriendo en entorno Tauri nativo de escritorio
const getTauriInvoke = () => {
  if (typeof window === 'undefined') return null;
  if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke;
  if (window.__TAURI_INTERNALS__?.invoke) return window.__TAURI_INTERNALS__.invoke;
  return null;
};

export default function AppUpdateSection() {
  const [currentVersion, setCurrentVersion] = useState('0.3.0');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null); // { downloaded, total, percent }
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('IDLE'); // 'IDLE' | 'AVAILABLE' | 'UP_TO_DATE' | 'READY_TO_RELAUNCH' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState(null);
  const isTauri = Boolean(getTauriInvoke());

  // Al montar, consultar versión de la app si estamos en Tauri
  useEffect(() => {
    let isMounted = true;
    const fetchAppVersion = async () => {
      const invoke = getTauriInvoke();
      if (invoke) {
        try {
          const ver = await invoke('plugin:app|version');
          if (isMounted && ver) setCurrentVersion(ver);
        } catch {
          // Mantener versión default
        }
      }
    };
    fetchAppVersion();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setErrorMessage(null);
    setUpdateInfo(null);
    setProgress(null);

    const invoke = getTauriInvoke();

    if (!invoke) {
      // Modo Navegador Web / Standalone FastAPI: Consulta al feed público de GitHub Releases
      try {
        const res = await fetch(
          'https://api.github.com/repos/marcossglr/P2P-ledger/releases/latest',
          { headers: { Accept: 'application/vnd.github.v3+json' } }
        );
        if (!res.ok) throw new Error('No se pudo consultar el servidor de actualizaciones');
        const release = await res.json();
        const latestTag = (release.tag_name || '').replace(/^v/, '');

        if (latestTag && latestTag !== currentVersion) {
          setUpdateInfo({
            version: latestTag,
            body: release.body || 'Nueva versión disponible con mejoras de estabilidad y rendimiento.',
            date: release.published_at,
            url: release.html_url,
          });
          setUpdateStatus('AVAILABLE');
        } else {
          setUpdateStatus('UP_TO_DATE');
        }
      } catch (err) {
        setUpdateStatus('ERROR');
        setErrorMessage(err.message || 'Error al comprobar actualizaciones.');
      } finally {
        setChecking(false);
      }
      return;
    }

    // Modo Nativo Tauri Desktop: Consultar manifest mediante plugin oficial
    try {
      // 1. Invocar check de actualización vía IPC nativo
      const updateData = await invoke('plugin:updater|check');

      if (updateData && (updateData.available || updateData.version)) {
        setUpdateInfo({
          version: updateData.version,
          body: updateData.body || 'Mejoras y correcciones en la última compilación.',
          date: updateData.date,
          rid: updateData.rid,
        });
        setUpdateStatus('AVAILABLE');
      } else {
        setUpdateStatus('UP_TO_DATE');
      }
    } catch (err) {
      console.error('Error al comprobar actualizaciones Tauri:', err);
      // Fallback a GitHub API pública si el plugin de updater responde error de red local
      try {
        const res = await fetch(
          'https://api.github.com/repos/marcossglr/P2P-ledger/releases/latest',
          { headers: { Accept: 'application/vnd.github.v3+json' } }
        );
        if (res.ok) {
          const release = await res.json();
          const latestTag = (release.tag_name || '').replace(/^v/, '');
          if (latestTag && latestTag !== currentVersion) {
            setUpdateInfo({
              version: latestTag,
              body: release.body || 'Nueva versión disponible en GitHub Releases.',
              date: release.published_at,
              url: release.html_url,
            });
            setUpdateStatus('AVAILABLE');
            return;
          } else {
            setUpdateStatus('UP_TO_DATE');
            return;
          }
        }
      } catch {
        // Fallback ignorado
      }
      setUpdateStatus('ERROR');
      setErrorMessage(
        typeof err === 'string' ? err : err.message || 'Error de conexión con el canal de actualizaciones.'
      );
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo) return;
    const invoke = getTauriInvoke();

    if (!invoke || !updateInfo.rid) {
      // En navegador o si se usa el release link directo
      const targetUrl = updateInfo.url || 'https://github.com/marcossglr/P2P-ledger/releases/latest';
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setDownloading(true);
    setErrorMessage(null);

    try {
      await invoke('plugin:updater|download_and_install', {
        onEvent: (event) => {
          if (event?.event === 'Progress' && event?.data) {
            setProgress({ percent: event.data.percent || 50 });
          }
        },
      });

      setUpdateStatus('READY_TO_RELAUNCH');
    } catch (err) {
      console.error('Error durante la descarga/instalación:', err);
      setUpdateStatus('ERROR');
      setErrorMessage(
        typeof err === 'string' ? err : err.message || 'Error descargando la actualización.'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleRelaunch = async () => {
    const invoke = getTauriInvoke();
    if (invoke) {
      try {
        await invoke('plugin:process|restart');
        return;
      } catch (err) {
        console.error('Error al reiniciar aplicación:', err);
      }
    }
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Tarjeta Principal de Actualización */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
              <ArrowUpCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Actualizaciones de la Aplicación</h3>
              <p className="text-xs text-slate-400">
                Canal oficial de versiones estables y parches del terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="xs">
              v{currentVersion}
            </Badge>
            {isTauri ? (
              <Badge variant="info" dot size="xs">
                Cliente Nativo Desktop
              </Badge>
            ) : (
              <Badge variant="neutral" size="xs">
                Modo Web / Navegador
              </Badge>
            )}
          </div>
        </div>

        {/* Estado actual / Mensajes dinámicos */}
        {updateStatus === 'UP_TO_DATE' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Ya tienes instalada la versión más reciente (v{currentVersion}). El sistema está completamente al día.</span>
          </div>
        )}

        {updateStatus === 'ERROR' && errorMessage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {updateStatus === 'READY_TO_RELAUNCH' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-400 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-amber-200">¡Actualización instalada con éxito!</h4>
                <p className="text-xs text-amber-300/80">
                  Reinicia la aplicación para aplicar todos los cambios de inmediato.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={RotateCcw}
              onClick={handleRelaunch}
            >
              <span>Reiniciar Terminal Ahora</span>
            </Button>
          </div>
        )}

        {updateStatus === 'AVAILABLE' && updateInfo && (
          <div className="rounded-xl border border-amber-500/30 bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-bold text-amber-300">
                  Nueva versión disponible: v{updateInfo.version}
                </span>
              </div>
              <Badge variant="warning" size="xs">
                Actualización Disponible
              </Badge>
            </div>

            {updateInfo.body && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                {updateInfo.body}
              </div>
            )}

            {/* Barra de progreso de descarga */}
            {downloading && progress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Descargando e instalando paquete...</span>
                  <span className="font-mono font-semibold text-amber-400">{progress.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={isTauri && updateInfo.rid ? Download : ExternalLink}
                loading={downloading}
                disabled={downloading}
                onClick={handleDownloadAndInstall}
              >
                <span>
                  {downloading
                    ? 'Descargando...'
                    : isTauri && updateInfo.rid
                    ? 'Actualizar e Instalar Ahora'
                    : 'Ver Descargas en GitHub'}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={checking}
              disabled={checking || downloading}
              onClick={handleCheckForUpdates}
            >
              <span>{checking ? 'Buscando actualizaciones...' : 'Buscar Actualizaciones'}</span>
            </Button>
          </div>

          <a
            href="https://github.com/marcossglr/P2P-ledger/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            <span>Ver historial de versiones en GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
