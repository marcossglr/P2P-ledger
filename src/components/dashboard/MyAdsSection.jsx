import React, { useState, memo } from 'react';
import { Megaphone, ChevronDown, Check, Copy } from 'lucide-react';

function MyAdsSection({
  ads = [],
  evaluateMyAdOnBoard,
  fmtUsdt,
  fmtFiat,
  fmtRate,
}) {
  const [isAdsExpanded, setIsAdsExpanded] = useState(() => {
    const saved = localStorage.getItem('p2p_ads_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const [copiedAdPriceId, setCopiedAdPriceId] = useState(null);

  const toggleAdsExpanded = () => {
    setIsAdsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('p2p_ads_expanded', String(next));
      return next;
    });
  };

  const handleCopySuggestedPrice = (e, advNo, priceVal) => {
    e.stopPropagation();
    if (priceVal == null) return;
    navigator.clipboard?.writeText(Number(priceVal).toFixed(2))?.catch(() => {});
    setCopiedAdPriceId(advNo);
    setTimeout(() => setCopiedAdPriceId(null), 1800);
  };

  const activeAdsCount = ads.filter((a) => a.is_active).length;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm overflow-hidden transition-all">
      {/* Cabecera interactiva / Acordeón Completo */}
      <div
        onClick={toggleAdsExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleAdsExpanded();
          }
        }}
        className="flex w-full items-center justify-between gap-3 p-3.5 sm:px-4 cursor-pointer group select-none hover:bg-slate-800/60 transition-colors"
        title={isAdsExpanded ? 'Clic para colapsar sección de anuncios' : 'Clic para expandir sección de anuncios'}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:border-amber-500/40 group-hover:bg-amber-500/20 transition-all shrink-0">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-white transition-colors">
                Mis Anuncios en Binance P2P
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeAdsCount} activos</span>
              </span>
            </div>
            {/* Resumen rápido visible cuando está colapsado */}
            {!isAdsExpanded && ads.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2 truncate">
                {ads.map((ad, idx) => {
                  const boardInfo = ad.is_active && evaluateMyAdOnBoard ? evaluateMyAdOnBoard(ad) : null;
                  return (
                    <span key={ad.adv_no || idx} className="inline-flex items-center gap-1 text-slate-300">
                      <strong className={ad.adv_type === 'COMPRA' ? 'text-emerald-400' : 'text-rose-400'}>
                        {ad.adv_type}
                      </strong>
                      <span className="font-mono">
                        {fmtUsdt ? fmtUsdt(ad.surplus_amount) : ad.surplus_amount} {ad.asset}
                      </span>
                      <span className="text-slate-500">@</span>
                      <span className="font-mono text-white">
                        {fmtRate ? fmtRate(ad.price) : ad.price} {ad.fiat_unit}
                      </span>
                      {boardInfo && (
                        <span
                          className={`rounded px-1 py-0 text-[9px] font-bold ${
                            boardInfo.rank === 1
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-amber-300 border border-slate-700'
                          }`}
                          title={`Aparece en ${boardInfo.boardLabel} de Binance en el puesto #${boardInfo.rank}`}
                        >
                          #{boardInfo.rank}
                        </span>
                      )}
                      {idx < ads.length - 1 && <span className="text-slate-600">·</span>}
                    </span>
                  );
                })}
              </p>
            )}
            {isAdsExpanded && (
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Estado en vivo de tus ofertas publicadas, saldo remanente y cotización configurada
              </span>
            )}
          </div>
        </div>

        {/* Indicador Chevron */}
        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0 pl-2">
          <span className="hidden sm:inline text-[11px] font-medium text-slate-500 group-hover:text-slate-400">
            {isAdsExpanded ? 'Colapsar' : 'Expandir'}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isAdsExpanded ? 'rotate-180 text-amber-400' : 'text-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Tarjetas o Grid de Anuncios (Solo si está expandido) */}
      {isAdsExpanded && (
        <div className="border-t border-slate-800/80 p-3.5 sm:p-4 bg-slate-950/30">
          {ads.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-center">
              <p className="text-xs text-slate-400">
                No tienes anuncios publicados o activos en este momento en tu cuenta de Binance P2P.
              </p>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Cuando publiques un anuncio de compra o venta en Binance, aparecerá aquí con su saldo y precio.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ads.map((ad) => {
                const isBuy = ad.adv_type === 'COMPRA';
                const isOnline = ad.is_active;
                const boardInfo = isOnline && evaluateMyAdOnBoard ? evaluateMyAdOnBoard(ad) : null;
                return (
                  <div
                    key={ad.adv_no}
                    className={`relative rounded-xl border p-4 transition-all shadow-sm flex flex-col justify-between ${
                      isOnline
                        ? isBuy
                          ? 'border-emerald-500/30 bg-slate-900/70 hover:border-emerald-500/50'
                          : 'border-rose-500/30 bg-slate-900/70 hover:border-rose-500/50'
                        : 'border-slate-800/80 bg-slate-900/30 opacity-75'
                    }`}
                  >
                    {/* Fila Superior: Tipo, Moneda, Puesto y Estado */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {ad.adv_type} {ad.asset}
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          / {ad.fiat_unit}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {boardInfo && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              boardInfo.rank === 1
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : boardInfo.rank <= 5
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                            title={`Tu anuncio de ${ad.adv_type} se muestra en la ${boardInfo.boardLabel} de Binance en el puesto #${boardInfo.rank}`}
                          >
                            {boardInfo.boardLabel}: #{boardInfo.rank}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            isOnline
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isOnline && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {ad.status_label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500" title={`ID: ${ad.adv_no}`}>
                          #{ad.adv_no ? ad.adv_no.slice(-6) : ''}
                        </span>
                      </div>
                    </div>

                    {/* Fila Central Dividida en 2 Bloques: Datos Financieros vs Inteligencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                      {/* Bloque Izquierdo: Precios y Saldo Remanente */}
                      <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 flex flex-col justify-between gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            Precio Configurado
                          </span>
                          <span className="text-sm font-bold text-white tabular-nums font-mono">
                            {fmtRate ? fmtRate(ad.price) : ad.price}{' '}
                            <span className="text-[10px] font-normal text-slate-400">{ad.fiat_unit}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/60 pt-1.5">
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            Saldo Disponible
                          </span>
                          <span className="text-sm font-bold text-emerald-400 tabular-nums font-mono">
                            {fmtUsdt ? fmtUsdt(ad.surplus_amount) : ad.surplus_amount}{' '}
                            <span className="text-[10px] font-normal text-slate-400">{ad.asset}</span>
                          </span>
                        </div>
                      </div>

                      {/* Bloque Derecho: Inteligencia de Competencia en Binance */}
                      <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 flex flex-col justify-between gap-1.5 text-[11px]">
                        {boardInfo ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 text-[10px]">
                                Punta #1 ({boardInfo.matchedByBank && ad.trade_methods?.[0] ? ad.trade_methods[0] : 'General'}):
                              </span>
                              <span className="font-mono text-xs font-semibold text-white">
                                {fmtRate ? fmtRate(boardInfo.bestBoardPrice) : boardInfo.bestBoardPrice} {ad.fiat_unit}
                              </span>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-800/60 pt-1">
                              <span className="text-slate-400 text-[10px]">
                                {boardInfo.rank === 1 ? 'Estado:' : 'Volumen delante:'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-300">
                                {boardInfo.rank === 1
                                  ? 'Líder en pizarra'
                                  : `${fmtUsdt ? fmtUsdt(boardInfo.aheadUsdt) : boardInfo.aheadUsdt} ${ad.asset}`}
                              </span>
                            </div>

                            {boardInfo.rank > 1 && boardInfo.suggestedRank1Price != null && (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                                <span
                                  className="text-[10px] text-slate-400"
                                  title="Precio sugerido para tomar #1"
                                >
                                  Precio para #1:
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopySuggestedPrice(e, ad.adv_no, boardInfo.suggestedRank1Price)
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300 cursor-pointer transition-colors"
                                  title="Clic para copiar tasa sugerida"
                                >
                                  <span>{fmtRate ? fmtRate(boardInfo.suggestedRank1Price) : boardInfo.suggestedRank1Price}</span>
                                  {copiedAdPriceId === ad.adv_no ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3 opacity-80" />
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-500 text-[10px]">
                            Consultando competencia en Binance...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fila Inferior: Límites en Fiat y Métodos de Pago */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-500 text-[10px]">Límites:</span>
                        <span className="font-mono text-slate-300 tabular-nums text-[10px]">
                          {fmtFiat ? fmtFiat(ad.min_fiat) : ad.min_fiat} - {fmtFiat ? fmtFiat(ad.max_fiat) : ad.max_fiat} {ad.fiat_unit}
                        </span>
                      </div>

                      {ad.trade_methods && ad.trade_methods.length > 0 && (
                        <div className="flex items-center gap-1.5 min-w-0 truncate justify-end">
                          <span className="text-slate-500 text-[10px] shrink-0">Bancos:</span>
                          <span className="truncate text-slate-300 font-medium text-[10px]" title={ad.trade_methods.join(', ')}>
                            {ad.trade_methods.join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default memo(MyAdsSection);
