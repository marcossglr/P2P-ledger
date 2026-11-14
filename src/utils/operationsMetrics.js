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
 * Normaliza y estandariza las métricas operativas provistas por el backend (Rust).
 * Actúa como contrato universal e inmutable de datos para componentes KPI y resúmenes.
 *
 * @param {Object} stats Objeto analytics del backend
 * @param {Array} [orders] Lista de órdenes como fallback de conteo
 * @returns {Object} Contrato normalizado de métricas
 */
export function normalizeKpiMetrics(stats = {}, orders = []) {
  // 1. Precios y Tasas Ponderadas
  const wacBuy = Number(stats.wac_buy_price || stats.wac_buy || 0);
  const wapSell = Number(stats.wap_sell_price || stats.wap_sell || 0);
  const refRate = wacBuy > 0 ? wacBuy : wapSell > 0 ? wapSell : 0;
  const spreadAbs = Number(stats.spread_abs || 0);
  const spreadPct = Number(stats.spread_pct || 0);

  // 2. Resultados de Ganancia (P&L Escuela A)
  const grossProfitCrypto =
    stats.gross_profit_usdt != null
      ? Number(stats.gross_profit_usdt)
      : refRate > 0
      ? Number(stats.gross_profit_fiat || 0) / refRate
      : 0;
  const grossProfitFiat = Number(stats.gross_profit_fiat || 0);

  const bankFeesCrypto =
    stats.bank_fees_usdt != null
      ? Number(stats.bank_fees_usdt)
      : refRate > 0
      ? Number(stats.estimated_bank_fees_fiat || stats.total_bank_fees_fiat || 0) / refRate
      : 0;
  const bankFeesFiat = Number(stats.total_bank_fees_fiat || stats.estimated_bank_fees_fiat || 0);

  const binanceCommissionsCrypto = Number(stats.total_commission_usdt || 0);
  const binanceCommissionsFiat = Number(
    stats.commission_fiat_cost != null
      ? stats.commission_fiat_cost
      : binanceCommissionsCrypto * refRate
  );

  const totalCommissionsCrypto = binanceCommissionsCrypto + bankFeesCrypto;
  const totalCommissionsFiat = binanceCommissionsFiat + bankFeesFiat;

  const netProfitCrypto =
    stats.net_profit_usdt != null
      ? Number(stats.net_profit_usdt)
      : grossProfitCrypto - bankFeesCrypto;
  const netProfitFiat = Number(stats.net_profit_fiat || 0);

  // 3. Volúmenes y Ciclado Comercial
  const matchedCrypto = Number(stats.matched_volume_crypto || stats.matched_usdt_volume || 0);
  const netMarginPct = matchedCrypto > 0 ? (netProfitCrypto / matchedCrypto) * 100 : 0;

  const buyCryptoTotal = Number(stats.buy_usdt_total || stats.buy_crypto || 0);
  const sellCryptoTotal = Number(stats.sell_usdt_total || stats.sell_crypto || 0);
  const totalCryptoVolume = Number(
    stats.total_usdt_volume != null
      ? stats.total_usdt_volume
      : buyCryptoTotal + sellCryptoTotal
  );

  const netInventoryCrypto =
    stats.net_inventory_usdt !== undefined && stats.net_inventory_usdt !== null
      ? Number(stats.net_inventory_usdt)
      : buyCryptoTotal - sellCryptoTotal;

  const buyFiatTotal = Number(stats.buy_fiat_total || stats.buy_fiat || 0);
  const sellFiatTotal = Number(stats.sell_fiat_total || stats.sell_fiat || 0);
  const totalFiatVolume = Number(
    stats.total_fiat_volume != null
      ? stats.total_fiat_volume
      : buyFiatTotal + sellFiatTotal
  );
  const netCashFlowFiat = sellFiatTotal - buyFiatTotal;

  // 4. Operativa y Conteo de Órdenes
  const completedOrdersCount = Number(
    stats.completed_orders ?? stats.total_orders ?? orders?.length ?? 0
  );
  const buyOrdersCount = Number(stats.buy_count || 0);
  const sellOrdersCount = Number(stats.sell_count || 0);
  const cancelledOrdersCount = Number(stats.cancelled_orders || 0);
  const totalOrdersCount = completedOrdersCount + cancelledOrdersCount;
  const completionRatePct =
    stats.completion_rate_pct != null
      ? Number(stats.completion_rate_pct)
      : totalOrdersCount > 0
      ? (completedOrdersCount / totalOrdersCount) * 100
      : 100;
  const avgTicketCrypto =
    completedOrdersCount > 0 ? totalCryptoVolume / completedOrdersCount : 0;

  // Estados derivados de conveniencia
  const isProfit = netProfitCrypto > 0.005;
  const isLoss = netProfitCrypto < -0.005;

  return {
    // Tasas
    wacBuy,
    wapSell,
    refRate,
    spreadAbs,
    spreadPct,

    // P&L
    grossProfitCrypto,
    grossProfitFiat,
    bankFeesCrypto,
    bankFeesFiat,
    binanceCommissionsCrypto,
    binanceCommissionsFiat,
    totalCommissionsCrypto,
    totalCommissionsFiat,
    netProfitCrypto,
    netProfitFiat,
    netMarginPct,
    isProfit,
    isLoss,

    // Volúmenes Cripto
    matchedCrypto,
    buyCryptoTotal,
    sellCryptoTotal,
    totalCryptoVolume,
    netInventoryCrypto,

    // Volúmenes Fiat
    buyFiatTotal,
    sellFiatTotal,
    totalFiatVolume,
    netCashFlowFiat,

    // Órdenes
    totalOrdersCount,
    completedOrdersCount,
    buyOrdersCount,
    sellOrdersCount,
    cancelledOrdersCount,
    completionRatePct,
    avgTicketCrypto,

    // Aliases de compatibilidad heredada (para evitar cualquier quiebre puntual)
    matchedUsdt: matchedCrypto,
    netProfitUsdt: netProfitCrypto,
    grossProfitUsdt: grossProfitCrypto,
    bankFeesUsdt: bankFeesCrypto,
    totalCommissionsAllUsdt: totalCommissionsCrypto,
    totalCommissionsAllFiat: totalCommissionsFiat,
    buyUsdtTotal: buyCryptoTotal,
    sellUsdtTotal: sellCryptoTotal,
    netInventoryUsdt: netInventoryCrypto,
    avgTicketUsdt: avgTicketCrypto,
  };
}

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
      : Number(bankInventory?.consolidated?.ref_wac_rate || 0) > 0
      ? Number(bankInventory.consolidated.ref_wac_rate)
      : Number(stats.wap_sell_price) > 0
      ? Number(stats.wap_sell_price)
      : Number(bankInventory?.consolidated?.reference_rate || 1);

  // Ganancia bruta contable en USDT (si Rust ya la envió calculada bajo Escuela A, respetarla)
  const grossProfitUsdt =
    stats.gross_profit_usdt != null
      ? Number(stats.gross_profit_usdt)
      : refRate > 0
      ? (stats.gross_profit_fiat || 0) / refRate
      : 0;

  // Comisiones bancarias convertidas a USDT
  const bankFeesUsdt =
    stats.bank_fees_usdt != null
      ? Number(stats.bank_fees_usdt)
      : refRate > 0
      ? (stats.estimated_bank_fees_fiat || 0) / refRate
      : 0;

  // Ganancia neta contable en USDT
  const netProfitUsdt =
    stats.net_profit_usdt != null
      ? Number(stats.net_profit_usdt)
      : grossProfitUsdt - bankFeesUsdt;

  // Total de comisiones unificadas en USDT y en Fiat
  const totalCommissionsAllUsdt =
    (stats.total_commission_usdt || 0) + bankFeesUsdt;
  const totalCommissionsAllFiat =
    (stats.commission_fiat_cost || 0) + (stats.estimated_bank_fees_fiat || 0);

  // Margen neto % sobre el volumen USDT realmente arbitrado
  const matchedUsdt = Number(stats.matched_volume_crypto || stats.matched_usdt_volume || 0);
  const netMarginPct =
    matchedUsdt > 0 ? (netProfitUsdt / matchedUsdt) * 100 : 0;

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
    netProfitUsdt,
    totalCommissionsAllUsdt,
    totalCommissionsAllFiat,
    matchedUsdt,
    netMarginPct,
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
    `• Posición Consolidada: ${fmtUsdt(metrics.totalCapitalConsolidatedUsdt)} USDT (incluye ${fmtFiat(metrics.totalBankBs)} ${fiat})`,
  ];

  return lines.filter(Boolean).join('\n');
}
