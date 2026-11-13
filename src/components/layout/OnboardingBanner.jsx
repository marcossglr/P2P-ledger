import React, { useState } from 'react';
import { Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import { operationsApi } from '../../services/api';

/**
 * OnboardingBanner
 * Banner global visible en todas las vistas:
 * 1. Cuando la base de datos está vacía y sin API de Binance conectada.
 * 2. Cuando existen operaciones de demostración (DEMO) activas para advertir al usuario y permitir depurarlas rápidamente.
 */
export default function OnboardingBanner({
  apiConfigured,
  demoCount = 0,
  storedOrders = 0,
  onOpenApiModal,
  onStateChanged,
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const hasDemoOrders = demoCount > 0;
  const isCompletelyEmpty = storedOrders === 0 && !apiConfigured;

  // Si no está vacío y tampoco tiene órdenes demo, no se debe mostrar nada
  if (!isCompletelyEmpty && !hasDemoOrders) {
    return null;
  }

  const handleSeedDemo = async () => {
    try {
      setIsProcessing(true);
      await operationsApi.seedDemo();
      if (onStateChanged) {
        onStateChanged();
      }
    } catch (err) {
      console.error('Error al poblar operaciones demo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearDemo = async () => {
    try {
      setIsProcessing(true);
      await operationsApi.clearOperations(true);
      if (onStateChanged) {
        onStateChanged();
      }
    } catch (err) {
      console.error('Error al borrar operaciones demo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // CASO 1: Hay operaciones demo activas
  if (hasDemoOrders) {
    return (
      <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Estás visualizando <strong>operaciones de demostración</strong> ({demoCount} órdenes simuladas cargadas).
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!apiConfigured && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              icon={RefreshCw}
              onClick={onOpenApiModal}
            >
              <span>Conectar API</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            icon={Trash2}
            disabled={isProcessing}
            onClick={handleClearDemo}
            className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
          >
            <span>{isProcessing ? 'Eliminando...' : 'Borrar datos demo'}</span>
          </Button>
        </div>
      </div>
    );
  }

  // CASO 2: Entorno completamente vacío (Onboarding inicial)
  return (
    <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">
          Conecta tu API de Binance P2P o explora con datos de demostración
        </h2>
        <p className="max-w-2xl text-xs text-slate-400">
          El sistema extrae automáticamente tus órdenes de Compra y Venta en tiempo real, calculando tu spread,
          tasas promedio ponderadas (WAC/WAP) y ganancia neta del día.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Sparkles}
          disabled={isProcessing}
          onClick={handleSeedDemo}
        >
          <span>{isProcessing ? 'Cargando Demo...' : 'Cargar Operaciones Demo'}</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={RefreshCw}
          onClick={onOpenApiModal}
        >
          <span>Conectar API de Binance</span>
        </Button>
      </div>
    </div>
  );
}
