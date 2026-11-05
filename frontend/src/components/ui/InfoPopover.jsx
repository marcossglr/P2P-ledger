import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

/**
 * InfoPopover - Componente reutilizable del sistema de diseño para mostrar
 * explicaciones contextuales o fórmulas de cálculo de forma sobria y flotante.
 * 
 * Soporta:
 * - Cierre al hacer clic fuera (click-outside).
 * - Cierre con la tecla Escape.
 * - Trigger configurable (por defecto botón Info 'i').
 */
export default function InfoPopover({
  title,
  content,
  children,
  trigger,
  align = 'right', // 'right' | 'left'
  className = '',
  ariaLabel = 'Información',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Cerrar al hacer clic fuera o presionar tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const close = (e) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      {/* Botón desencadenante (Trigger) */}
      {trigger ? (
        <div onClick={toggle} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className={`p-1 rounded-md transition-colors ${
            isOpen
              ? 'bg-slate-800 text-sky-400'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
          }`}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Cuadro flotante (Popover) */}
      {isOpen && (
        <div
          className={`absolute top-6 z-30 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-200">
                {title}
              </span>
              <button
                type="button"
                onClick={close}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {content && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              {content}
            </p>
          )}

          {children}
        </div>
      )}
    </div>
  );
}
