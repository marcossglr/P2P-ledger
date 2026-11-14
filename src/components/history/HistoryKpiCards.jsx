import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Card, Badge, InfoPopover } from '../ui';
import { normalizeKpiMetrics } from '../../utils/operationsMetrics';

export default function HistoryKpiCards({
  stats = {},
  selectedAsset = 'USDT',
  fiat = 'VES',
  orders = [],
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
  fmtRate = (n) => String(n),
}) {
  // Contrato universal de métricas (Backend como única fuente de verdad contable)
  const m = normalizeKpiMetrics(stats, orders);

  const profitColorClass = m.isProfit
    ? 'text-emerald-400'
    : m.isLoss
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

          {/* Métrica Principal: Monto Cripto + Equivalente Fiat en la misma línea */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-2xl font-bold tracking-tight tabular-nums block ${profitColorClass}`}>
                {m.isProfit ? '+' : ''}
                {fmtUsdt(m.netProfitCrypto)} {selectedAsset}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400 font-medium">
                ({m.netProfitFiat > 0.005 ? '+' : ''}{fmtFiat(m.netProfitFiat)} {fiat})
              </span>
            </div>

            {/* Línea Secundaria Relevante: Margen Neto % sobre volumen ciclado */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-slate-400">Margen neto:</span>
              {m.matchedCrypto > 0 ? (
                <span
                  className={`text-xs font-mono tabular-nums font-medium ${
                    m.netMarginPct > 0.005
                      ? 'text-emerald-400'
                      : m.netMarginPct < -0.005
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {m.netMarginPct > 0.005 ? '+' : ''}
                  {m.netMarginPct.toFixed(2)}%
                </span>
              ) : (
                <span className="text-xs font-mono text-slate-500 tabular-nums">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Ganancia Bruta (solo si difiere de la Neta) y Promedio por orden */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            {Math.abs(m.grossProfitCrypto - m.netProfitCrypto) > 0.005 && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-normal">Bruta:</span>
                  <span
                    className={`font-mono text-xs tabular-nums font-medium ${
                      m.grossProfitCrypto > 0.005
                        ? 'text-slate-200'
                        : m.grossProfitCrypto < -0.005
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {m.grossProfitCrypto > 0.005 ? '+' : ''}
                    {fmtUsdt(m.grossProfitCrypto)} {selectedAsset}
                  </span>
                </div>
                <span className="text-slate-600 select-none">·</span>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Promedio/ord:</span>
              <span
                className={`font-mono text-xs tabular-nums font-medium ${
                  m.completedOrdersCount > 0 && m.netProfitCrypto > 0.005
                    ? 'text-slate-200'
                    : m.completedOrdersCount > 0 && m.netProfitCrypto < -0.005
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {m.completedOrdersCount > 0
                  ? `${m.netProfitCrypto > 0.005 ? '+' : ''}${fmtUsdt(
                      m.netProfitCrypto / m.completedOrdersCount
                    )} ${selectedAsset}`
                  : `0,00 ${selectedAsset}`}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 2: Spread Comercial (Bruto) - [FILA 1: RESULTADO Y COSTOS]
          ======================================================== */}
      <Card className="relative flex flex-col justify-between p-4 shadow-md">
        <div>
          {/* Cabecera limpia y técnica con InfoPopover */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Spread Comercial
            </span>
            <InfoPopover
              title="Spread Comercial"
              content="Mide la brecha porcentual y absoluta entre el costo efectivo de reposición en billetera (WAC) y el precio efectivo de liquidación (WAP) antes de comisiones bancarias."
              ariaLabel="Información de Spread Comercial"
            />
          </div>

          {/* Métrica Principal: Spread Bruto % en grande + Spread Absoluto Fiat en la misma línea */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums block ${
                  m.wacBuy > 0 && m.wapSell > 0
                    ? m.spreadPct > 0.005
                      ? 'text-emerald-400'
                      : m.spreadPct < -0.005
                      ? 'text-rose-400'
                      : 'text-white'
                    : 'text-slate-400'
                }`}
              >
                {m.wacBuy > 0 && m.wapSell > 0
                  ? `${m.spreadPct > 0.005 ? '+' : ''}${m.spreadPct.toFixed(2)}%`
                  : '—'}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400 font-medium">
                ({m.wacBuy > 0 && m.wapSell > 0
                  ? `${m.spreadAbs > 0.0001 ? '+' : ''}${fmtRate(m.spreadAbs)} ${fiat}`
                  : `— ${fiat}`})
              </span>
            </div>

            {/* Línea Secundaria Relevante: Precios operativos WAC Compra y WAP Venta */}
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400/90">
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">WAC:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {m.wacBuy > 0 ? fmtRate(m.wacBuy) : '—'}
                </span>
              </div>
              <span className="text-slate-600 select-none">·</span>
              <div className="flex items-center gap-1.5 text-rose-400/90">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">WAP:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {m.wapSell > 0 ? fmtRate(m.wapSell) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Spread Neto (solo si difiere del Bruto) y Ratio V/C */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            {Math.abs(m.spreadPct - m.netMarginPct) > 0.005 && m.matchedCrypto > 0 && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-normal">Neto:</span>
                  <span
                    className={`font-mono text-xs tabular-nums font-medium ${
                      m.netMarginPct > 0.005
                        ? 'text-emerald-400'
                        : m.netMarginPct < -0.005
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {m.netMarginPct > 0.005 ? '+' : ''}
                    {m.netMarginPct.toFixed(2)}%
                  </span>
                </div>
                <span className="text-slate-600 select-none">·</span>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Ratio V/C:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {m.wacBuy > 0 && m.wapSell > 0
                  ? `${(m.wapSell / m.wacBuy).toFixed(4)}x`
                  : '—'}
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

          {/* Métrica Principal: Total Cripto en tono sobrio + Equivalente Fiat en la misma línea (sin signos negativos) */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {fmtUsdt(Math.abs(m.totalCommissionsCrypto))} {selectedAsset}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400 font-medium">
                ({fmtFiat(Math.abs(m.totalCommissionsFiat))} {fiat})
              </span>
            </div>

            {/* Línea Secundaria Relevante: Desglose Binance vs Bancos (solo si hay costo bancario para evitar redundancia) */}
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              {m.bankFeesFiat > 0.005 ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <span>
                    Binance: <strong className="font-mono tabular-nums text-slate-200">{fmtUsdt(Math.abs(m.binanceCommissionsCrypto))}</strong>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>
                    Bancos: <strong className="font-mono tabular-nums text-slate-200">{fmtFiat(Math.abs(m.bankFeesFiat))} {fiat}</strong>
                  </span>
                </div>
              ) : (
                <span className="text-slate-400">
                  Origen: <span className="font-mono text-slate-300 font-medium">100% Binance P2P</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Indicadores analíticos (% sobre volumen y promedio por orden) */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">% volumen:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {m.matchedCrypto > 0 && m.totalCommissionsCrypto > 0.0001
                  ? `${((m.totalCommissionsCrypto / m.matchedCrypto) * 100).toFixed(2)}%`
                  : '0,00%'}
              </span>
            </div>
            {m.completedOrdersCount > 0 && (
              <>
                <span className="text-slate-600 select-none">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-normal">Promedio/ord:</span>
                  <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                    {fmtUsdt(Math.abs(m.totalCommissionsCrypto) / m.completedOrdersCount)} {selectedAsset}
                  </span>
                </div>
              </>
            )}
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

          {/* Métrica Principal: Volumen Total en grande (sin mención de fiat) */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {fmtUsdt(m.totalCryptoVolume)} {selectedAsset}
              </span>
            </div>

            {/* Línea Secundaria Relevante: Desglose de Compras y Ventas */}
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400/90">
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Compras:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {fmtUsdt(m.buyCryptoTotal)}
                </span>
              </div>
              <span className="text-slate-600 select-none">·</span>
              <div className="flex items-center gap-1.5 text-rose-400/90">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Ventas:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {fmtUsdt(m.sellCryptoTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Volumen Ciclado e Inventario Neto */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Ciclado:</span>
              <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                {fmtUsdt(m.matchedCrypto)} {selectedAsset}
              </span>
            </div>
            <span className="text-slate-600 select-none">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Inventario:</span>
              <span
                className={`font-mono text-xs tabular-nums font-medium ${
                  m.netInventoryCrypto > 0.005
                    ? 'text-emerald-400'
                    : m.netInventoryCrypto < -0.005
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {m.netInventoryCrypto > 0.005 ? '+' : ''}
                {fmtUsdt(m.netInventoryCrypto)} {selectedAsset}
              </span>
            </div>
          </div>
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

          {/* Métrica Principal: Rotación Total Fiat en grande */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {fmtFiat(m.totalFiatVolume)} {fiat}
              </span>
            </div>

            {/* Línea Secundaria Relevante: Desglose de Salidas (Compras) y Entradas (Ventas) */}
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400/90">
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Salidas:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {fmtFiat(m.buyFiatTotal)}
                </span>
              </div>
              <span className="text-slate-600 select-none">·</span>
              <div className="flex items-center gap-1.5 text-rose-400/90">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Entradas:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {fmtFiat(m.sellFiatTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Flujo Neto Bancario */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Flujo neto:</span>
              <span
                className={`font-mono text-xs tabular-nums font-medium ${
                  m.netCashFlowFiat > 0.005
                    ? 'text-emerald-400'
                    : m.netCashFlowFiat < -0.005
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {m.netCashFlowFiat > 0.005 ? '+' : ''}
                {fmtFiat(m.netCashFlowFiat)} {fiat}
              </span>
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

          {/* Métrica Principal: Total Órdenes Gestionadas + Completadas al lado */}
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-white tabular-nums block">
                {m.totalOrdersCount} <span className="text-xs font-sans font-normal text-slate-400">órdenes</span>
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400 font-medium">
                ({m.completedOrdersCount} completadas)
              </span>
            </div>

            {/* Línea Secundaria Relevante: Desglose de Compras vs Ventas */}
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400/90">
                <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Compras:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {m.buyOrdersCount}
                </span>
              </div>
              <span className="text-slate-600 select-none">·</span>
              <div className="flex items-center gap-1.5 text-rose-400/90">
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                <span className="text-slate-400 text-xs font-normal">Ventas:</span>
                <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                  {m.sellOrdersCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de tarjeta anclado al fondo: Tasa de efectividad, canceladas condicionales y Ticket promedio */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs font-normal">Efectividad:</span>
              <span
                className={`font-mono text-xs tabular-nums font-medium ${
                  m.completionRatePct >= 95
                    ? 'text-emerald-400'
                    : m.completionRatePct >= 80
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {m.completionRatePct != null ? `${m.completionRatePct.toFixed(1)}%` : '100%'}
              </span>
              {m.cancelledOrdersCount > 0 && (
                <span className="text-rose-400/90 text-xs font-mono tabular-nums">
                  ({m.cancelledOrdersCount} canc.)
                </span>
              )}
            </div>
            {m.avgTicketCrypto > 0 && (
              <>
                <span className="text-slate-600 select-none">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-normal">Ticket:</span>
                  <span className="font-mono text-xs tabular-nums font-medium text-slate-200">
                    {fmtUsdt(m.avgTicketCrypto)} {selectedAsset}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
