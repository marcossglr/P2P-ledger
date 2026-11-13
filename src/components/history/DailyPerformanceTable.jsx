import React from 'react';
import TablePaginator from '../common/TablePaginator';
import { fmtDate } from '../../utils/formatters';
import { Button } from '../ui';

export default function DailyPerformanceTable({
  dailySeries = [],
  fiat = 'VES',
  startDate,
  endDate,
  onSelectDate,
  onResetDates,
  dailyPage = 1,
  dailyPageSize = 7,
  onPageChange,
  onPageSizeChange,
  fmtUsdt = (n) => String(n),
  fmtFiat = (n) => String(n),
  fmtRate = (n) => String(n),
}) {
  const dailyDesc = dailySeries ? [...dailySeries].reverse() : [];
  const totalDailyPages = Math.max(1, Math.ceil(dailyDesc.length / dailyPageSize));
  const safeDailyPage = Math.min(dailyPage, totalDailyPages);
  const paginatedDaily = dailyDesc.slice(
    (safeDailyPage - 1) * dailyPageSize,
    safeDailyPage * dailyPageSize
  );

  return (
    <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Rendimiento Diario de Arbitraje</h3>
          <p className="text-xs text-slate-400">
            Haz clic en cualquier fecha para auditar y filtrar las órdenes de ese día puntual
          </p>
        </div>
        {startDate && startDate === endDate && onResetDates && (
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={onResetDates}
          >
            <span>Mostrar todas las fechas</span>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-2.5 px-3 font-medium">Fecha</th>
              <th className="py-2.5 px-2 font-medium text-right">Op.</th>
              <th className="py-2.5 px-2 font-medium text-right">Compras USDT</th>
              <th className="py-2.5 px-2 font-medium text-right">Ventas USDT</th>
              <th className="py-2.5 px-2 font-medium text-right">Tasa Compra</th>
              <th className="py-2.5 px-2 font-medium text-right">Tasa Venta</th>
              <th className="py-2.5 px-2 font-medium text-right">Spread</th>
              <th className="py-2.5 pr-3 pl-2 font-medium text-right">P&L Neto (USDT / {fiat})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {paginatedDaily.map((day) => {
              const dayNetUsdt =
                day.net_profit_usdt != null
                  ? day.net_profit_usdt
                  : day.avg_buy_price > 0
                  ? day.net_profit_fiat / day.avg_buy_price
                  : 0;

              return (
                <tr
                  key={day.date}
                  onClick={() => onSelectDate && onSelectDate(day.date)}
                  className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                  title={`Filtrar operaciones del ${day.date}`}
                >
                  <td className="py-2.5 px-3 tabular-nums text-[11px] font-medium text-slate-300 hover:text-amber-300 hover:underline">
                    {fmtDate(day.date)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{day.orders_count}</td>
                  <td className="py-2.5 px-2 text-right font-medium text-white tabular-nums">{fmtUsdt(day.buy_usdt)}</td>
                  <td className="py-2.5 px-2 text-right font-medium text-white tabular-nums">{fmtUsdt(day.sell_usdt)}</td>
                  <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{fmtRate(day.avg_buy_price)}</td>
                  <td className="py-2.5 px-2 text-right text-slate-400 tabular-nums">{fmtRate(day.avg_sell_price)}</td>
                  <td className="py-2.5 px-2 text-right font-semibold text-slate-300 tabular-nums">
                    {Number(day.spread_pct || 0) > 0.005 ? `+${Number(day.spread_pct || 0).toFixed(2)}%` : `${Number(day.spread_pct || 0).toFixed(2)}%`}
                  </td>
                  <td className="py-2.5 pr-3 pl-2 text-right">
                    <span
                      className={`tabular-nums font-bold block ${
                        Number(day.net_profit_fiat || 0) < -0.005 ? 'text-rose-400' : 'text-white'
                      }`}
                    >
                      {Number(day.net_profit_fiat || 0) > 0.005 ? '+' : ''}
                      {fmtUsdt(dayNetUsdt)} USDT
                    </span>
                    <span className="tabular-nums text-[10px] text-slate-400">
                      ≈ {fmtFiat(day.net_profit_fiat)} {fiat}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePaginator
        totalItems={dailyDesc.length}
        currentPage={safeDailyPage}
        pageSize={dailyPageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[5, 7, 15, 30]}
        itemLabel="días"
        compact
      />
    </div>
  );
}
