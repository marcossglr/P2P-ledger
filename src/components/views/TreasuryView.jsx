import React from 'react';
import { Building2 } from 'lucide-react';
import BankInventoryView from '../treasury/BankInventoryView';

export default function TreasuryView({ isActive = true, refreshTrigger, onInventoryChange }) {
  return (
    <div className="space-y-4">
      {/* Sub-navegación de Tesorería */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400" />
          <span>Tesorería Bancaria & Saldos</span>
        </h2>
      </div>

      {/* Contenido de Cuentas e Inventario */}
      <BankInventoryView
        isActive={isActive}
        refreshTrigger={refreshTrigger}
        onInventoryChange={onInventoryChange}
      />
    </div>
  );
}
