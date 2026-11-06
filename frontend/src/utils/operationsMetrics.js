/**
 * Utilidades puras para el cálculo de métricas financieras de la jornada P2P
 * y generación de resúmenes de texto para compartir.
 */

export const fmtFiat = (n) =>
  Number(n || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtUsdt = (n) =>
  Number(n || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtRate = (n) =>
  Number(n || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

/**
 * Computa las métricas derivadas financieras para el dashboard de operaciones
 */
export function computeOperationsMetrics({
  stats = {},
  bankInventory = null,
  fundingWallet = null,
  ordersCount = 0,
}) {
  const refRate =
    Number(stats.wac_buy_price) > 0
      ? Number(stats.wac_buy_price)
      : Number(stats.wap_sell_price) > 0
      ? Number(stats.wap_sell_price)
      : Number(bankInventory?.consolidated?.reference_rate || 1);

  // Ganancia bruta contable en USDT
  const grossProfitUsdt =
    refRate > 0 ? (stats.gross_profit_fiat || 0) / refRate : 0;

  // Comisiones bancarias convertidas a USDT
  const bankFeesUsdt =
    refRate > 0 ? (stats.estimated_bank_fees_fiat || 0) / refRate : 0;

  // Total de comisiones unificadas en USDT y en Fiat
  const totalCommissionsAllUsdt =
    (stats.total_commission_usdt || 0) + bankFeesUsdt;
  const totalCommissionsAllFiat =
    (stats.commission_fiat_cost || 0) + (stats.estimated_bank_fees_fiat || 0);

  // Margen neto % sobre el volumen USDT realmente arbitrado
  const matchedUsdt = Number(stats.matched_usdt_volume || 0);
  const netMarginPct =
    matchedUsdt > 0 ? ((stats.net_profit_usdt || 0) / matchedUsdt) * 100 : 0;

  // Tasa de venta Breakeven (punto de equilibrio con comisiones)
  const breakevenSellRate =
    Number(stats.wac_buy_price || 0) > 0 && matchedUsdt > 0
      ? Number(stats.wac_buy_price) + totalCommissionsAllFiat / matchedUsdt
      : Number(stats.wac_buy_price || 0);

  // Ticket promedio por operación en USDT
  const completedCount = Number(
    stats.completed_orders ?? stats.total_orders ?? ordersCount ?? 0
  );
  const avgTicketUsdt =
    completedCount > 0
      ? Number(stats.total_usdt_volume || 0) / completedCount
      : 0;

  // Saldo bancario consolidado
  const totalBankBs = Number(
    bankInventory?.consolidated?.total_calculated_balance_bs || 0
  );
  const totalBankUsdt = Number(
    bankInventory?.consolidated?.equivalent_usdt ||
      (refRate > 0 ? totalBankBs / refRate : 0)
  );

  // Fondos en Binance (Cuenta Fondos P2P)
  const fw = fundingWallet || {
    free: 0,
    locked: 0,
    total: 0,
    source: 'NONE',
  };
  const binanceFundingTotal = Number(fw.total || 0);
  const binanceFundingFree = Number(fw.free || 0);
  const binanceFundingLocked = Number(fw.locked || 0);

  // Posición Consolidada Global (Binance Fondos USDT + Bancos en Bs convertidos a USDT)
  const totalCapitalConsolidatedUsdt = binanceFundingTotal + totalBankUsdt;
  const totalCapitalConsolidatedBs = totalCapitalConsolidatedUsdt * refRate;

  return {
    refRate,
    grossProfitUsdt,
    bankFeesUsdt,
    totalCommissionsAllUsdt,
    totalCommissionsAllFiat,
    matchedUsdt,
    netMarginPct,
    breakevenSellRate,
    completedCount,
    avgTicketUsdt,
    totalBankBs,
    totalBankUsdt,
    binanceFundingTotal,
    binanceFundingFree,
    binanceFundingLocked,
    totalCapitalConsolidatedUsdt,
    totalCapitalConsolidatedBs,
  };
}

/**
 * Genera el texto estructurado del resumen diario para copiar al portapapeles
 */
export function buildDailySummaryText({
  stats = {},
  metrics = {},
  serverToday,
  fiat = 'VES',
}) {
  const netProfitSign = Number(stats.net_profit_usdt || 0) > 0.005 ? '+' : '';
  const marginText =
    metrics.matchedUsdt > 0
      ? ` [${metrics.netMarginPct > 0.005 ? '+' : ''}${metrics.netMarginPct.toFixed(2)}% margen]`
      : '';
  const spreadSign = Number(stats.spread_pct || 0) > 0.005 ? '+' : '';

  const lines = [
    `📊 Resumen de Jornada P2P (${serverToday})`,
    `• Ganancia Neta: ${netProfitSign}${fmtUsdt(stats.net_profit_usdt)} USDT (${fmtFiat(stats.net_profit_fiat)} ${fiat})${marginText}`,
    `• Volumen Operado: ${fmtUsdt(stats.total_usdt_volume)} USDT (${metrics.completedCount} órdenes)`,
    `  ↳ Compras: ${fmtUsdt(stats.buy_usdt_total)} USDT · Ventas: ${fmtUsdt(stats.sell_usdt_total)} USDT`,
    `• WAC Compra: ${fmtRate(stats.wac_buy_price)} | WAP Venta: ${fmtRate(stats.wap_sell_price)} | Spread: ${spreadSign}${Number(stats.spread_pct || 0).toFixed(2)}%`,
    metrics.breakevenSellRate > 0 ? `• Tasa Piso Breakeven: ${fmtRate(metrics.breakevenSellRate)} ${fiat}` : null,
    `• Posición Consolidada: ${fmtUsdt(metrics.totalCapitalConsolidatedUsdt)} USDT (incluye ${fmtFiat(metrics.totalBankBs)} ${fiat})`,
  ];

  return lines.filter(Boolean).join('\n');
}
