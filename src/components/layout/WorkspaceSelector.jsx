import React, { useState, useRef, useEffect } from 'react';
import { FolderKanban, ChevronDown, Check, Settings2, Plus } from 'lucide-react';

export default function WorkspaceSelector({
  workspaces = [],
  activeWorkspaceId,
  isSwitching,
  onSwitch,
  onOpenManageModal,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || {
    id: activeWorkspaceId,
    name: 'Principal',
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (wsId) => {
    if (wsId === activeWorkspaceId) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    await onSwitch(wsId);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={isSwitching}
        onClick={() => setIsOpen(!isOpen)}
        title="Cambiar espacio de trabajo / perfil"
        className="group flex h-8 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-2.5 text-xs font-medium text-slate-300 shadow-xs transition-all hover:border-slate-700 hover:bg-slate-850 hover:text-white cursor-pointer select-none"
      >
        <FolderKanban className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold text-slate-200 tracking-tight max-w-[130px] truncate">
          {isSwitching ? 'Cambiando...' : activeWorkspace.name}
        </span>
        <ChevronDown className="h-3 w-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-200 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-800 bg-slate-950/95 p-1.5 shadow-xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1">
            Espacios de Trabajo
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelect(ws.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManageModal();
              }}
              className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-900 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Settings2 className="h-3 w-3 shrink-0" />
              <span>Administrar perfiles...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
