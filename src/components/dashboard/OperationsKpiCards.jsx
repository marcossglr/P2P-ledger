import React, { memo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Scale,
} from 'lucide-react';
import { Card, Button, InfoPopover } from '../ui';

function OperationsKpiCards({
  stats = {},
  cryptoAsset = 'USDT',
  fiat = 'VES',
  grossProfitUsdt = 0,
  totalCommissionsAllUsdt = 0,
  matchedUsdt = 0,
  netMarginPct = 0,
  completedCount = 0,
  totalCapitalConsolidatedUsdt = 0,
  totalBankBs = 0,
  onOpenReconcileModal,
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
  fmtRate = (n) => String(n),
}) {
  const netProfit = Number(stats.net_profit_usdt || 0);
  const isProfit = netProfit > 0.005;
  const isLoss = netProfit < -0.005;

  return (
    <>
      {/* ========================================================
          CARD 1: Ganancia Neta Hoy (P&L Sintetizada)
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera uniforme compacta con InfoPopover */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Ganancia Neta Hoy
            </span>
            <InfoPopover
              title="Ganancia Neta de Hoy"
              content="Resultado neto limpio de la jornada deducidas las comisiones de Binance P2P y los costos bancarios estimados."
              ariaLabel="Información de Ganancia Neta Hoy"
            />
          </div>

          {/* Métrica principal con moneda y equivalente Fiat inline */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums block ${
                  isLoss ? 'text-rose-400' : isProfit ? 'text-emerald-400' : 'text-white'
                }`}
                title={`Bruta: ${grossProfitUsdt > 0.005 ? '+' : ''}${fmtUsdt(grossProfitUsdt)} ${cryptoAsset} · Comisiones: -${fmtUsdt(totalCommissionsAllUsdt)} ${cryptoAsset}`}
              >
                {isProfit ? '+' : ''}
                {fmtUsdt(netProfit)} {cryptoAsset}
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({Number(stats.net_profit_fiat || 0) > 0.005 ? '+' : ''}{fmtFiat(stats.net_profit_fiat)} {fiat})
              </span>
            </div>
          </div>
        </div>

        {/* Pie anclado al fondo: Margen neto y desglose de costos */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            {matchedUsdt > 0 && (
              <>
                <span className="text-emerald-400 font-medium tabular-nums">
                  {netMarginPct > 0.005 ? '+' : ''}{netMarginPct.toFixed(2)}% margen
                </span>
                <span className="text-slate-600 select-none">·</span>
              </>
            )}
            <span
              className="text-slate-400 tabular-nums cursor-help"
              title={`Bruta: ${grossProfitUsdt > 0.005 ? '+' : ''}${fmtUsdt(grossProfitUsdt)} ${cryptoAsset} · Comisiones: -${fmtUsdt(totalCommissionsAllUsdt)} ${cryptoAsset}`}
            >
              Comis: <span className="font-mono text-slate-300">-{fmtUsdt(totalCommissionsAllUsdt)}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 2: Spread Promedio & Tasas Ponderadas
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera uniforme compacta con InfoPopover */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Spread Promedio
            </span>
            <InfoPopover
              title="Spread Promedio de la Jornada"
              content="Margen comercial ponderado entre tus precios medios de compra (WAC) y venta (WAP)."
              ariaLabel="Información de Spread Promedio"
            />
          </div>

          {/* Métrica principal con Spread absoluto inline si existe */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="text-2xl font-bold tracking-tight text-white tabular-nums block"
                title={
                  stats.spread_abs
                    ? `Spread absoluto: ${Number(stats.spread_abs) > 0.0001 ? '+' : ''}${fmtRate(stats.spread_abs)} ${fiat}`
                    : undefined
                }
              >
                {Number(stats.spread_pct || 0) > 0.005 ? '+' : ''}
                {Number(stats.spread_pct || 0).toFixed(2)}%
              </span>
              {Number(stats.spread_abs || 0) !== 0 && (
                <span className="text-xs tabular-nums text-slate-400 font-medium">
                  ({Number(stats.spread_abs) > 0.0001 ? '+' : ''}{fmtRate(stats.spread_abs)} {fiat})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie anclado al fondo: Precios WAC/WAP compactos */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
              title={`Precio promedio ponderado de compra (WAC): ${fmtRate(stats.wac_buy_price)} ${fiat}`}
            >
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono tabular-nums text-slate-200">{fmtRate(stats.wac_buy_price)}</span>
            </span>
            <span className="text-slate-600 select-none">·</span>
            <span
              className="inline-flex items-center gap-1 text-rose-400 cursor-help"
              title={`Precio promedio ponderado de venta (WAP): ${fmtRate(stats.wap_sell_price)} ${fiat}`}
            >
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono tabular-nums text-slate-200">{fmtRate(stats.wap_sell_price)}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 3: Volumen Operado Hoy
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera uniforme compacta con InfoPopover */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Volumen Operado
            </span>
            <InfoPopover
              title="Volumen Total Operado"
              content="Volumen total en cripto intercambiado en la jornada de hoy junto con el conteo de órdenes completadas."
              ariaLabel="Información de Volumen Operado"
            />
          </div>

          {/* Métrica principal con conteo de órdenes inline */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {fmtUsdt(stats.total_usdt_volume)} {cryptoAsset}
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({completedCount} {completedCount === 1 ? 'orden' : 'órdenes'})
              </span>
            </div>
          </div>
        </div>

        {/* Pie anclado al fondo: Flujo Compra / Venta en cripto */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-emerald-400 cursor-help"
              title={`Total Compras: ${fmtUsdt(stats.buy_usdt_total)} ${cryptoAsset} (${fmtFiat(stats.buy_fiat_total)} ${fiat})`}
            >
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono tabular-nums text-slate-200">{fmtUsdt(stats.buy_usdt_total)}</span>
            </span>
            <span className="text-slate-600 select-none">·</span>
            <span
              className="inline-flex items-center gap-1 text-rose-400 cursor-help"
              title={`Total Ventas: ${fmtUsdt(stats.sell_usdt_total)} ${cryptoAsset} (${fmtFiat(stats.sell_fiat_total)} ${fiat})`}
            >
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono tabular-nums text-slate-200">{fmtUsdt(stats.sell_usdt_total)}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 4: Posición Consolidada Total
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera uniforme compacta con botón de acción */}
          <div className="flex items-center justify-between gap-1.5 min-h-[24px]">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
              Posición Consolidada
            </span>
            {onOpenReconcileModal && (
              <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                icon={Scale}
                onClick={onOpenReconcileModal}
                title="Cuadrar cuentas bancarias"
              />
            )}
          </div>

          {/* Métrica principal en USDT */}
          <div className="mt-2.5">
            <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
              {fmtUsdt(totalCapitalConsolidatedUsdt)} USDT
            </span>
          </div>
        </div>

        {/* Pie anclado al fondo: Componente bancario en Fiat */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-400">En bancos:</span>
            <span className="font-mono font-medium text-slate-200 tabular-nums">
              {fmtFiat(totalBankBs)} {fiat}
            </span>
          </div>
        </div>
      </Card>
    </>
  );
}

export default memo(OperationsKpiCards);
