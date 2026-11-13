import React, { useState } from 'react';

export default function MarketDepthChart({
  chartGeometry,
  historySeries,
  fiat = 'VES',
  fmtRate,
  isLive = true,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!chartGeometry) return null;

  const hoveredPoint =
    hoverIdx != null && historySeries[hoverIdx] ? historySeries[hoverIdx] : null;

  const lastBuyPt = chartGeometry.buyPts?.[chartGeometry.buyPts.length - 1];
  const lastSellPt = chartGeometry.sellPts?.[chartGeometry.sellPts.length - 1];

  return (
    <div className="relative rounded-lg border border-slate-800/80 bg-slate-950/60 p-2">
      {/* Tooltip Flotante al posicionar el cursor sobre la gráfica */}
      {hoveredPoint && hoverIdx != null && (
        <div
          className="pointer-events-none absolute top-2 z-20 rounded-lg border border-slate-700/90 bg-slate-900/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur-sm tabular-nums"
          style={{
            left: hoverIdx > historySeries.length / 2 ? '10px' : 'auto',
            right: hoverIdx <= historySeries.length / 2 ? '10px' : 'auto',
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-0.5 mb-1">
            <span className="font-mono text-[10px] text-slate-400">
              {hoveredPoint.fullTime}
            </span>
            {hoveredPoint.buy_val > 0 && hoveredPoint.sell_val > 0 && (
              <span className="font-mono text-[10px] font-semibold text-amber-300">
                Δ {fmtRate(hoveredPoint.buy_val - hoveredPoint.sell_val)} {fiat}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Comprar: {fmtRate(hoveredPoint.buy_val)}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Vender: {fmtRate(hoveredPoint.sell_val)}
            </span>
          </div>
        </div>
      )}

      {/* Micro-badge de fluctuación instantánea (Tick Delta) si hay variación */}
      {(chartGeometry.buyDelta !== 0 || chartGeometry.sellDelta !== 0) && (
        <div className="pointer-events-none absolute bottom-9 left-3 z-10 flex items-center gap-2 text-[10px] font-mono tabular-nums">
          {chartGeometry.buyDelta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium border ${
                chartGeometry.buyDelta > 0
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400'
              }`}
            >
              {chartGeometry.buyDelta > 0 ? '▲ +' : '▼ '}
              {fmtRate(chartGeometry.buyDelta, 2)}
            </span>
          )}
          {chartGeometry.sellDelta !== 0 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium border ${
                chartGeometry.sellDelta > 0
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400'
              }`}
            >
              {chartGeometry.sellDelta > 0 ? '▲ +' : '▼ '}
              {fmtRate(chartGeometry.sellDelta, 2)}
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${chartGeometry.W} ${chartGeometry.H}`}
        className="w-full h-[138px] overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          {/* Degradado suave para el área de la curva de Venta (Rosa) */}
          <linearGradient id="p2pSellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
            <stop offset="85%" stopColor="#f43f5e" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>

          {/* Degradado suave para el área de la curva de Compra (Verde) */}
          <linearGradient id="p2pBuyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="85%" stopColor="#10b981" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>

          {/* Animación de halo pulsante tipo radar para el tick en vivo (sincronizada para ambas líneas) */}
          <style>{`
            @keyframes p2pPulse {
              0% { r: 3.5px; opacity: 0.9; }
              50% { r: 8px; opacity: 0.15; }
              100% { r: 3.5px; opacity: 0.9; }
            }
            .p2p-radar-ring-buy {
              animation: p2pPulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            .p2p-radar-ring-sell {
              animation: p2pPulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            .p2p-chart-line {
              transition: d 0.35s ease-out;
            }
          `}</style>
        </defs>

        {/* Líneas guía horizontales */}
        {[0.2, 0.5, 0.8].map((ratio, idx) => (
          <line
            key={idx}
            x1="8"
            x2={chartGeometry.W - chartGeometry.padRight + 4}
            y1={chartGeometry.H * ratio}
            y2={chartGeometry.H * ratio}
            stroke="#1e293b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}

        {/* Etiquetas de Escala Vertical (Mín y Máx en el margen derecho) */}
        <text
          x={chartGeometry.W - 2}
          y={22}
          textAnchor="end"
          className="fill-slate-500 font-mono text-[9px] select-none"
        >
          {fmtRate(chartGeometry.maxVal, 1)}
        </text>
        <text
          x={chartGeometry.W - 2}
          y={chartGeometry.H - 18}
          textAnchor="end"
          className="fill-slate-500 font-mono text-[9px] select-none"
        >
          {fmtRate(chartGeometry.minVal, 1)}
        </text>

        {/* Áreas sombreadas con degradados fieles a cada línea */}
        {chartGeometry.sellAreaPath && (
          <path d={chartGeometry.sellAreaPath} fill="url(#p2pSellGrad)" className="p2p-chart-line" />
        )}
        {chartGeometry.buyAreaPath && (
          <path d={chartGeometry.buyAreaPath} fill="url(#p2pBuyGrad)" className="p2p-chart-line" />
        )}

        {/* Línea Verde: Pizarra Comprar de Binance */}
        <path
          d={chartGeometry.buyPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="p2p-chart-line"
        />

        {/* Línea Roja: Pizarra Vender de Binance */}
        <path
          d={chartGeometry.sellPath}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="p2p-chart-line"
        />

        {/* Halo / Radar dinámico en el punto actual (Ahora) - Sincronizado y condicionado a isLive */}
        {hoverIdx == null && lastBuyPt && (
          <g>
            {isLive && (
              <circle
                cx={lastBuyPt.x}
                cy={lastBuyPt.y}
                r="4"
                fill="#10b981"
                className="p2p-radar-ring-buy"
              />
            )}
            <circle
              cx={lastBuyPt.x}
              cy={lastBuyPt.y}
              r="3.5"
              fill={isLive ? '#10b981' : '#64748b'}
              stroke="#020617"
              strokeWidth="1.5"
            />
          </g>
        )}

        {hoverIdx == null && lastSellPt && (
          <g>
            {isLive && (
              <circle
                cx={lastSellPt.x}
                cy={lastSellPt.y}
                r="4"
                fill="#f43f5e"
                className="p2p-radar-ring-sell"
              />
            )}
            <circle
              cx={lastSellPt.x}
              cy={lastSellPt.y}
              r="3.5"
              fill={isLive ? '#f43f5e' : '#64748b'}
              stroke="#020617"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* Línea vertical y puntos activos al pasar el cursor */}
        {hoverIdx != null && chartGeometry.buyPts[hoverIdx] && (
          <line
            x1={chartGeometry.buyPts[hoverIdx].x}
            x2={chartGeometry.buyPts[hoverIdx].x}
            y1="6"
            y2={chartGeometry.H - 6}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        {chartGeometry.buyPts.map((pt, i) => {
          const isActive =
            hoverIdx === i ||
            (hoverIdx == null && i === chartGeometry.buyPts.length - 1);
          return (
            <g key={i}>
              {hoverIdx === i && (
                <>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill="#10b981"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  {chartGeometry.sellPts[i] && (
                    <circle
                      cx={chartGeometry.sellPts[i].x}
                      cy={chartGeometry.sellPts[i].y}
                      r={4}
                      fill="#f43f5e"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  )}
                </>
              )}
              {/* Franja interactiva para capturar el cursor en cada punto */}
              <rect
                x={
                  pt.x -
                  (chartGeometry.W - chartGeometry.padRight) /
                    Math.max(2, chartGeometry.buyPts.length * 2)
                }
                y="0"
                width={
                  (chartGeometry.W - chartGeometry.padRight) /
                  Math.max(1, chartGeometry.buyPts.length)
                }
                height={chartGeometry.H}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          );
        })}
      </svg>

      {/* Eje X: Horas de inicio y fin */}
      <div
        className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1"
        style={{ paddingRight: `${chartGeometry.padRight}px` }}
      >
        <span>{historySeries[0]?.label || ''}</span>
        <span>{historySeries[historySeries.length - 1]?.label || 'Ahora'}</span>
      </div>
    </div>
  );
}
