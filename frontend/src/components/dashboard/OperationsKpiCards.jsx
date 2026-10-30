import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
} from 'lucide-react';

export default function OperationsKpiCards({
  stats = {},
  cryptoAsset = 'USDT',
  fiat = 'VES',
  grossProfitUsdt = 0,
  totalCommissionsAllUsdt = 0,
  matchedUsdt = 0,
  netMarginPct = 0,
  breakevenSellRate = 0,
  completedCount = 0,
  totalCapitalConsolidatedUsdt = 0,
  totalBankBs = 0,
  onOpenReconcileModal,
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
  fmtRate = (n) => String(n),
}) {
  return (
    <>
      {/* Card 1: Rendimiento & Ganancia Neta de Hoy (P&L Sintetizada) */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
        <div>
          {/* Cabecera uniforme */}
          <div className="min-h-[38px] flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ganancia Neta Hoy
            </span>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              Resultado limpio de la jornada
            </span>
          </div>

          {/* Métrica principal y dato secundario */}
          <div className="mt-2.5">
            <span
              className={`text-2xl font-bold tracking-tight tabular-nums block cursor-help ${
                Number(stats.net_profit_usdt || 0) < -0.005 ? 'text-rose-400' : 'text-white'
              }`}
              title={`Bruta: ${grossProfitUsdt > 0.005 ? '+' : ''}${fmtUsdt(grossProfitUsdt)} ${cryptoAsset} · Comisiones: -${fmtUsdt(totalCommissionsAllUsdt)} ${cryptoAsset}`}
            >
              {Number(stats.net_profit_usdt || 0) > 0.005 ? '+' : ''}
              {fmtUsdt(stats.net_profit_usdt)} {cryptoAsset}
            </span>
            <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
              <span className="tabular-nums">{fmtFiat(stats.net_profit_fiat)} {fiat}</span>
              {matchedUsdt > 0 && (
                <>
                  <span className="text-slate-600 select-none">·</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    {netMarginPct > 0.005 ? '+' : ''}{netMarginPct.toFixed(2)}% margen
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Spread Promedio & Tasas (Sintetizada) */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
        <div>
          {/* Cabecera uniforme */}
          <div className="min-h-[38px] flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Spread Promedio
            </span>
            <span
              className="block text-[11px] text-slate-500 mt-0.5 truncate"
              title={
                stats.completion_rate_pct != null
                  ? `${stats.completion_rate_pct}% efectividad en órdenes`
                  : 'Margen ponderado de compra/venta'
              }
            >
              {stats.completion_rate_pct != null
                ? `${stats.completion_rate_pct}% efectividad en órdenes`
                : 'Margen ponderado de compra/venta'}
            </span>
          </div>

          {/* Métrica principal y dato secundario integrado */}
          <div className="mt-2.5">
            <span
              className="text-2xl font-bold tracking-tight text-white tabular-nums block cursor-help"
              title={
                stats.spread_abs
                  ? `Spread absoluto: ${Number(stats.spread_abs) > 0.0001 ? '+' : ''}${fmtRate(stats.spread_abs)} ${fiat}`
                  : undefined
              }
            >
              {Number(stats.spread_pct || 0) > 0.005 ? '+' : ''}
              {Number(stats.spread_pct || 0).toFixed(2)}%
            </span>
            <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
              <span
                className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
                title={`Precio promedio de compra (WAC): ${fmtRate(stats.wac_buy_price)} ${fiat}`}
              >
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{fmtRate(stats.wac_buy_price)}</span>
              </span>
              <span className="text-slate-600 select-none">·</span>
              <span
                className="inline-flex items-center gap-1 text-rose-400 cursor-help"
                title={`Precio promedio de venta (WAP): ${fmtRate(stats.wap_sell_price)} ${fiat}`}
              >
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{fmtRate(stats.wap_sell_price)}</span>
              </span>
              {breakevenSellRate > 0 && (
                <>
                  <span className="text-slate-600 select-none">·</span>
                  <span
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-help"
                    title={`Tasa Piso de Equilibrio (Breakeven): ${fmtRate(breakevenSellRate)} ${fiat} (Precio mínimo de venta para cubrir costos de compra y comisiones)`}
                  >
                    <Scale className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="tabular-nums">{fmtRate(breakevenSellRate)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Volumen Total Operado (Sintetizada) */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
        <div>
          {/* Cabecera uniforme */}
          <div className="min-h-[38px] flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Volumen Operado
            </span>
            <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
              {completedCount} órdenes completadas hoy
            </span>
          </div>

          {/* Métrica principal y dato secundario integrado */}
          <div className="mt-2.5">
            <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
              {fmtUsdt(stats.total_usdt_volume)} {cryptoAsset}
            </span>
            <div className="mt-1.5 min-h-[20px] flex items-center flex-wrap gap-x-1.5 text-xs text-slate-400">
              <span
                className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
                title={`Total Compras: ${fmtUsdt(stats.buy_usdt_total)} ${cryptoAsset} (${fmtFiat(stats.buy_fiat_total)} ${fiat})`}
              >
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{fmtUsdt(stats.buy_usdt_total)}</span>
              </span>
              <span className="text-slate-600 select-none">·</span>
              <span
                className="inline-flex items-center gap-1 text-amber-400 cursor-help"
                title={`Total Ventas: ${fmtUsdt(stats.sell_usdt_total)} ${cryptoAsset} (${fmtFiat(stats.sell_fiat_total)} ${fiat})`}
              >
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="tabular-nums">{fmtUsdt(stats.sell_usdt_total)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Posición Consolidada Total (Sintetizada) */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-md">
        <div>
          {/* Cabecera uniforme con botón de acción */}
          <div className="min-h-[38px] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate block">
                Posición Consolidada
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5 truncate" title="Capital activo total (Binance + Bancos)">
                Capital activo total (Binance + Bancos)
              </span>
            </div>
            {onOpenReconcileModal && (
              <button
                type="button"
                onClick={onOpenReconcileModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer shrink-0 shadow-xs"
                title="Cuadrar cuentas bancarias"
              >
                <Scale className="h-3.5 w-3.5 text-amber-400" />
              </button>
            )}
          </div>

          {/* Métrica principal y dato secundario */}
          <div className="mt-2.5">
            <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
              {fmtUsdt(totalCapitalConsolidatedUsdt)} USDT
            </span>
            <div className="mt-1.5 min-h-[20px] flex items-center text-xs text-slate-400">
              <span>
                Incluye:{' '}
                <strong className="font-semibold text-slate-300 tabular-nums">
                  {fmtFiat(totalBankBs)} {fiat}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
