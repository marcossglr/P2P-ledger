import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName = 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  headerRight,
  footer,
  children,
  maxWidth = 'max-w-2xl',
  className = '',
  closeOnEscape = true,
  closeOnBackdrop = true,
  showHeader = true,
}) {
  // Manejo de tecla Escape respetando bloqueo de scroll
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (!closeOnEscape) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        {showHeader && (title || headerRight || onClose) && (
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {Icon && (
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border shrink-0 ${iconClassName}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  typeof title === 'string' ? (
                    <h3 className="text-sm font-bold text-white truncate">{title}</h3>
                  ) : (
                    title
                  )
                )}
                {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                  aria-label="Cerrar modal"
                  title="Cerrar (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cuerpo desplazable */}
        <div className="flex-1 overflow-y-auto min-h-0 text-slate-100 pr-1">{children}</div>

        {/* Pie opcional fijo fuera del scroll */}
        {footer && (
          <div className="pt-3 mt-4 border-t border-slate-800/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
