import React, { useState } from 'react';
import { Building2, FileText } from 'lucide-react';
import BankInventoryView from '../treasury/BankInventoryView';
import BankReconcilerView from '../treasury/BankReconcilerView';

export default function TreasuryView({ isActive = true, refreshTrigger, onInventoryChange }) {
  const [activeTab, setActiveTab] = useState('ACCOUNTS'); // 'ACCOUNTS' | 'RECONCILER'

  return (
    <div className="space-y-4">
      {/* Sub-navegación de Tesorería Minimalista (Opción 2) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400" />
          <span>Tesorería Bancaria</span>
        </h2>

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
