import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Bloquear el scroll del fondo mientras el modal esté abierto
  useEffect(() => {
    if (!order) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [order]);

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

  // Métricas locales con esa contraparte en la lista de órdenes actual
  const counterpartyName = order.counterparty && order.counterparty !== '-' ? order.counterparty : null;
  const counterpartyOrders = counterpartyName
    ? ordersList.filter((o) => o.counterparty === counterpartyName)
    : [];
  const counterpartyOrdersCount = counterpartyOrders.length;
  const counterpartyVolumeUsdt = counterpartyOrders.reduce(
    (acc, o) => acc + Number(o.crypto_amount || 0),
    0
  );
  const isPagoMovilBuy = isBuy && localPaymentChannel === 'PAGO_MOVIL';
  const netUsdtImpact = isBuy ? Math.max(0, cryptoGross - commUsdt) : cryptoGross + commUsdt;
  const commFiatEquiv = commUsdt * unitPrice;
  const estBankFeeFiat =
    isPagoMovilBuy && bankFeePct > 0 ? fiatAmount * (bankFeePct / 100.0) : 0;
  const totalEffectiveFiat = isBuy ? fiatAmount + estBankFeeFiat : fiatAmount;

  // Tasa efectiva real por cada USDT neto recibido/entregado
  const effectiveRate = netUsdtImpact > 0 ? totalEffectiveFiat / netUsdtImpact : unitPrice;

  // Comparativa contra tasa promedio ponderada del período/jornada
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
        <span className="inline-flex h-5 items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 px-2 text-[10px] font-medium text-slate-400">
          <Clock className="h-2.5 w-2.5 shrink-0 text-slate-500" />
          <span>Sin conciliar</span>
        </span>
      );
    }
    return (
      <span className="inline-flex h-5 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 text-[10px] font-semibold text-emerald-300">
        <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
        <span>Conciliada</span>
      </span>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn w-screen h-screen overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl shadow-slate-950/90 text-slate-100 space-y-4 my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera Estándar Directa */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                isBuy
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                  : 'border-rose-500/30 bg-rose-500/15 text-rose-400'
              }`}
            >
              {isBuy ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </div>

            <div className="min-w-0 space-y-1">
              <h3 className="font-mono text-sm font-bold text-white tracking-tight truncate leading-tight">
                Orden #{order.order_number}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`inline-flex h-4.5 items-center rounded px-1.5 text-[9px] font-bold uppercase tracking-wider ${
                    isCancelled
                      ? 'border border-slate-700 bg-slate-800 text-slate-400 line-through'
                      : isBuy
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border border-rose-500/40 bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {isBuy ? 'Compra' : 'Venta'}
                </span>
                {isInProgress && (
                  <span className="inline-flex h-4.5 items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 text-[9px] font-bold text-sky-300">
                    <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
                    <span>EN PROCESO</span>
                  </span>
                )}
                {renderReconcileBadge(order.status)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ordersList.length > 1 && currentIndex !== -1 && (
              <div className="flex h-7 items-center rounded-lg border border-slate-800 bg-slate-950/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => hasPrev && onSelectOrder(ordersList[currentIndex - 1])}
                  disabled={!hasPrev}
                  title="Orden anterior (←)"
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-1.5 tabular-nums text-[10px] font-mono text-slate-400 select-none">
                  {currentIndex + 1}/{ordersList.length}
                </span>
                <button
                  type="button"
                  onClick={() => hasNext && onSelectOrder(ordersList[currentIndex + 1])}
                  disabled={!hasNext}
                  title="Orden siguiente (→)"
                  className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Cerrar modal (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo desplazable sintetizado */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">

          {/* Banner si la orden está en proceso */}
          {isInProgress && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 flex items-start gap-2.5">
              <Loader2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5 animate-spin" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold text-sky-200 block">Orden en Proceso</span>
                <span className="text-sky-300/80">
                  Esperando confirmación o liberación en Binance P2P.
                </span>
              </div>
            </div>
          )}

          {/* BLOQUE 1: RESUMEN EJECUTIVO DE LA OPERACIÓN (2 Columnas Clave: Fiat vs Cripto) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Columna A: Flujo Fiat en Banco */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>Flujo Bancario ({fiat})</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {isBuy ? 'Salida Banco' : 'Entrada Banco'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="tabular-nums font-mono text-xl font-bold text-white">
                    {fmtFiat(fiatAmount)} <span className="text-xs font-semibold text-slate-400">{fiat}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Método:</span>
                    <span className="text-slate-200 font-medium truncate max-w-[170px]" title={order.pay_method}>
                      {order.pay_method || 'No especificado'}
                    </span>
                  </div>
                </div>
              </div>

              {isBuy ? (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                  <span className="text-slate-400 text-[11px]">Canal de Pago:</span>
                  <button
                    type="button"
                    onClick={handleTogglePayment}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer shadow-xs ${
                      isPagoMovilBuy
                        ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                        : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                    title="Haz clic para conmutar entre Pago Móvil y Transferencia"
                  >
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    <span>{isPagoMovilBuy ? `Pago Móvil (+${bankFeePct}%)` : 'Transf. Mismo Banco (0%)'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                  <span className="text-slate-400 text-[11px]">Comisión Bancaria:</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold">0,00 {fiat} (0%)</span>
                </div>
              )}
            </div>

            {/* Columna B: Impacto Cripto & Tasa Real */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Impacto Cripto ({asset})
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Fee: {commUsdt > 0 ? `-${fmtUsdt(commUsdt)}` : '0,00'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div
                    className={`tabular-nums font-mono text-xl font-bold ${
                      isBuy ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isBuy ? '+' : '-'}{fmtUsdt(netUsdtImpact)} <span className="text-xs font-semibold text-slate-400">{asset} Neto</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>Tasa Binance:</span>
                    <span className="font-mono text-slate-300">{fmtRate(unitPrice)} {fiat}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                <span className="text-slate-300 font-medium text-[11px]">Tasa Efectiva Real:</span>
                <span className={`font-mono font-bold text-sm ${isBuy ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {fmtRate(effectiveRate)} {fiat}
                </span>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: CONTRAPARTE BINANCE & RENDIMIENTO RELATIVO */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              {/* Información Contraparte con historial local */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                    Contraparte Binance
                  </span>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="font-semibold text-white truncate text-xs">
                      {order.counterparty || 'Anónimo'}
                    </span>
                    {counterpartyOrdersCount > 1 && (
                      <span className="rounded-md border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono">
                        {counterpartyOrdersCount} órdenes ({fmtUsdt(counterpartyVolumeUsdt)} {asset})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {onFilterCounterparty && order.counterparty && order.counterparty !== '-' && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterCounterparty(order.counterparty);
                    onClose();
                  }}
                  title={`Filtrar órdenes de ${order.counterparty}`}
                  className="flex h-7 items-center gap-1 shrink-0 rounded-xl border border-slate-800 bg-slate-950/60 px-2.5 text-[11px] font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Search className="h-3 w-3 text-slate-400" />
                  <span>Filtrar</span>
                </button>
              )}
            </div>

            {/* Comparativa WAC/WAP con badge estilizado */}
            {refAvgRate > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Ref. {isBuy ? 'WAC (Costo Promedio)' : 'WAP (Precio Promedio)'}:</span>
                  <strong className="text-slate-200 font-mono font-medium">
                    {fmtRate(refAvgRate)} {fiat}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold shadow-xs ${
                      isFavorableVsAvg
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    <span>{rateDelta > 0.0001 ? '+' : ''}{fmtRate(rateDelta)} ({rateDeltaPct > 0.005 ? '+' : ''}{rateDeltaPct.toFixed(2)}%)</span>
                    <span className="opacity-75 font-normal">
                      · {isFavorableVsAvg ? 'Favorable' : 'Desfavorable'}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* BLOQUE 3: AUDITORÍA & METADATOS TÉCNICOS (Línea compacta) */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span>{order.order_date || 'Sin fecha'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">ID:</span>
                  <button
                    type="button"
                    onClick={() => copyValue('order_no', order.order_number)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Copiar ID de orden"
                  >
                    <span>{order.order_number}</span>
                    {copiedField === 'order_no' ? (
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-500 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {order.adv_no && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Anuncio:</span>
                  <button
                    type="button"
                    onClick={() => copyValue('adv_no', order.adv_no)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Copiar ID de anuncio"
                  >
                    <span>{order.adv_no}</span>
                    {copiedField === 'adv_no' ? (
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-500 shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer limpio */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>Atajos:</span>
            <kbd className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 font-mono text-[9px] text-slate-300">
              ←
            </kbd>
            <kbd className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 font-mono text-[9px] text-slate-300">
              →
            </kbd>
            <span className="hidden sm:inline">orden ·</span>
            <kbd className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 font-mono text-[9px] text-slate-300">
              Esc
            </kbd>
            <span className="hidden sm:inline">salir</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}