import React, { useEffect, useState } from 'react';
import { Github, Scale, Bug, ExternalLink, Database, ShieldCheck } from 'lucide-react';
import { Badge, Card, CardContent, Logo, APP_NAME, APP_TAGLINE } from '../ui';

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
 * Sección "Acerca de": identidad de la app, versión, licencia y enlaces oficiales.
 */
export default function AboutSection() {
  const [version, setVersion] = useState(null);
  const isTauri = Boolean(getTauriInvoke());

  useEffect(() => {
    let isMounted = true;
    const invoke = getTauriInvoke();
    if (invoke) {
      invoke('plugin:app|version')
        .then((ver) => isMounted && ver && setVersion(ver))
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const currentYear = new Date().getFullYear();
  const yearRange = currentYear > FIRST_YEAR ? `${FIRST_YEAR}–${currentYear}` : `${FIRST_YEAR}`;

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Identidad */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-800/80 pb-5">
          <Logo size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-tight text-white">{APP_NAME}</h3>
            <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
          </div>
          <div className="flex items-center gap-2">
            {version && (
              <Badge variant="warning" size="xs" className="font-mono tabular-nums">
                v{version}
              </Badge>
            )}
            <Badge variant={isTauri ? 'info' : 'default'} size="xs">
              {isTauri ? 'Desktop' : 'Web'}
            </Badge>
          </div>
        </div>

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
