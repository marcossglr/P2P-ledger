import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Calculator,
  Code2,
  Search,
  Sliders,
  TrendingUp,
  Scale,
  ArrowRightLeft,
  RefreshCw,
  FileCode,
  Info,
  Wrench,
  CheckCircle2,
  Layers,
} from 'lucide-react';

const FORMULA_CATEGORIES = [
  { id: 'ALL', label: 'Todas las Fórmulas', icon: Layers },
  { id: 'RATES', label: 'Tasas (WAC/WAP) y Spread', icon: TrendingUp },
  { id: 'PNL', label: 'Ganancia (P&L) y Comisiones', icon: Calculator },
  { id: 'INVENTORY', label: 'Volumen e Inventario USDT', icon: Scale },
  { id: 'DAILY', label: 'Rendimiento Diario', icon: BookOpen },
  { id: 'RECONCILIATION', label: 'Conciliación Bancaria PDF', icon: ArrowRightLeft },
  { id: 'SYNC_PARSERS', label: 'Sincronización y Parsers', icon: RefreshCw },
];

const FORMULAS_DATA = [
  {
    id: 'wac_buy',
    category: 'RATES',
    title: 'Costo Promedio Ponderado de Compra (WAC)',
    variable: 'wac_buy_price',
    file: 'backend/app/services/analytics.py (Línea 119)',
    formula: 'WAC_Compra = Σ(Monto_Fiat_Compras) / Σ(Cantidad_USDT_Compras)',
    codeSnippet: 'wac_buy = (buy_fiat / buy_usdt) if buy_usdt > 0 else 0.0',
    description:
      'Calcula el precio promedio real pagado por cada 1 USDT adquirido según los anuncios pactados. Pondera cada orden por su volumen en cripto para reflejar la tasa exacta de adquisición del mercado.',
    example:
      'Si compras 100 USDT a 1,000 VES y 900 USDT a 1,004 VES, el WAC es 904,600 / 1,000 = 1,003.60 VES/USDT.',
    futureAdjustment:
      'Si deseas que la comisión de compra se absorba en la tasa unitaria en lugar de deducirse como costo global, cambia buy_usdt por (buy_usdt - buy_comm_usdt).',
  },
  {
    id: 'wap_sell',
    category: 'RATES',
    title: 'Precio Promedio Ponderado de Venta (WAP)',
    variable: 'wap_sell_price',
    file: 'backend/app/services/analytics.py (Línea 80)',
    formula: 'WAP_Venta = Σ(Monto_Fiat_Ventas) / Σ(Cantidad_USDT_Ventas)',
    codeSnippet: 'wap_sell = (sell_fiat / sell_usdt) if sell_usdt > 0 else 0.0',
    description:
      'Calcula el precio efectivo en moneda Fiat recibido por cada 1 USDT vendido durante el período seleccionado.',
    example:
      'Si vendes 500 USDT a 43.50 VES (21,750 VES) y 500 USDT a 44.00 VES (22,000 VES), el WAP es 43,750 / 1,000 = 43.75 VES/USDT.',
    futureAdjustment:
      'Si deseas descontar cargos fijos de pasarela directamente sobre la tasa de venta promedio, puedes restarlos del numerador sell_fiat en la línea 80 de analytics.py.',
  },
  {
    id: 'spread',
    category: 'RATES',
    title: 'Spread Promedio Ponderado (Absoluto y Porcentual)',
    variable: 'spread_abs / spread_pct',
    file: 'backend/app/services/analytics.py (Líneas 83-84)',
    formula: 'Spread_Abs = WAP_Venta - WAC_Compra   |   Spread_% = ((WAP_Venta - WAC_Compra) / WAC_Compra) × 100',
    codeSnippet:
      'spread_abs = (wap_sell - wac_buy) if (wac_buy > 0 and wap_sell > 0) else 0.0\nspread_pct = ((wap_sell - wac_buy) / wac_buy * 100.0) if (wac_buy > 0 and wap_sell > 0) else 0.0',
    description:
      'Mide el margen bruto ganado por cada 1 USDT arbitrado (en moneda Fiat y en porcentaje sobre el costo de adquisición). Solo se activa cuando existen tanto compras como ventas en el filtro.',
    example:
      'Con WAC = 42.38 VES y WAP = 43.34 VES: Spread_Abs = +0.96 VES por USDT, lo que equivale a un Spread_% = (0.96 / 42.38) × 100 = 2.265%.',
    futureAdjustment:
      'Si en algún momento prefieres calcular el margen sobre el precio de venta (Margin on Sales) en lugar de sobre el costo de compra (Markup), cambia el divisor wac_buy por wap_sell en la línea 84.',
  },
  {
    id: 'breakeven_sell_rate',
    category: 'RATES',
    title: 'Tasa Piso Breakeven (Punto de Equilibrio de Venta)',
    variable: 'breakevenSellRate',
    file: 'frontend/src/components/HistoryOperationsView.jsx & OperationsDashboard.jsx',
    formula: 'Tasa_Piso_Breakeven = WAC_Compra + (Comisiones_Totales_Fiat / Volumen_Arbitrado_USDT)',
    codeSnippet:
      'breakevenSellRate = Number(wac_buy) + totalCommissionsAllFiat / matchedUsdt',
    description:
      'Calcula el precio de venta mínimo indispensable en Bs por cada USDT para salir tablas (0 ganancia y 0 pérdida). Si vendes a una tasa menor a esta, la operación genera pérdida real por efecto de las comisiones de Binance y del banco.',
    example:
      'Si compraste a WAC = 1,003.73 VES y las comisiones totales equivalen a 7,467.75 VES sobre 1,542.96 USDT arbitrados (4.84 VES/USDT de comisión), la Tasa Piso es 1,003.73 + 4.84 = 1,008.57 VES/USDT.',
    futureAdjustment:
      'Puedes añadir un margen de seguridad extra (ej. +0.20%) multiplicando la tasa piso por 1.002.',
  },
  {
    id: 'matched_volume',
    category: 'INVENTORY',
    title: 'Volumen USDT Arbitrado / Ciclo Cerrado',
    variable: 'matched_usdt_volume',
    file: 'backend/app/services/analytics.py (Línea 87)',
    formula: 'Volumen_Arbitrado_USDT = mín(Total_USDT_Comprados, Total_USDT_Vendidos)',
    codeSnippet: 'matched_usdt_volume = min(buy_usdt, sell_usdt)',
    description:
      'Determina cuántos USDT completaron el ciclo completo de Compra + Venta en el período. Evita mostrar ganancias ficticias si compraste mucho inventario pero aún no lo has vendido (o viceversa).',
    example:
      'Si compraste 3,500 USDT y vendiste 3,450 USDT en el período, el volumen arbitrado es 3,450 USDT (los 50 USDT restantes quedan como inventario disponible).',
    futureAdjustment:
      'Para cambiar de modelo de "Ciclo Cerrado del Período" a contabilidad FIFO estricta lote por lote entre distintos meses, se puede reemplazar esta función en analytics.py.',
  },
  {
    id: 'gross_profit',
    category: 'PNL',
    title: 'Ganancia Bruta Realizada en Fiat',
    variable: 'gross_profit_fiat',
    file: 'backend/app/services/analytics.py (Línea 88)',
    formula: 'Ganancia_Bruta_Fiat = Volumen_Arbitrado_USDT × Spread_Abs',
    codeSnippet: 'gross_profit_fiat = matched_usdt_volume * spread_abs if matched_usdt_volume > 0 else 0.0',
    description:
      'Es la utilidad bruta generada por el diferencial cambiario (Spread) aplicada exclusivamente sobre los USDT que completaron el ciclo de compra y venta, antes de descontar comisiones de plataforma o banco.',
    example:
      'Con 3,450 USDT arbitrados y un Spread_Abs de 0.96 VES/USDT: Ganancia Bruta = 3,450 × 0.96 = 3,312.00 VES.',
    futureAdjustment:
      'Si operas únicamente vendiendo USDT propios (sin compras en P2P) y deseas medir ganancia contra una tasa externa de referencia (ej. BCV o Paralelo), puedes añadir un parámetro reference_buy_rate.',
  },
  {
    id: 'binance_commission',
    category: 'PNL',
    title: 'Valorización de Comisiones Binance P2P (USDT → Fiat)',
    variable: 'total_commission_usdt / commission_fiat_cost',
    file: 'backend/app/services/analytics.py (Líneas 90-93) & binance_api.py (Línea 151)',
    formula: 'Comisión_Fiat = (Comisión_Compras_USDT + Comisión_Ventas_USDT) × Tasa_Referencia',
    codeSnippet:
      'total_comm_usdt = buy_comm_usdt + sell_comm_usdt\nref_rate = wac_buy if wac_buy > 0 else wap_sell\ncomm_fiat_cost = total_comm_usdt * ref_rate',
    description:
      'Suma todas las comisiones Maker y Taker cobradas por Binance en USDT y las convierte a moneda Fiat multiplicándolas por el Costo Promedio de Reposición (WAC de compra, o WAP si solo hubo ventas).',
    example:
      'Si Binance cobró 6.95 USDT en comisiones totales y tu costo de reposición WAC es 42.38 VES/USDT, el costo en Fiat es 6.95 × 42.38 = 294.54 VES.',
    futureAdjustment:
      'Si prefieres valorizar las comisiones de venta a la tasa WAP y las de compra a la tasa WAC por separado, reemplaza la línea 93 por: (buy_comm_usdt * wac_buy) + (sell_comm_usdt * wap_sell).',
  },
  {
    id: 'bank_fees',
    category: 'PNL',
    title: 'Comisión Bancaria / Pago Móvil Estimada',
    variable: 'estimated_bank_fees_fiat',
    file: 'backend/app/services/analytics.py (Línea 96)',
    formula: 'Comisión_Bancaria_Fiat = Total_Fiat_Compras × (%_Comisión_Bancaria / 100)',
    codeSnippet: 'estimated_bank_fees_fiat = buy_fiat * (bank_fee_rate_pct / 100.0) if bank_fee_rate_pct > 0 else 0.0',
    description:
      'Calcula el gasto bancario por emisión de pagos (ej. 0.3% de Pago Móvil interbancario o impuestos a débitos bancarios) aplicándolo sobre las salidas de dinero Fiat (Compras P2P). El porcentaje es ajustable en vivo desde el Dashboard.',
    example:
      'Si enviaste 148,490 VES en compras de USDT y tienes configurada una comisión bancaria de 0.3%, el costo bancario estimado es 148,490 × 0.003 = 445.47 VES.',
    futureAdjustment:
      'Si tu banco también te deduce comisión al recibir transferencias en Ventas, cambia buy_fiat por (buy_fiat + sell_fiat) en la línea 96 de analytics.py.',
  },
  {
    id: 'net_profit',
    category: 'PNL',
    title: 'Ganancia Neta Realizada (P&L en Fiat y USDT)',
    variable: 'net_profit_fiat / net_profit_usdt',
    file: 'backend/app/services/analytics.py (Líneas 144-147)',
    formula: 'Ganancia_Neta_Fiat = Ganancia_Bruta - Comisiones_Binance_Fiat - Comisiones_Bancarias_Fiat\nGanancia_Neta_USDT = Ganancia_Neta_Fiat / WAC',
    codeSnippet:
      'net_profit_fiat = gross_profit_fiat - comm_fiat_cost - estimated_bank_fees_fiat\nnet_profit_usdt = (net_profit_fiat / ref_rate) if ref_rate > 0 else 0.0',
    description:
      'Es la utilidad limpia realizada por ciclo cerrado de arbitraje. Descuenta el 100% de las comisiones de Binance (Maker + Taker de compras y ventas) y los gastos bancarios de Pago Móvil sobre las salidas de dinero.',
    example:
      'Con Ganancia Bruta de 8,862.72 VES, Comisiones Binance de 7,467.75 VES (7.44 USDT) y Comisiones Bancarias de 0 VES: Ganancia Neta = 1,394.97 VES (≈ 1.39 USDT netos).',
    futureAdjustment:
      'Si deseas incluir costos fijos operativos de personal o software, puedes restarlos en la línea 144 de analytics.py.',
  },
  {
    id: 'net_inventory',
    category: 'INVENTORY',
    title: 'Balance de Inventario Neto en USDT',
    variable: 'net_inventory_usdt',
    file: 'backend/app/services/analytics.py (Línea 139)',
    formula: 'Inventario_Neto_USDT = (USDT_Comprados - Comisiones_Compra) - (USDT_Vendidos + Comisiones_Venta)',
    codeSnippet: '"net_inventory_usdt": round((buy_usdt - buy_comm_usdt) - (sell_usdt + sell_comm_usdt), 4)',
    description:
      'Refleja la variación exacta de tu saldo en la billetera de Fondos de Binance. En compras, la comisión reduce los USDT que entran; en ventas, la comisión incrementa los USDT que salen de tu billetera.',
    example:
      'Si compraste 3,500 USDT (comisión 3.50 USDT -> entran 3,496.50) y vendiste 3,450 USDT (comisión 3.45 USDT -> salen 3,453.45), tu inventario neto varió en +43.05 USDT.',
    futureAdjustment:
      'Si como Taker la comisión fue cobrada de otra forma o con descuento de BNB, este cálculo en la línea 139 permite ajustar cómo impacta cada lado.',
  },
  {
    id: 'daily_series',
    category: 'DAILY',
    title: 'Cálculo de Rendimiento Diario y Fallback de Tasas',
    variable: 'daily_series',
    file: 'backend/app/services/analytics.py (Líneas 102-122)',
    formula: 'P&L_Día = [mín(Compra_Día, Venta_Día) × (WAP_Día - WAC_Día)] - (Comisión_Día_USDT × WAC_Día)',
    codeSnippet:
      'd_wac = (d["buy_fiat"] / d["buy_usdt"]) if d["buy_usdt"] > 0 else wac_buy\nd_wap = (d["sell_fiat"] / d["sell_usdt"]) if d["sell_usdt"] > 0 else wap_sell\nd_matched = min(d["buy_usdt"], d["sell_usdt"])\nd_gross = d_matched * (d_wap - d_wac)\nd_comm_fiat = d["comm_usdt"] * (d_wac if d_wac > 0 else ref_rate)',
    description:
      'Agrupa las órdenes por fecha (YYYY-MM-DD) y calcula las tasas promedio de ese día específico. Si en un día hubo solo compras o solo ventas, utiliza como respaldo (fallback) la tasa promedio general del período para no romper las métricas de tasa.',
    example:
      'En un día donde compras 800 USDT a 42.30 y vendes 800 USDT a 43.22, el sistema calcula el spread exacto de ese día (+2.18%) y su ganancia neta diaria.',
    futureAdjustment:
      'Si deseas que el P&L diario también descuente el % de comisión bancaria estimada, añade "- (d[\'buy_fiat\'] * bank_fee_rate_pct / 100.0)" en la línea 120 de analytics.py.',
  },
  {
    id: 'reconciliation_2_tier',
    category: 'RECONCILIATION',
    title: 'Algoritmo de Conciliación Bancaria en 2 Niveles',
    variable: 'run_reconciliation()',
    file: 'backend/app/services/reconciler.py (Líneas 8-124)',
    formula:
      'Nivel 1 (Exacto): Ref_Banco ∈ Nota_Orden  Ó  (|Monto_Orden - Monto_Banco| ≤ 0.05  Y  Δ_Días == 0)\nNivel 2 (Ventana): |Monto_Orden - Monto_Banco| ≤ 1.00  Y  |Δ_Días| ≤ tolerance_days (2 días)',
    codeSnippet:
      'amt_exact = abs(float(o.fiat_amount) - float(b_amt)) <= 0.05\nsame_day = (o_dt and b_dt and abs((o_dt - b_dt).days) == 0)\n# Nivel 2:\namt_close = abs(float(o.fiat_amount) - float(b_amt)) <= 1.0\nin_window = abs((o_dt - b_dt).days) <= tolerance_days',
    description:
      'Cruza órdenes de Compra contra Débitos bancarios y órdenes de Venta contra Créditos bancarios. Primero empareja coincidencias exactas (por número de referencia de 5+ dígitos o monto idéntico el mismo día) y luego ejecuta una segunda pasada con tolerancia de ±1.00 unidad Fiat y ±2 días para transferencias diferidas o redondeos.',
    example:
      'Una orden de venta por 12,885.00 VES del 15/10 cruza en Nivel 1 con un crédito bancario de 12,885.00 VES del 15/10. Si el banco la registró el 16/10 por 12,884.50 VES, cruza en Nivel 2.',
    futureAdjustment:
      'Puedes ajustar la tolerancia de redondeo (actualmente 0.05 en Nivel 1 y 1.0 en Nivel 2) en las líneas 54 y 93 de reconciler.py, o cambiar tolerance_days en la llamada al endpoint /api/reconcile.',
  },
  {
    id: 'sync_and_normalizer',
    category: 'SYNC_PARSERS',
    title: 'Ventana Incremental (Solapamiento 12h) y Normalizador Numérico',
    variable: 'sync_binance_orders() / normalize_number()',
    file: 'backend/app/main.py (Líneas 170-175) & parsers.py (Líneas 8-48)',
    formula:
      'Inicio_Incremental = máx(Hace_90_Días, Último_Timestamp_SQLite - 12_Horas)\nRegla_Decimal = El último separador (coma o punto) a la derecha define los decimales',
    codeSnippet:
      'overlap_ms = 12 * 3600 * 1000\nstart_ms = max(ninety_days_ago_ms, int(latest_ts) - overlap_ms)',
    description:
      'La sincronización incremental retrocede 12 horas desde la última orden almacenada para capturar órdenes que estaban en apelación o liberación tardía, usando upsert por order_number para evitar duplicados. Por su parte, normalize_number() detecta automáticamente si un archivo CSV/PDF usa formato europeo (1.250,50) o americano (1,250.50).',
    example:
      'Tanto "21.050,75" como "21,050.75" se transforman limpiamente en el flotante 21050.75.',
    futureAdjustment:
      'Si sueles tener apelaciones en Binance que tardan más de 12 horas en resolverse, puedes subir overlap_ms a 24 o 48 horas en la línea 172 de backend/app/main.py.',
  },
  {
    id: 'bank_bs_inventory',
    category: 'INVENTORY',
    title: 'Inventario en Bs por Cuenta Bancaria y Cuadre de Posición Consolidada',
    variable: 'calculated_balance / total_calculated_balance_bs',
    file: 'backend/app/services/bank_inventory.py (compute_bank_inventory_summary)',
    formula:
      'Saldo_Calculado_Bs = Saldo_Base_Corte + Σ(Ventas_Bs) - Σ(Compras_Bs) - Σ(Comisión_Salida_Bs) ± Ajustes_Manuales\nDescuadre_Posición = Posición_Consolidada_Real_Banco - Saldo_Calculado_Bs',
    codeSnippet:
      'net_orders_flow = st["inflow_sell_bs"] - st["outflow_buy_bs"] - st["outflow_buy_fees_bs"]\ncalculated_balance = st["anchor_balance"] + net_orders_flow + st["manual_delta_bs"]',
    description:
      'Lleva en tiempo real el inventario en Bolívares (VES) de cada cuenta bancaria vinculando las órdenes según el método de pago (pay_method). Cada orden de VENTA posterior al último corte suma (+Bs) y cada orden de COMPRA resta (-Bs más la comisión de Pago Móvil/Transferencia si está activa). Al cuadrar manualmente contra la posición consolidada real del banco, el sistema registra el descuadre en la bitácora y establece el nuevo punto de corte.',
    example:
      'Si abriste Banesco con 65,000 Bs, recibiste +50,340 Bs en ventas hoy y pagaste -32,100 Bs en compras por Pago Móvil (con -96.30 Bs de comisión 0.3%), el sistema calcula 83,143.70 Bs. Si en Banesco ves 83,140.00 Bs, al cuadrar se ajusta a 83,140.00 Bs registrando una diferencia de -3.70 Bs.',
    futureAdjustment:
      'Puedes configurar por cada banco si aplica o no comisión de salida en Pago Móvil o Transferencia directamente desde la pestaña "Inventario Bs".',
  },
];

export default function FormulasDocsView() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado del Simulador Interactivo en Vivo
  const [simBuyUsdt, setSimBuyUsdt] = useState(1000);
  const [simBuyRate, setSimBuyRate] = useState(42.35);
  const [simSellUsdt, setSimSellUsdt] = useState(950);
  const [simSellRate, setSimSellRate] = useState(43.40);
  const [simCommUsdt, setSimCommUsdt] = useState(1.95);
  const [simBankFeePct, setSimBankFeePct] = useState(0.3);

  const simResults = useMemo(() => {
    const buyFiat = simBuyUsdt * simBuyRate;
    const sellFiat = simSellUsdt * simSellRate;
    const wac = simBuyUsdt > 0 ? buyFiat / simBuyUsdt : 0;
    const wap = simSellUsdt > 0 ? sellFiat / simSellUsdt : 0;
    const spreadAbs = wac > 0 && wap > 0 ? wap - wac : 0;
    const spreadPct = wac > 0 && wap > 0 ? ((wap - wac) / wac) * 100 : 0;
    const matchedUsdt = Math.min(simBuyUsdt, simSellUsdt);
    const grossProfitFiat = matchedUsdt * spreadAbs;
    const refRate = wac > 0 ? wac : wap;
    const commFiatCost = simCommUsdt * refRate;
    const bankFeeFiat = buyFiat * (simBankFeePct / 100);
    const netProfitFiat = grossProfitFiat - commFiatCost - bankFeeFiat;
    const netProfitUsdt = refRate > 0 ? netProfitFiat / refRate : 0;
    const netInventory = simBuyUsdt - simSellUsdt - simCommUsdt;

    return {
      buyFiat,
      sellFiat,
      wac,
      wap,
      spreadAbs,
      spreadPct,
      matchedUsdt,
      grossProfitFiat,
      commFiatCost,
      bankFeeFiat,
      netProfitFiat,
      netProfitUsdt,
      netInventory,
    };
  }, [simBuyUsdt, simBuyRate, simSellUsdt, simSellRate, simCommUsdt, simBankFeePct]);

  const filteredFormulas = useMemo(() => {
    return FORMULAS_DATA.filter((item) => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchesCat;
      return (
        matchesCat &&
        (item.title.toLowerCase().includes(q) ||
          item.variable.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.formula.toLowerCase().includes(q) ||
          item.file.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, searchQuery]);

  const fmt = (n, decimals = 2) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  return (
    <div className="space-y-6">
      {/* Encabezado de la Vista de Documentación */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-6 lg:flex-row lg:items-center">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-[11px] font-semibold text-amber-300">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Referencia Técnica y Financiera Auditable</span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Documentación de Cálculos, Fórmulas Matemáticas y Algoritmos
          </h2>
          <p className="max-w-3xl text-xs text-slate-300 leading-relaxed">
            Aquí puedes consultar cómo se calcula cada métrica del sistema, en qué archivo y línea exacta del código se
            encuentra y cómo ajustarla si cambian tus reglas de negocio. También se ha generado el archivo{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300">
              DOCUMENTACION_CALCULOS_Y_FORMULAS.md
            </code>{' '}
            en la raíz del proyecto.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs shrink-0">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Motor Analítico</span>
            <span className="font-mono font-semibold text-emerald-400">services/analytics.py</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Motor Conciliador</span>
            <span className="font-mono font-semibold text-amber-400">services/reconciler.py</span>
          </div>
        </div>
      </div>

      {/* Banner de Estándar Profesional de Tesorería */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
            <Scale className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">
              Estándar Operativo Profesional: Cripto como Base de Riqueza, Fiat como Canal
            </h3>
            <p className="text-slate-300 leading-relaxed">
              En arbitraje P2P con monedas inflacionarias (VES), medir utilidades en Fiat produce ilusión monetaria. Por estándar contable de mesas de dinero (OTC/FX), el balance patrimonial y la <strong>Ganancia Neta (P&L)</strong> se calculan y liquidan siempre en <strong>CRIPTO (USDT)</strong>. El <strong>FIAT (VES)</strong> se emplea exclusivamente para conciliar el flujo de caja y los extractos bancarios locales.
            </p>
          </div>
        </div>
      </div>

      {/* Simulador Interactivo de Fórmulas en Vivo */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Simulador Interactivo de Fórmulas (Laboratorio de Prueba)
              </h3>
              <p className="text-xs text-slate-400">
                Modifica cualquiera de los valores de entrada para verificar paso a paso cómo responden las ecuaciones del sistema
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
            Cálculo en Tiempo Real
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controles de Entrada */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">USDT Comprados (BuyUSDT)</label>
              <input
                type="number"
                value={simBuyUsdt}
                onChange={(e) => setSimBuyUsdt( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-emerald-400 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tasa Compra Prom. (WAC)</label>
              <input
                type="number"
                step="0.05"
                value={simBuyRate}
                onChange={(e) => setSimBuyRate( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-emerald-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">USDT Vendidos (SellUSDT)</label>
              <input
                type="number"
                value={simSellUsdt}
                onChange={(e) => setSimSellUsdt( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-amber-400 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tasa Venta Prom. (WAP)</label>
              <input
                type="number"
                step="0.05"
                value={simSellRate}
                onChange={(e) => setSimSellRate( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-amber-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Comisión Binance (USDT)</label>
              <input
                type="number"
                step="0.1"
                value={simCommUsdt}
                onChange={(e) => setSimCommUsdt( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-rose-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">% Comisión Bancaria Est.</label>
              <input
                type="number"
                step="0.05"
                value={simBankFeePct}
                onChange={(e) => setSimBankFeePct( parseFloat(e.target.value) || 0 )}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 tabular-nums text-rose-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Desglose Paso a Paso de Resultados */}
          <div className="lg:col-span-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">1. Volumen Fiat Compras / Ventas</span>
              <p className="mt-1 tabular-nums text-slate-200">
                Compras: <strong className="text-rose-300">{simResults.buyFiat > 0.01 ? '-' : ''}{fmt(simResults.buyFiat)} VES</strong>
              </p>
              <p className="tabular-nums text-slate-200">
                Ventas: <strong className="text-emerald-300">{simResults.sellFiat > 0.01 ? '+' : ''}{fmt(simResults.sellFiat)} VES</strong>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">2. Spread Unitario y Porcentual</span>
              <p className="mt-1 tabular-nums text-amber-300 font-bold">
                {simResults.spreadAbs > 0.0001 ? '+' : ''}{fmt(simResults.spreadAbs, 4)} VES/USDT ({simResults.spreadPct > 0.005 ? '+' : ''}{fmt(simResults.spreadPct, 2)}%)
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                = ({fmt(simResults.wap, 2)} - {fmt(simResults.wac, 2)}) / {fmt(simResults.wac, 2)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">3. Volumen Ciclado y Ganancia Bruta</span>
              <p className="mt-1 tabular-nums text-white font-bold">
                Bruta: {fmt(simResults.grossProfitFiat)} VES
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                = mín({simBuyUsdt}, {simSellUsdt}) → {fmt(simResults.matchedUsdt, 0)} USDT × {fmt(simResults.spreadAbs, 2)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-[11px] text-slate-400">4. Deducción de Comisiones</span>
              <p className="mt-1 tabular-nums text-rose-300">
                Binance: -{fmt(simResults.commFiatCost)} VES <span className="text-slate-500">({simCommUsdt} × {fmt(simResults.wac)})</span>
              </p>
              <p className="tabular-nums text-rose-300">
                Banco ({simBankFeePct}%): -{fmt(simResults.bankFeeFiat)} VES
              </p>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 block">
                  5. Resultado Final: Ganancia Neta (P&L)
                </span>
                <span className="tabular-nums text-[11px] text-slate-300">
                  {fmt(simResults.grossProfitFiat)} (Bruta) - {fmt(simResults.commFiatCost)} (Binance) - {fmt(simResults.bankFeeFiat)} (Banco)
                </span>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-lg font-bold text-white">
                  {fmt(simResults.netProfitFiat)} VES
                </span>
                <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  ≈ {fmt(simResults.netProfitUsdt)} USDT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtro por Categoría y Buscador */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {FORMULA_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar fórmula, variable o archivo..."
            className="w-64 rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Catálogo Detallado de Fórmulas y Reglas de Negocio */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredFormulas.map((f) => (
          <div
            key={f.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700/80 transition-colors"
          >
            <div className="space-y-3.5">
              {/* Header de la Tarjeta */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-amber-300">
                      <Code2 className="h-3 w-3" />
                      {f.variable}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 font-mono text-slate-400">
                      <FileCode className="h-3 w-3 text-emerald-400" />
                      {f.file}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque de Fórmula Matemática */}
              <div className="rounded-xl border border-amber-500/20 bg-slate-950 p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 block mb-1">
                  Fórmula Matemática
                </span>
                <pre className="whitespace-pre-wrap font-mono text-xs font-semibold text-white leading-relaxed">
                  {f.formula}
                </pre>
              </div>

              {/* Bloque de Código Exacto */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Implementación en Python
                </span>
                <pre className="overflow-x-auto font-mono text-[11px] text-emerald-300">
                  {f.codeSnippet}
                </pre>
              </div>

              {/* Explicación y Ejemplo */}
              <p className="text-xs text-slate-300 leading-relaxed">{f.description}</p>

              <div className="rounded-xl bg-slate-800/40 p-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Ejemplo Numérico:</span>
                </div>
                <p className="text-[11px] text-slate-400">{f.example}</p>
              </div>
            </div>

            {/* Guía para Ajustes Futuros */}
            <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-sky-300 mb-1">
                <Wrench className="h-3.5 w-3.5" />
                <span>¿Cómo ajustarlo en el futuro?</span>
              </div>
              <p className="text-[11px] text-sky-100/80 leading-relaxed">{f.futureAdjustment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
