import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  User,
  Calendar,
  Hash,
  ShieldCheck,
  Clock,
  Receipt,
  TrendingUp,
  Search,
  ArrowRightLeft,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function OrderDetailsModal({
  order,
  ordersList = [],
  onClose,
  onSelectOrder,
  onFilterCounterparty,
  onTogglePaymentChannel,
  bankFeePct = 0,
  wacBuyPrice = 0,
  wapSellPrice = 0,
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [localPaymentChannel, setLocalPaymentChannel] = useState('TRANSFERENCIA');

  const currentIndex = order
    ? ordersList.findIndex((o) => o.id === order.id || o.order_number === order.order_number)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < ordersList.length - 1;

  // Sincronizar canal de pago local cuando cambia la orden seleccionada
  useEffect(() => {
    if (!order) return;
    const pmLower = String(order.pay_method || '').toLowerCase();
    const defaultChannel =
      order.payment_channel ||
      (pmLower.includes('movil') || pmLower.includes('móvil')
        ? 'PAGO_MOVIL'
        : 'TRANSFERENCIA');
    setLocalPaymentChannel(defaultChannel);
  }, [order]);

  // Atajos de teclado: Escape (cerrar) y flechas (orden anterior / siguiente)
  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onSelectOrder) {
        onSelectOrder(ordersList[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext && onSelectOrder) {
        onSelectOrder(ordersList[currentIndex + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, hasPrev, hasNext, currentIndex, ordersList, onClose, onSelectOrder]);

  if (!order) return null;

  const isBuy = order.order_type === 'COMPRA';
  const isCancelled = order.order_status === 'CANCELLED';
  const isInProgress = order.order_status === 'IN_PROGRESS';
  const fiat = order.fiat_currency || 'VES';
  const asset = order.asset || 'USDT';

  const cryptoGross = Number(order.crypto_amount || 0);
  const commUsdt = Number(order.commission_usdt || 0);
  const unitPrice = Number(order.unit_price || 0);
  const fiatAmount = Number(order.fiat_amount || 0);

  // Impacto real en inventario USDT y flujo Fiat considerando canal de pago
  const isPagoMovilBuy = isBuy && localPaymentChannel === 'PAGO_MOVIL';
  const netUsdtImpact = isBuy ? Math.max(0, cryptoGross - commUsdt) : cryptoGross + commUsdt;
  const commFiatEquiv = commUsdt * unitPrice;
  const estBankFeeFiat =
    isPagoMovilBuy && bankFeePct > 0 ? fiatAmount * (bankFeePct / 100.0) : 0;
  const totalEffectiveFiat = isBuy ? fiatAmount + estBankFeeFiat : fiatAmount;

  // Tasa efectiva real por cada USDT neto recibido/entregado
  const effectiveRate = netUsdtImpact > 0 ? totalEffectiveFiat / netUsdtImpact : unitPrice;

  // Comparativa contra tasa promedio ponderada del período/jornada (WAC para compras, WAP para ventas)
  const refAvgRate = isBuy ? Number(wacBuyPrice || 0) : Number(wapSellPrice || 0);
  const rateDelta = refAvgRate > 0 ? unitPrice - refAvgRate : 0;
  const rateDeltaPct = refAvgRate > 0 ? (rateDelta / refAvgRate) * 100 : 0;
  const isFavorableVsAvg = isBuy ? rateDelta <= 0 : rateDelta >= 0;

  const fmtFiat = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtUsdt = (n) => {
    const num = Number(n || 0);
    // Mostrar 2 decimales si es entero o tiene 2 decimales, hasta 4 si tiene fracción extendida
    return num.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: num % 0.01 === 0 ? 2 : 4,
    });
  };

  const fmtRate = (n) =>
    Number(n || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });

  const copyValue = (key, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleTogglePayment = () => {
    const nextChannel = localPaymentChannel === 'PAGO_MOVIL' ? 'TRANSFERENCIA' : 'PAGO_MOVIL';
    setLocalPaymentChannel(nextChannel);
    if (onTogglePaymentChannel) {
      onTogglePaymentChannel(order, nextChannel);
    }
  };

  const renderReconcileBadge = (status) => {
    if (!status || status === 'UNMATCHED') {
      return (
        <span className="inline-flex h-6 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2 text-[11px] font-medium text-slate-400">
          <Clock className="h-3 w-3 shrink-0 text-slate-500" />
          <span>Sin conciliar</span>
        </span>
      );
    }
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 text-[11px] font-semibold text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        <span>Conciliada ({status})</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================
            CABECERA PINNED / HEADER SUPERIOR
        ======================================================== */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 py-3.5 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Ícono de tipo de orden centrado */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                isBuy
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              {isBuy ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>

            <div className="min-w-0 space-y-1">
              {/* Badges alineados con altura uniforme (h-6) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex h-6 items-center rounded-lg px-2 text-[11px] font-bold tracking-wide uppercase ${
                    isBuy
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {isBuy ? 'Compra' : 'Venta'} P2P
                </span>

                {isCancelled && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/15 px-2 text-[11px] font-bold text-rose-300">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>CANCELADA</span>
                  </span>
                )}

                {isInProgress && (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 text-[11px] font-bold text-sky-300 animate-pulse">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    <span>PROCESANDO</span>
                  </span>
                )}

                {renderReconcileBadge(order.status)}
              </div>

              {/* Título y subtítulo */}
              <div className="flex items-baseline gap-2">
                <h3 className="font-mono text-base font-bold text-white tracking-tight leading-none">
                  Orden #{order.order_number}
                </h3>
              </div>
            </div>
          </div>

          {/* Controles de navegación y cierre alineados con altura uniforme (h-8) */}
          <div className="flex items-center gap-2 shrink-0">
            {ordersList.length > 1 && currentIndex !== -1 && (
              <div className="flex h-8 items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => hasPrev && onSelectOrder(ordersList[currentIndex - 1])}
                  disabled={!hasPrev}
                  title="Orden anterior (Flecha izquierda ←)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 tabular-nums text-[11px] font-medium text-slate-400 select-none">
                  {currentIndex + 1} / {ordersList.length}
                </span>
                <button
                  type="button"
                  onClick={() => hasNext && onSelectOrder(ordersList[currentIndex + 1])}
                  disabled={!hasNext}
                  title="Orden siguiente (Flecha derecha →)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Cerrar modal (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ========================================================
            CUERPO DESPLAZABLE DEL MODAL
        ======================================================== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* BANNER INFORMATIVO SI ESTÁ EN PROCESO */}
          {isInProgress && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 flex items-start gap-3">
              <Loader2 className="h-5 w-5 text-sky-400 shrink-0 mt-0.5 animate-spin" />
              <div className="text-xs">
                <span className="font-semibold text-sky-200 block">Orden en Proceso</span>
                <span className="text-sky-300/80">
                  Esta orden aún no ha sido completada en Binance. Se encuentra en curso (esperando pago de la contraparte o liberación de criptomonedas).
                </span>
              </div>
            </div>
          )}

          {/* 1. HERO RESUMEN: DATOS ORIGINALES DE BINANCE P2P */}
          <div
            className={`rounded-2xl border p-4.5 sm:p-5 transition-all ${
              isBuy
                ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-slate-900/80 to-slate-950/90'
                : 'border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-slate-900/80 to-slate-950/90'
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 gap-3 sm:gap-0">
              {/* Métrica 1: Monto Total Fiat (Tal cual Binance) */}
              <div className="flex flex-col justify-between sm:pr-3.5 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-h-[16px] flex items-center">
                  Monto Total ({fiat})
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="tabular-nums text-xl font-bold tracking-tight text-white leading-none">
                    {fmtFiat(fiatAmount)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{fiat}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isBuy ? 'Pagado en banco' : 'Recibido en banco'}
                </p>
              </div>

              {/* Métrica 2: Precio Unitario (Tasa Binance) */}
              <div className="flex flex-col justify-between pt-2.5 sm:pt-0 sm:px-3.5 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-h-[16px] flex items-center">
                  Precio Unitario
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="tabular-nums text-xl font-bold tracking-tight text-slate-200 leading-none">
                    {fmtRate(unitPrice)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{fiat}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Tasa pactada anuncio
                </p>
              </div>

              {/* Métrica 3: Cantidad USDT (Tal cual Binance) */}
              <div className="flex flex-col justify-between pt-2.5 sm:pt-0 sm:px-3.5 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-h-[16px] flex items-center">
                  Cantidad ({asset})
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`tabular-nums text-xl font-bold tracking-tight leading-none ${
                      isBuy ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isBuy ? '+' : '-'}
                    {fmtUsdt(cryptoGross)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{asset}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isBuy ? 'Acreditado Binance' : 'Debitado Binance'}
                </p>
              </div>

              {/* Métrica 4: Comisión Binance P2P */}
              <div className="flex flex-col justify-between pt-2.5 sm:pt-0 sm:pl-3.5 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-h-[16px] flex items-center">
                  Comisión Binance
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`tabular-nums text-xl font-bold tracking-tight leading-none ${
                      commUsdt > 0 ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {commUsdt > 0 ? `-${fmtUsdt(commUsdt)}` : '0,00'}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{asset}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {commUsdt > 0 ? `≈ ${fmtFiat(commFiatEquiv)} ${fiat}` : 'Tarifa 0%'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. ANÁLISIS FINANCIERO DE RENDIMIENTO (Estilo Antigravity Desk) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Sub-tarjeta 1: Desglose Neto de Inventario */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 shadow-sm">
              <div>
                <div className="flex h-7 items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt
                      className={`h-4 w-4 shrink-0 ${
                        isBuy ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Impacto Neto de Inventario
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-400">
                    Billetera Fondos
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Volumen Nominal:</span>
                    <span className="tabular-nums font-medium text-slate-200">
                      {fmtUsdt(cryptoGross)} {asset}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Deducción de Comisión:</span>
                    <span className="tabular-nums font-medium text-rose-300">
                      {commUsdt > 0 ? `-${fmtUsdt(commUsdt)} ${asset}` : '0,00 USDT'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Neto Cripto alineado en la base */}
              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 mt-3 text-xs ${
                  isBuy
                    ? 'border-emerald-500/25 bg-emerald-950/20'
                    : 'border-amber-500/25 bg-amber-950/20'
                }`}
              >
                <span className="font-semibold text-slate-200">
                  {isBuy ? 'USDT Limpio Acreditado:' : 'USDT Real Descontado:'}
                </span>
                <span
                  className={`tabular-nums text-sm font-bold ${
                    isBuy ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isBuy ? '+' : '-'}
                  {fmtUsdt(netUsdtImpact)} {asset}
                </span>
              </div>
            </div>

            {/* Sub-tarjeta 2: Tasa Efectiva Neta & Bancos */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-950/60 p-4 shadow-sm">
              <div>
                <div className="flex h-7 items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-sky-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Costo / Retorno Efectivo
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {fiat}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Liquidado en Banco:</span>
                    <span className="tabular-nums font-medium text-slate-200">
                      {fmtFiat(fiatAmount)} {fiat}
                    </span>
                  </div>

                  {/* Recargo Bancario interactivo en Compras */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Gasto Bancario (Pago Móvil):</span>
                    {isBuy ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`tabular-nums font-medium ${
                            estBankFeeFiat > 0 ? 'text-rose-300' : 'text-emerald-300'
                          }`}
                        >
                          {estBankFeeFiat > 0
                            ? `+${fmtFiat(estBankFeeFiat)} ${fiat} (${bankFeePct}%)`
                            : '0,00 Bs (0%)'}
                        </span>
                        <button
                          type="button"
                          onClick={handleTogglePayment}
                          title="Alternar entre Pago Móvil (aplica comisión) y Transferencia Mismo Banco (0% comisión)"
                          className="inline-flex h-5 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 text-[10px] font-semibold text-slate-300 hover:border-amber-500/40 hover:text-amber-300 transition-colors"
                        >
                          <ArrowRightLeft className="h-2.5 w-2.5" />
                          <span>{isPagoMovilBuy ? 'PM' : 'Transf'}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="tabular-nums text-emerald-300">0,00 {fiat} (0%)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasa Efectiva Neta en la base */}
              <div
                className={`flex items-center justify-between rounded-lg border p-2.5 mt-3 text-xs ${
                  isBuy
                    ? 'border-emerald-500/25 bg-emerald-950/20'
                    : 'border-amber-500/25 bg-amber-950/20'
                }`}
              >
                <span className="font-semibold text-slate-200" title="Tasa unitaria real post-comisión de Binance y gastos de banco">
                  Tasa Efectiva Neta:
                </span>
                <span
                  className={`tabular-nums text-sm font-bold ${
                    isBuy ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {fmtRate(effectiveRate)} {fiat}
                </span>
              </div>
            </div>
          </div>

          {/* 3. COMPARATIVA FRENTE AL PROMEDIO WAC / WAP */}
          {refAvgRate > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 px-4 py-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Tag
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isBuy ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span className="font-semibold text-slate-200">
                    Comparativa vs. {isBuy ? 'Costo Promedio (WAC)' : 'Precio Promedio (WAP)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Promedio de referencia de la jornada: <strong className="tabular-nums text-slate-200">{fmtRate(refAvgRate)} {fiat}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 tabular-nums text-xs font-semibold ${
                    isFavorableVsAvg
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  <span>{rateDelta > 0.0001 ? '+' : ''}{fmtRate(rateDelta)} {fiat}</span>
                  <span className="opacity-80">
                    ({rateDeltaPct > 0.005 ? '+' : ''}{rateDeltaPct.toFixed(2)}%)
                  </span>
                </span>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  {isFavorableVsAvg ? '✓ Favorable' : 'Desfavorable'}
                </span>
              </div>
            </div>
          )}

          {/* 4. CONTRAPARTE Y CANAL DE PAGO */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Contraparte Binance */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block leading-tight">
                    Contraparte Binance
                  </span>
                  <span className="font-semibold text-white text-sm truncate block leading-tight">
                    {order.counterparty || 'Anónimo'}
                  </span>
                </div>
              </div>

              {onFilterCounterparty && order.counterparty && order.counterparty !== '-' && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterCounterparty(order.counterparty);
                    onClose();
                  }}
                  title={`Filtrar todas las órdenes de ${order.counterparty}`}
                  className="flex h-8 items-center gap-1.5 shrink-0 rounded-xl border border-slate-800 bg-slate-900/90 px-3 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors shadow-xs"
                >
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">Filtrar</span>
                </button>
              )}
            </div>

            {/* Método de Pago y Banco */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block leading-tight">
                    Método de Pago
                  </span>
                  <span className="font-semibold text-slate-200 text-sm truncate block leading-tight">
                    {order.pay_method || 'No especificado'}
                  </span>
                </div>
              </div>

              {isBuy && (
                <button
                  type="button"
                  onClick={handleTogglePayment}
                  title="Cambiar entre Pago Móvil y Transferencia"
                  className={`flex h-8 items-center shrink-0 rounded-xl border px-3 text-xs font-bold transition-all shadow-xs ${
                    isPagoMovilBuy
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                >
                  {isPagoMovilBuy ? `Pago Móvil (${bankFeePct}%)` : 'Transferencia (0%)'}
                </button>
              )}
            </div>
          </div>

          {/* 5. METADATOS TÉCNICOS & AUDITORÍA */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Datos de Auditoría & Trazabilidad
              </span>
              <div className="flex items-center gap-1.5 text-slate-400 tabular-nums text-[11px]">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{order.order_date || 'Sin fecha'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
              {/* ID de Orden */}
              <div className="flex h-9 items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3">
                <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Hash className="h-3 w-3 text-slate-400 shrink-0" />
                  ID Orden:
                </span>
                <button
                  type="button"
                  onClick={() => copyValue('order_no', order.order_number)}
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200 hover:text-amber-300 transition-colors"
                >
                  <span>{order.order_number}</span>
                  {copiedField === 'order_no' ? (
                    <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400 shrink-0" />
                  )}
                </button>
              </div>

              {/* ID Anuncio P2P */}
              <div className="flex h-9 items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3">
                <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Hash className="h-3 w-3 text-slate-400 shrink-0" />
                  ID Anuncio:
                </span>
                {order.adv_no ? (
                  <button
                    type="button"
                    onClick={() => copyValue('adv_no', order.adv_no)}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-200 hover:text-amber-300 transition-colors"
                  >
                    <span>{order.adv_no}</span>
                    {copiedField === 'adv_no' ? (
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400 shrink-0" />
                    )}
                  </button>
                ) : (
                  <span className="font-mono text-slate-500 text-[11px]">N/A</span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================
            PIE FIJO / FOOTER CON ATAJOS Y BOTÓN DE CIERRE
        ======================================================== */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-5 py-3 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Atajos:</span>
            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-slate-300 shadow-xs">
              ←
            </kbd>
            <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-slate-300 shadow-xs">
              →
            </kbd>
            <span className="hidden sm:inline">para cambiar orden ·</span>
            <kbd className="inline-flex h-5 items-center justify-center rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] text-slate-300 shadow-xs">
              Esc
            </kbd>
            <span className="hidden sm:inline">para salir</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-800/90 px-4 font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}