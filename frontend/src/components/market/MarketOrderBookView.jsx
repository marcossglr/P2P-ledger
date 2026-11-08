import React, { useMemo } from 'react';
import { fmtRate } from '../../utils/formatters';

export default function MarketOrderBookView({
  filterSideAds,
  myAds = [],
  asset = 'USDT',
}) {
  const myAdvNos = useMemo(() => {
    const s = new Set();
    (myAds || []).forEach((a) => {
      if (a?.adv_no) s.add(String(a.adv_no).trim());
    });
    return s;
  }, [myAds]);

  const buySlice = useMemo(() => (filterSideAds.buy || []).slice(0, 6), [filterSideAds.buy]);
  const sellSlice = useMemo(() => (filterSideAds.sell || []).slice(0, 6), [filterSideAds.sell]);

  const maxBuyQty = useMemo(
    () => Math.max(1, ...buySlice.map((a) => Number(a.available_qty || 0))),
    [buySlice]
  );
  const maxSellQty = useMemo(
    () => Math.max(1, ...sellSlice.map((a) => Number(a.available_qty || 0))),
    [sellSlice]
  );

  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/80 p-2 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
      {/* Lado Izquierdo: Pizarra COMPRAR (Vendedores de USDT - Menor Tasa) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            Comprar {asset} (Vendedores)
          </span>
          <span className="text-[9px] font-mono text-slate-500">Menor Tasa</span>
        </div>
        <div className="space-y-1">
          {buySlice.length === 0 ? (
            <div className="py-2 text-center text-[10px] text-slate-500 font-mono">
              Sin ofertas de compra
            </div>
          ) : (
            buySlice.map((ad, idx) => {
              const qty = Number(ad.available_qty || 0);
              const depthPct = Math.min(100, Math.round((qty / maxBuyQty) * 100));
              const isMyAd = ad.adv_no && myAdvNos.has(String(ad.adv_no).trim());

              return (
                <div
                  key={ad.adv_no || idx}
                  className={`relative flex items-center justify-between overflow-hidden rounded px-2 py-1 text-[10px] transition-colors ${
                    isMyAd
                      ? 'border border-amber-500/60 bg-amber-500/10 shadow-xs'
                      : 'border border-slate-800/40 bg-slate-900/40'
                  }`}
                >
                  <div
                    className={`pointer-events-none absolute inset-y-0 right-0 transition-all duration-300 ${
                      isMyAd ? 'bg-amber-500/20' : 'bg-emerald-500/10'
                    }`}
                    style={{ width: `${depthPct}%` }}
                  />

                  <div className="relative z-10 truncate max-w-[110px]">
                    <span
                      className={`font-semibold block truncate ${
                        isMyAd ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {isMyAd ? `${ad.advertiser || 'Tu Anuncio'} (Tú)` : (ad.advertiser || 'Anónimo')}
                    </span>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {ad.pay_methods?.slice(0, 2).join(', ')}
                    </span>
                  </div>

                  <div className="relative z-10 text-right">
                    <span
                      className={`font-bold font-mono block text-xs ${
                        isMyAd ? 'text-amber-300' : 'text-emerald-400'
                      }`}
                    >
                      {fmtRate(ad.price)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block">
                      {fmtRate(ad.available_qty, 0)} {asset}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lado Derecho: Pizarra VENDER (Compradores de USDT - Mayor Tasa) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
            Vender {asset} (Compradores)
          </span>
          <span className="text-[9px] font-mono text-slate-500">Mayor Tasa</span>
        </div>
        <div className="space-y-1">
          {sellSlice.length === 0 ? (
            <div className="py-2 text-center text-[10px] text-slate-500 font-mono">
              Sin ofertas de venta
            </div>
          ) : (
            sellSlice.map((ad, idx) => {
              const qty = Number(ad.available_qty || 0);
              const depthPct = Math.min(100, Math.round((qty / maxSellQty) * 100));
              const isMyAd = ad.adv_no && myAdvNos.has(String(ad.adv_no).trim());

              return (
                <div
                  key={ad.adv_no || idx}
                  className={`relative flex items-center justify-between overflow-hidden rounded px-2 py-1 text-[10px] transition-colors ${
                    isMyAd
                      ? 'border border-amber-500/60 bg-amber-500/10 shadow-xs'
                      : 'border border-slate-800/40 bg-slate-900/40'
                  }`}
                >
                  <div
                    className={`pointer-events-none absolute inset-y-0 right-0 transition-all duration-300 ${
                      isMyAd ? 'bg-amber-500/20' : 'bg-rose-500/10'
                    }`}
                    style={{ width: `${depthPct}%` }}
                  />

                  <div className="relative z-10 truncate max-w-[110px]">
                    <span
                      className={`font-semibold block truncate ${
                        isMyAd ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {isMyAd ? `${ad.advertiser || 'Tu Anuncio'} (Tú)` : (ad.advertiser || 'Anónimo')}
                    </span>
                    <span className="text-[9px] text-slate-500 block truncate">
                      {ad.pay_methods?.slice(0, 2).join(', ')}
                    </span>
                  </div>

                  <div className="relative z-10 text-right">
                    <span
                      className={`font-bold font-mono block text-xs ${
                        isMyAd ? 'text-amber-300' : 'text-rose-400'
                      }`}
                    >
                      {fmtRate(ad.price)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono block">
                      {fmtRate(ad.available_qty, 0)} {asset}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
