import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Card, Badge, InfoPopover } from '../ui';

export default function HistoryKpiCards({
  stats = {},
  selectedAsset = 'USDT',
  fiat = 'VES',
  orders = [],
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
  fmtRate = (n) => String(n),
}) {
  const matchedUsdt = Number(stats.matched_usdt_volume || 0);

  // Tasa de referencia representativa para conversiones USDT/Fiat
  const refRate =
    Number(stats.wac_buy_price) > 0
      ? Number(stats.wac_buy_price)
      : Number(stats.wap_sell_price) > 0
      ? Number(stats.wap_sell_price)
      : 0;

  // Ganancia bruta en USDT (a partir de gross_profit_fiat)
  const grossProfitUsdt =
    refRate > 0 ? Number(stats.gross_profit_fiat || 0) / refRate : 0;

  // Comisiones bancarias convertidas a USDT
  const bankFeesUsdt =
    refRate > 0 ? Number(stats.estimated_bank_fees_fiat || 0) / refRate : 0;

  // Total de comisiones unificadas
  const totalCommissionsAllUsdt =
    Number(stats.total_commission_usdt || 0) + bankFeesUsdt;
  const totalCommissionsAllFiat =
    Number(stats.commission_fiat_cost || 0) + Number(stats.estimated_bank_fees_fiat || 0);

  // Margen neto % real sobre el volumen efectivamente arbitrado
  const netProfitUsdt = Number(stats.net_profit_usdt || 0);
  const netMarginPct =
    matchedUsdt > 0 ? (netProfitUsdt / matchedUsdt) * 100 : 0;

  // Balance y desbalance de inventario de la jornada/período (consumido directamente del backend con impacto neto en billetera)
  const buyUsdtTotal = Number(stats.buy_usdt_total || 0);
  const sellUsdtTotal = Number(stats.sell_usdt_total || 0);
  const netInventoryUsdt =
    stats.net_inventory_usdt !== undefined && stats.net_inventory_usdt !== null
      ? Number(stats.net_inventory_usdt)
      : buyUsdtTotal - sellUsdtTotal;

  // Flujo neto de caja en Fiat
  const buyFiatTotal = Number(stats.buy_fiat_total || 0);
  const sellFiatTotal = Number(stats.sell_fiat_total || 0);
  const netCashFlowFiat = sellFiatTotal - buyFiatTotal;

  // Métricas operativas de órdenes
  const completedOrdersCount = Number(stats.completed_orders ?? stats.total_orders ?? orders.length);
  const buyOrdersCount = Number(stats.buy_count || 0);
  const sellOrdersCount = Number(stats.sell_count || 0);
  const cancelledOrdersCount = Number(stats.cancelled_orders || 0);
  const completionRatePct = stats.completion_rate_pct != null ? Number(stats.completion_rate_pct) : null;
  const avgTicketUsdt = completedOrdersCount > 0 ? Number(stats.total_usdt_volume || 0) / completedOrdersCount : 0;

  // Estado del resultado neto
  const isProfit = netProfitUsdt > 0.005;
  const isLoss = netProfitUsdt < -0.005;
  const profitColorClass = isProfit
    ? 'text-emerald-400'
    : isLoss
    ? 'text-rose-400'
    : 'text-white';

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {/* ========================================================
          CARD 1: Ganancia Neta (P&L) - [FILA 1: RESULTADO Y COSTOS]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover del sistema de diseño */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Ganancia Neta (P&L)
            </span>
            <InfoPopover
              title="Ganancia Neta (P&L)"
              content="Resultado neto del período tras arbitrar el volumen ciclado. Deducidas comisiones bancarias estimadas y costos de plataforma absorbidos en el WAC neto."
              ariaLabel="Información de Ganancia Neta"
            />
          </div>

          {/* Métrica Principal: Cripto + Fiat al lado (sin símbolo =) */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-2xl font-bold tracking-tight tabular-nums block ${profitColorClass}`}>
                {isProfit ? '+' : ''}
                {fmtUsdt(netProfitUsdt)} {selectedAsset}
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({Number(stats.net_profit_fiat || 0) > 0.005 ? '+' : ''}{fmtFiat(stats.net_profit_fiat)} {fiat})
              </span>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Desglose contable en la misma unidad Cripto */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Bruta:</span>
              <span className={`font-mono text-xs tabular-nums font-medium ${grossProfitUsdt > 0.005 ? 'text-slate-200' : grossProfitUsdt < -0.005 ? 'text-rose-400' : 'text-slate-400'}`}>
                {grossProfitUsdt > 0.005 ? '+' : ''}{fmtUsdt(grossProfitUsdt)} {selectedAsset}
              </span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Comisiones:</span>
              <span className={`font-mono text-xs tabular-nums font-medium ${totalCommissionsAllUsdt > 0.005 ? 'text-rose-400/90' : 'text-slate-400'}`}>
                {totalCommissionsAllUsdt > 0.005 ? '-' : ''}{fmtUsdt(totalCommissionsAllUsdt)} {selectedAsset}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 2: Margen & Spread - [FILA 1: RESULTADO Y COSTOS]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Margen & Spread
            </span>
            <InfoPopover
              title="Margen Neto & Spread"
              content="El Margen Neto representa el rendimiento porcentual real post-comisiones sobre el volumen efectivamente ciclado. El Spread Bruto refleja la brecha promedio de mercado entre compra (WAC) y venta (WAP)."
              ariaLabel="Información de Margen y Spread"
            />
          </div>

          {/* Métrica Principal: Margen Neto destacado con Spread Bruto secundario al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums block ${
                  netMarginPct > 0.005
                    ? 'text-emerald-400'
                    : netMarginPct < -0.005
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                {netMarginPct > 0.005 ? '+' : ''}
                {netMarginPct.toFixed(2)}%
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                (Bruto: {Number(stats.spread_pct || 0) > 0.005 ? '+' : ''}{Number(stats.spread_pct || 0).toFixed(2)}%
                {Number(stats.spread_abs || 0) !== 0 && ` · ${Number(stats.spread_abs || 0) > 0.0001 ? '+' : ''}${fmtRate(stats.spread_abs)} ${fiat}`})
              </span>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Niveles de precios operativos agrupados */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-400/90">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">WAC Compra:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {Number(stats.wac_buy_price) > 0 ? fmtRate(stats.wac_buy_price) : '—'}
              </span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5 text-rose-400/90">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">WAP Venta:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {Number(stats.wap_sell_price) > 0 ? fmtRate(stats.wap_sell_price) : '—'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 3: Comisiones Totales - [FILA 1: RESULTADO Y COSTOS]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Comisiones Totales
            </span>
            <InfoPopover
              title="Comisiones Totales"
              content="Costo operativo consolidado deducido del período. Suma los fees de publicación de Binance P2P más los gastos bancarios estimados por transferencias."
              ariaLabel="Información de Comisiones Totales"
            />
          </div>

          {/* Métrica Principal: Total Cripto en tono sobrio + Equivalente Fiat al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {totalCommissionsAllUsdt > 0.005 ? '-' : ''}{fmtUsdt(totalCommissionsAllUsdt)} {selectedAsset}
              </span>
              {totalCommissionsAllFiat > 0.005 && (
                <span className="text-xs tabular-nums text-slate-400 font-medium">
                  (-{fmtFiat(totalCommissionsAllFiat)} {fiat})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Desglose Binance P2P vs Bancos agrupados */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400 text-xs font-normal">Binance:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {fmtUsdt(stats.total_commission_usdt)} {selectedAsset}
              </span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400 text-xs font-normal">Bancos:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {fmtFiat(stats.estimated_bank_fees_fiat)} {fiat}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 4: Volumen Cripto - [FILA 2: TESORERÍA & VOLUMEN]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Volumen Cripto
            </span>
            <InfoPopover
              title="Volumen Cripto & Flujo"
              content="Muestra el volumen efectivamente ciclado (arbitrado entre compras y ventas) y el desbalance neto acumulado en inventario cripto durante el período."
              ariaLabel="Información de Volumen Cripto"
            />
          </div>

          {/* Métrica Principal: Volumen Ciclado + Flujo Neto al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {fmtUsdt(matchedUsdt)} {selectedAsset}
              </span>
              <span className="text-xs tabular-nums font-medium text-slate-400">
                (Neto: {netInventoryUsdt > 0.005 ? '+' : ''}{fmtUsdt(netInventoryUsdt)} {selectedAsset})
              </span>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Flujo de Compras, Ventas agrupados + Pastilla de Total a la derecha */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-400/90">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Compras:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{fmtUsdt(buyUsdtTotal)}</span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5 text-rose-400/90">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Ventas:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{fmtUsdt(sellUsdtTotal)}</span>
            </div>
          </div>
          <Badge variant="default" size="xs" className="font-mono text-slate-300">
            Σ {fmtUsdt(stats.total_usdt_volume)}
          </Badge>
        </div>
      </Card>

      {/* ========================================================
          CARD 5: Flujo de Caja Fiat - [FILA 2: TESORERÍA & VOLUMEN]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Flujo de Caja ({fiat})
            </span>
            <InfoPopover
              title={`Flujo de Caja (${fiat})`}
              content="Muestra el balance neto de liquidez en moneda local (entradas por ventas menos salidas por compras) y la rotación bancaria bruta total movilizada."
              ariaLabel="Información de Flujo de Caja"
            />
          </div>

          {/* Métrica Principal: Flujo Neto neutro destacado + Rotación Bruta al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {netCashFlowFiat > 0.005 ? '+' : ''}
                {fmtFiat(netCashFlowFiat)} {fiat}
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                (Rotación: {fmtFiat(stats.total_fiat_volume)} {fiat})
              </span>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Salidas y Entradas agrupadas con colores Binance */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-400/90">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Salidas:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{fmtFiat(buyFiatTotal)}</span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5 text-rose-400/90">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Entradas:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{fmtFiat(sellFiatTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 6: Órdenes & Operativa - [FILA 2: TESORERÍA & VOLUMEN]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Órdenes & Operativa
            </span>
            <InfoPopover
              title="Órdenes & Operativa"
              content="Resumen de transacciones del período: órdenes completadas, tasa de efectividad comercial, compras vs ventas ejecutadas y ticket promedio por orden."
              ariaLabel="Información de Órdenes y Operativa"
            />
          </div>

          {/* Métrica Principal: Cantidad de órdenes + Efectividad y Ticket al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {completedOrdersCount} <span className="text-xs font-sans font-normal text-slate-400">órdenes</span>
              </span>
              <span className="text-xs tabular-nums text-slate-400 font-medium">
                ({completionRatePct != null ? `${completionRatePct}% éxito` : '100% éxito'}
                {avgTicketUsdt > 0 && ` · ~${fmtUsdt(avgTicketUsdt)} ${selectedAsset}/ord`})
              </span>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Compras y Ventas agrupadas + Pastilla de canceladas a la derecha */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-400/90">
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Compras:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{buyOrdersCount}</span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5 text-rose-400/90">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
              <span className="text-slate-400 text-xs font-normal">Ventas:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">{sellOrdersCount}</span>
            </div>
          </div>
          {cancelledOrdersCount > 0 && (
            <Badge variant="danger" size="xs">
              {cancelledOrdersCount} canc.
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
