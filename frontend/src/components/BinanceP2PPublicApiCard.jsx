import React from 'react';
import {
  Globe,
  Zap,
  Activity,
  ShieldCheck,
  Clock,
  Layers,
} from 'lucide-react';

/**
 * Tarjeta informativa de la API Pública P2P de Binance en Ajustes.
 * Ahora opera como un Ticker Ultra-Rápido en memoria RAM (ciclo de 5 segundos, paralelo BUY/SELL).
 */
export default function BinanceP2PPublicApiCard() {
  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white">Ticker P2P en Vivo (API Pública)</h4>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                5 segundos
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sondeo ultra-rápido en memoria RAM que alimenta la cotización y el libro en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
          <Activity className="h-3.5 w-3.5" />
          <span>Activo</span>
        </div>
      </div>

      {/* Características del Ticker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-start gap-3">
          <Zap className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-white block">Actualización cada 5s</span>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              Descarga en paralelo BUY y SELL en menos de 0.6s y sobrescribe en memoria RAM sin demoras de disco.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-start gap-3">
          <Layers className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-white block">Filtros Nativos Directos</span>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              Al seleccionar un banco o monto en Operaciones, Binance filtra directamente en su servidor con cero huecos.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-white block">Protección Anti-Ban</span>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              Caché volátil de 4 segundos que evita peticiones redundantes y blinda tu IP contra bloqueos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
