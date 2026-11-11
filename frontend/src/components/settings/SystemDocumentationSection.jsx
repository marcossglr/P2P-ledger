import React from 'react';
import {
  HelpCircle,
  TrendingUp,
  Scale,
  Calculator,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  Info,
  DollarSign,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
} from 'lucide-react';

export default function SystemDocumentationSection() {
  return (
    <div className="space-y-4">
      {/* Bloque 1: Tasas, Precios y Spread Comercial */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">1. Tasas Promedio Ponderadas y Márgenes</h3>
            <p className="text-xs text-slate-400">
              Cómo se calculan tus costos de compra, precios de venta y punto de equilibrio
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Tasa Compra (WAC) */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Tasa Promedio de Compra (WAC)
              </span>
              <span className="text-xs font-mono text-slate-500">Costo Ponderado</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Precio medio real pagado por cada USDT adquirido según los anuncios pactados. Pondera cada orden por su volumen en dólares:
            </p>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 font-mono text-xs text-slate-200">
              Tasa Compra = Total Bolívares Pagados / Total USDT Comprados
            </div>
          </div>

          {/* Tasa Venta (WAP) */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Tasa Promedio de Venta (WAP)
              </span>
              <span className="text-xs font-mono text-slate-500">Precio Ponderado</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Precio medio real en Bolívares cobrado por cada USDT liquidado en tus anuncios de venta:
            </p>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 font-mono text-xs text-slate-200">
              Tasa Venta = Total Bolívares Recibidos / Total USDT Vendidos
            </div>
          </div>

          {/* Spread de Mercado */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
                Spread Comercial (Bruto)
              </span>
              <span className="text-xs font-mono text-slate-500">Diferencial</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Diferencia directa entre lo que cobras al vender y lo que pagas al comprar:
            </p>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 font-mono text-xs text-slate-200 space-y-1">
              <div>Spread (VES) = Tasa Venta - Tasa Compra</div>
              <div className="text-slate-400 text-xs">Spread (%) = (Spread VES / Tasa Compra) × 100</div>
            </div>
          </div>

          {/* Tasa Piso Breakeven */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                Tasa Piso Breakeven (Punto de Equilibrio)
              </span>
              <span className="text-xs font-mono text-amber-400">Protección</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Precio mínimo de venta indispensable para cubrir tu costo de adquisición más el 100% de comisiones (Binance + Bancos):
            </p>
            <div className="rounded-lg bg-slate-900 border border-amber-500/30 px-3 py-2 font-mono text-xs text-amber-200">
              Tasa Piso = Tasa Compra + (Comisiones Totales / USDT Arbitrados)
            </div>
            <p className="text-xs text-slate-400">
              * Si vendes por debajo de esta tasa, la operación genera pérdida real por impacto de comisiones.
            </p>
          </div>
        </div>
      </div>

      {/* Bloque 2: Volumen Arbitrado y Ganancia Real (P&L) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">2. Ganancia Neta Real (P&L) y Principio de Ciclo Cerrado</h3>
            <p className="text-xs text-slate-400">
              Cómo se reconocen las ganancias y se deducen los costos operativos
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
          {/* Ciclo Cerrado */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Principio de Ciclo Cerrado (Matched Volume)
            </h4>
            <p>
              En el comercio y arbitraje financiero, <strong>no se reconoce ganancia sobre mercancía que no has vendido</strong>. Si compraste 1.500 USDT y vendiste 1.000 USDT, tu ganancia realizada se calcula únicamente sobre los <strong>1.000 USDT</strong> que completaron el ciclo comercial. Los 500 USDT restantes son inventario disponible en billetera.
            </p>
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 font-mono text-xs text-slate-200">
              Volumen Arbitrado = Mínimo(Total USDT Comprados, Total USDT Vendidos)
            </div>
          </div>

          {/* Deducción de Comisiones */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-rose-400" />
              Deducción Transparente de Comisiones Operativas
            </h4>
            <p>
              El sistema no oculta ni altera tus tasas nominales; descuenta los costos de forma 100% visible:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>
                <strong className="text-slate-200">Comisiones de Binance P2P</strong>: Suma el 100% de comisiones en USDT (Maker + Taker de compras y ventas) y las descuenta al costo de reposición WAC.
              </li>
              <li>
                <strong className="text-slate-200">Comisiones Bancarias</strong>: Las transferencias del mismo banco tienen 0% comisión. El recargo bancario (0.3%) se aplica exclusivamente a las compras realizadas por Pago Móvil.
              </li>
            </ul>
          </div>

          {/* Ganancia Neta Final */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Ganancia Neta Limpia (Lo que te queda en el bolsillo)
            </h4>
            <div className="rounded-lg bg-slate-900 border border-emerald-500/30 px-3 py-2 font-mono text-xs text-emerald-200 space-y-1">
              <div>P&L Neto (VES) = Ganancia Bruta - Comisiones Binance (VES) - Comisiones Bancarias (VES)</div>
              <div className="text-white font-bold text-xs pt-1">P&L Neto (USDT) = P&L Neto (VES) / Tasa Compra (WAC)</div>
            </div>
            <p className="text-xs text-slate-400">
              Te muestra con exactitud cuántos dólares netos y limpios le agregaste a tu patrimonio en la jornada o período consultado.
            </p>
          </div>
        </div>
      </div>

      {/* Bloque 3: Resumen Rápido de las 5 Tarjetas */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-amber-400">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">3. Guía de Auditoría de las Tarjetas Principales</h3>
            <p className="text-xs text-slate-400">
              Qué significa cada tarjeta del panel y cómo comprobar tus resultados
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Tarjeta</th>
                <th className="py-2.5 px-3">Métrica Principal</th>
                <th className="py-2.5 px-3">¿Cómo auditarla?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">1. Ganancia Neta (P&L)</td>
                <td className="py-2.5 px-3 text-emerald-400 font-medium">USDT limpios (≈ VES)</td>
                <td className="py-2.5 px-3 text-slate-400">Tu beneficio real deducidas todas las comisiones de Binance y bancos.</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">2. Spread Promedio</td>
                <td className="py-2.5 px-3 text-white font-medium">Margen % y en Bolívares</td>
                <td className="py-2.5 px-3 text-slate-400">Muestra tu WAC de compra, WAP de venta y tu Tasa Piso Breakeven.</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">3. Volumen Cripto</td>
                <td className="py-2.5 px-3 text-white font-medium">Matched USDT ciclado</td>
                <td className="py-2.5 px-3 text-slate-400">Volumen arbitrado real y flujo neto de inventario (+acum. o -liq.).</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">4. Flujo de Caja (VES)</td>
                <td className="py-2.5 px-3 text-white font-medium">Total movilizado (VES)</td>
                <td className="py-2.5 px-3 text-slate-400">Cuadre bancario con desglose de Salidas (compras) vs Entradas (ventas).</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">5. Comisiones Totales</td>
                <td className="py-2.5 px-3 text-rose-300 font-medium">-Total USDT (≈ -VES)</td>
                <td className="py-2.5 px-3 text-slate-400">Desglose transparente de comisiones de Binance P2P vs gastos bancarios.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
