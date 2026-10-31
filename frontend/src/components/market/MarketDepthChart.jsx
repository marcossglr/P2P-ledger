import React, { useState } from 'react';

export default function MarketDepthChart({
  chartGeometry,
  historySeries,
  fiat = 'VES',
  fmtRate,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!chartGeometry) return null;

  const hoveredPoint =
    hoverIdx != null && historySeries[hoverIdx] ? historySeries[hoverIdx] : null;

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

      <svg
        viewBox={`0 0 ${chartGeometry.W} ${chartGeometry.H}`}
        className="w-full h-[138px] overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="p2pSpreadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.09" />
          </linearGradient>
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

        {/* Línea de Referencia de Breakeven si está en rango */}
        {chartGeometry.breakevenY != null && (
          <g>
            <line
              x1="8"
              x2={chartGeometry.W - chartGeometry.padRight + 4}
              y1={chartGeometry.breakevenY}
              y2={chartGeometry.breakevenY}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth="1"
              strokeOpacity="0.75"
            />
            <text
              x={chartGeometry.W - 2}
              y={chartGeometry.breakevenY + 3}
              textAnchor="end"
              className="fill-amber-400 font-mono text-[8px] font-semibold select-none"
            >
              Eq {fmtRate(chartGeometry.breakevenNum, 0)}
            </text>
          </g>
        )}

        {/* Área sombreada tenue entre las dos líneas */}
        <path d={chartGeometry.spreadAreaPath} fill="url(#p2pSpreadGrad)" />

        {/* Línea Verde: Pizarra Comprar de Binance */}
        <path
          d={chartGeometry.buyPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Línea Roja: Pizarra Vender de Binance */}
        <path
          d={chartGeometry.sellPath}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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
              {isActive && (
                <>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoverIdx === i ? 4 : 3}
                    fill="#10b981"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  {chartGeometry.sellPts[i] && (
                    <circle
                      cx={chartGeometry.sellPts[i].x}
                      cy={chartGeometry.sellPts[i].y}
                      r={hoverIdx === i ? 4 : 3}
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
