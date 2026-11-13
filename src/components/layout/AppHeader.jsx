import React from 'react';
import {
  KeyRound,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button, Logo } from '../ui';
import { fmtTime } from '../../utils/formatters';

export default function AppHeader({
  navItems = [],
  activeView,
  onSelectView,
  health,
  syncError,
  isSyncingBg,
  onTriggerSync,
  onOpenApiModal,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  timeFormat,
  timeShowSeconds,
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
        {/* 1. Izquierda: Logo y Menú de Navegación Principal agrupados */}
        <div className="flex items-center gap-3.5 lg:gap-5 shrink-0">
          {/* Logo y Nombre en una sola línea */}
          <div
            onClick={() => onSelectView('DASHBOARD')}
            className="cursor-pointer group select-none"
            title="Ir a Operaciones"
          >
            <Logo size="sm" withText textClassName="group-hover:text-amber-300 transition-colors" />
          </div>

          {/* Separador vertical sutil entre Logo y Navegación */}
          <div className="h-4 w-px bg-slate-800" />

          {/* Pestañas de Navegación alineadas a la izquierda */}
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  className={`group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35 font-semibold shadow-xs'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                      isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 2. Derecha: Estatus de Binance, Audio y Botón de Ajustes */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {health.binance_api_configured ? (
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncingBg && !syncError}
              title={
                syncError
                  ? `Atención: ${syncError} · Clic para revisar credenciales`
                  : `Sistema conectado y en vivo${
                      health.last_synced_at
                        ? ` · Último sync: ${fmtTime(health.last_synced_at, { timeFormat, showSeconds: timeShowSeconds })}`
                        : ''
                    } · Clic para refrescar`
              }
              className={`group flex h-8 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all shadow-xs cursor-pointer select-none ${
                syncError
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:bg-slate-850 hover:text-white'
              }`}
            >
              {/* Indicador de estado */}
              <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                {syncError ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                )}
              </span>

              {/* Texto de estado */}
              <span
                className={`font-semibold tracking-tight transition-colors ${
                  syncError
                    ? 'text-rose-300 font-bold'
                    : 'text-slate-200 group-hover:text-emerald-300'
                }`}
              >
                {syncError ? 'Revisar Conexión' : 'En Vivo'}
              </span>
            </button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={KeyRound}
              onClick={onOpenApiModal}
              title="Conectar API Key de Binance para sincronización automática"
            >
              <span>Conectar Binance</span>
            </Button>
          )}

          {/* Botón de Sonido / Alertas de Audio */}
          <Button
            type="button"
            variant={soundEnabled ? 'emerald' : 'secondary'}
            size="icon"
            icon={soundEnabled ? Volume2 : VolumeX}
            onClick={onToggleSound}
            title={soundEnabled ? 'Alertas sonoras activadas (clic para silenciar)' : 'Alertas sonoras silenciadas (clic para activar)'}
          />

          {/* Botón de Ajustes */}
          <Button
            type="button"
            variant={activeView === 'SETTINGS' ? 'primary' : 'secondary'}
            size="sm"
            icon={Settings}
            onClick={() => onOpenSettings('CONNECTIONS')}
            title="Ajustes: Conexiones, Base de Datos y Sistema"
          >
            <span className="hidden sm:inline">Ajustes</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
