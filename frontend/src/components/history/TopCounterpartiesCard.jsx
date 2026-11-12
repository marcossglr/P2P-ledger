import React from 'react';
import { Users } from 'lucide-react';

export default function TopCounterpartiesCard({
  counterparties = [],
  fiat = 'VES',
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Principales Contrapartes</h3>
          <p className="text-xs text-slate-400">Usuarios con mayor volumen histórico</p>
        </div>
        <Users className="h-4 w-4 text-slate-400" />
      </div>
      <div className="space-y-2.5">
        {(counterparties || []).map((cp, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-xs"
          >
            <div>
              <p className="font-medium text-slate-200">{cp.name}</p>
              <p className="text-[11px] text-slate-500 tabular-nums">{cp.count} órdenes completadas</p>
            </div>
            <div className="text-right tabular-nums">
              <p className="font-semibold text-white">{fmtUsdt(cp.usdt_volume)} USDT</p>
              <p className="text-[11px] text-slate-400">{fmtFiat(cp.fiat_volume)} {fiat}</p>
            </div>
          </div>
        ))}
        {(!counterparties || counterparties.length === 0) && (
          <p className="text-xs text-slate-500 py-3 text-center">
            No hay datos de contrapartes para el período seleccionado.
          </p>
        )}
      </div>
    </div>
  );
}
