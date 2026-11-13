import React, { useEffect, useState, useRef } from 'react';
import {
  Github,
  Scale,
  Bug,
  ExternalLink,
  Database,
  ShieldCheck,
  RefreshCw,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpCircle,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, Logo, APP_NAME, APP_TAGLINE } from '../ui';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const REPO_URL = 'https://github.com/marcossglr/P2P-ledger';
const APP_IDENTIFIER = 'io.github.marcossglr.p2pledger';
const AUTHOR = 'marcossglr';
const FIRST_YEAR = 2026;

const LINKS = [
  { label: 'Repositorio', href: REPO_URL, icon: Github },
  { label: 'Notas de versión', href: `${REPO_URL}/releases`, icon: ExternalLink },
  { label: 'Reportar un problema', href: `${REPO_URL}/issues/new`, icon: Bug },
  { label: 'Licencia GPL-3.0', href: `${REPO_URL}/blob/main/LICENSE`, icon: Scale },
];

const getTauriInvoke = () => {
  if (typeof window === 'undefined') return null;
  if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke;
  if (window.__TAURI_INTERNALS__?.invoke) return window.__TAURI_INTERNALS__.invoke;
  return null;
};

/**
 * Sección "Acerca de y Actualizaciones":
 * Identidad de la app, estado de versión, comprobación y descarga de actualizaciones en vivo,
 * garantías de privacidad y enlaces oficiales.
 */
export default function AboutSection() {
  const [currentVersion, setCurrentVersion] = useState('0.3.0');
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null); // { percent }
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('IDLE'); // 'IDLE' | 'AVAILABLE' | 'UP_TO_DATE' | 'READY_TO_RELAUNCH' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState(null);
  const activeUpdateRef = useRef(null);
  const isTauri = Boolean(getTauriInvoke());

  useEffect(() => {
    let isMounted = true;
    const invoke = getTauriInvoke();
    if (invoke) {
      invoke('plugin:app|version')
        .then((ver) => {
          if (isMounted && ver) setCurrentVersion(ver);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
      if (activeUpdateRef.current?.close) {
        activeUpdateRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setErrorMessage(null);
    setUpdateInfo(null);
    setProgress(null);

    if (activeUpdateRef.current?.close) {
      await activeUpdateRef.current.close().catch(() => {});
      activeUpdateRef.current = null;
    }

    const invoke = getTauriInvoke();

    if (!invoke) {
      // Modo Navegador Web: Consulta al feed público de GitHub Releases
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
      const update = await check();

      if (update && update.available) {
        activeUpdateRef.current = update;
        setUpdateInfo({
          version: update.version,
          body: update.body || 'Mejoras y correcciones en la última compilación.',
          date: update.date,
          canInstall: true,
        });
        setUpdateStatus('AVAILABLE');
      } else {
        setUpdateStatus('UP_TO_DATE');
      }
    } catch (err) {
      console.error('Error al comprobar actualizaciones Tauri:', err);
      // Fallback a GitHub API pública
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
              canInstall: false,
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

    const activeUpdate = activeUpdateRef.current;

    if (!activeUpdate || !updateInfo.canInstall) {
      const targetUrl = updateInfo.url || `${REPO_URL}/releases/latest`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setDownloading(true);
    setErrorMessage(null);
    setProgress({ percent: 0 });

    try {
      let downloadedBytes = 0;
      let totalBytes = 0;

      await activeUpdate.downloadAndInstall((event) => {
        if (!event) return;
        if (event.event === 'Started') {
          totalBytes = event.data?.contentLength || 0;
          setProgress({ percent: 1 });
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data?.chunkLength || 0;
          if (totalBytes > 0) {
            const pct = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
            setProgress({ percent: pct });
          } else {
            setProgress((prev) => ({ percent: Math.min(95, (prev?.percent || 5) + 5) }));
          }
        } else if (event.event === 'Finished') {
          setProgress({ percent: 100 });
        }
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
    try {
      await relaunch();
      return;
    } catch (err) {
      console.error('Error al reiniciar aplicación con plugin-process:', err);
      const invoke = getTauriInvoke();
      if (invoke) {
        try {
          await invoke('plugin:process|restart');
          return;
        } catch {
          // Ignorado
        }
      }
    }
    window.location.reload();
  };

  const currentYear = new Date().getFullYear();
  const yearRange = currentYear > FIRST_YEAR ? `${FIRST_YEAR}–${currentYear}` : `${FIRST_YEAR}`;

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Identidad de la Aplicación */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <Logo size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">{APP_NAME}</h3>
                <Badge variant="warning" size="xs" className="font-mono tabular-nums">
                  v{currentVersion}
                </Badge>
                <Badge variant={isTauri ? 'info' : 'default'} size="xs">
                  {isTauri ? 'Desktop' : 'Web'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
            </div>
          </div>

          {/* Botón de Comprobar Actualización */}
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

        {/* Panel de Estado de Actualización */}
        {updateStatus === 'UP_TO_DATE' && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Ya tienes instalada la versión más reciente (v{currentVersion}). El sistema está al día.</span>
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
                  Reinicia el terminal para comenzar a usar la nueva versión inmediatamente.
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
              <span>Reiniciar Terminal</span>
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
                icon={isTauri && updateInfo.canInstall ? Download : ExternalLink}
                loading={downloading}
                disabled={downloading}
                onClick={handleDownloadAndInstall}
              >
                <span>
                  {downloading
                    ? 'Descargando e Instalando...'
                    : isTauri && updateInfo.canInstall
                    ? 'Actualizar e Instalar Ahora'
                    : 'Ver Descargas en GitHub'}
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Descripción funcional */}
        <p className="text-xs leading-relaxed text-slate-300">
          Terminal financiero de escritorio para conciliar operaciones de Binance P2P con movimientos
          bancarios, controlar inventario por banco, calcular costo promedio ponderado y analizar el
          mercado P2P en tiempo real.
        </p>

        {/* Garantías de privacidad */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Datos 100% locales</p>
              <p className="text-[11px] text-slate-400">
                Tu base de datos vive en tu equipo; no se envía a ningún servidor externo.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="text-xs font-semibold text-slate-200">Código abierto</p>
              <p className="text-[11px] text-slate-400">
                Auditable y distribuido bajo la licencia GNU GPL v3.
              </p>
            </div>
          </div>
        </div>

        {/* Enlaces oficiales */}
        <div className="flex flex-wrap items-center gap-2">
          {LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-300"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </a>
          ))}
        </div>

        {/* Pie legal */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4 text-[11px] text-slate-500">
          <span>
            © {yearRange} {AUTHOR}. Distribuido bajo la licencia GPL-3.0.
          </span>
          <span className="font-mono">{APP_IDENTIFIER}</span>
        </div>
      </CardContent>
    </Card>
  );
}
