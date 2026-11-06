import React, { useState } from 'react';
import { Building2, FileText } from 'lucide-react';
import BankInventoryView from './BankInventoryView';
import BankReconcilerView from './BankReconcilerView';

export default function TreasuryView({ isActive = true, refreshTrigger, onInventoryChange }) {
  const [activeTab, setActiveTab] = useState('ACCOUNTS'); // 'ACCOUNTS' | 'RECONCILER'

  return (
    <div className="space-y-5">
      {/* Sub-navegación de Tesorería */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-400" />
            <span>Tesorería y Bancos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Control de inventario en bolívares, cuentas bancarias, ajustes y conciliación de extractos
          </p>
        </div>

        {/* Selector de Pestañas tipo Segmented Control con radios concéntricos */}
        <div className="flex h-8 items-center rounded-xl border border-slate-800/80 bg-slate-950/70 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('ACCOUNTS')}
            className={`flex h-6 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all ${
              activeTab === 'ACCOUNTS'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Cuentas y Saldos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RECONCILER')}
            className={`flex h-6 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all ${
              activeTab === 'RECONCILER'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Conciliador PDF</span>
          </button>
        </div>
      </div>

      {/* Contenido de la Sub-Pestaña Activa */}
      {activeTab === 'ACCOUNTS' && (
        <BankInventoryView
          isActive={isActive}
          refreshTrigger={refreshTrigger}
          onInventoryChange={onInventoryChange}
        />
      )}

      {activeTab === 'RECONCILER' && (
        <BankReconcilerView />
      )}
    </div>
  );
}
