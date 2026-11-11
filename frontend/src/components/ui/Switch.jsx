import React from 'react';

/**
 * Switch primitivo para opciones booleanas de activación inmediata.
 * Estilo sobrio y de alta densidad para terminal financiero.
 */
export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  size = 'sm',
  label,
  description,
  id,
  className = '',
  ...props
}) {
  const switchId =
    id || (typeof label === 'string' ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const sizeClasses = {
    xs: {
      track: 'h-4 w-7',
      thumb: 'h-2.5 w-2.5',
      translate: 'translate-x-3',
      defaultTranslate: 'translate-x-0.5',
    },
    sm: {
      track: 'h-5 w-9',
      thumb: 'h-3.5 w-3.5',
      translate: 'translate-x-4',
      defaultTranslate: 'translate-x-0.5',
    },
    md: {
      track: 'h-6 w-11',
      thumb: 'h-4.5 w-4.5',
      translate: 'translate-x-5',
      defaultTranslate: 'translate-x-0.5',
    },
  };

  const currentSize = sizeClasses[size] || sizeClasses.sm;

  const toggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  };

  const switchButton = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-40 ${
        currentSize.track
      } ${
        checked
          ? 'bg-amber-500/25 border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
          : 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
      } ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none inline-block rounded-full shadow-sm transition-transform duration-200 ease-in-out ${
          currentSize.thumb
        } ${
          checked
            ? `${currentSize.translate} bg-amber-400`
            : `${currentSize.defaultTranslate} bg-slate-400`
        }`}
      />
    </button>
  );

  if (!label && !description) {
    return switchButton;
  }

  return (
    <div
      onClick={toggle}
      className={`inline-flex items-center justify-between gap-3 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="flex flex-col">
        {label && <span className="text-xs font-medium text-slate-200">{label}</span>}
        {description && <span className="text-[11px] text-slate-400">{description}</span>}
      </div>
      {switchButton}
    </div>
  );
}
