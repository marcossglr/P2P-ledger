import React from 'react';
import { Check } from 'lucide-react';

/**
 * Checkbox primitivo para formularios y selecciones explícitas.
 * Consistente con el diseño sobrio de terminal financiero.
 */
export default function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  id,
  className = '',
  ...props
}) {
  const checkboxId =
    id || (typeof label === 'string' ? `chk-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

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

  const boxElement = (
    <div
      id={checkboxId}
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:cursor-not-allowed ${
        checked
          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold shadow-xs'
          : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {checked && <Check className="h-3 w-3 stroke-[3]" />}
    </div>
  );

  if (!label && !description) {
    return boxElement;
  }

  return (
    <label
      htmlFor={checkboxId}
      onClick={(e) => {
        // Evitar doble toggle al hacer clic en label
        if (e.target.tagName !== 'INPUT') {
          e.preventDefault();
          toggle();
        }
      }}
      className={`inline-flex items-start gap-2.5 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="pt-0.5">{boxElement}</div>
      <div className="flex flex-col">
        {label && (
          <span className="text-xs font-medium text-slate-200 leading-tight">
            {label}
          </span>
        )}
        {description && (
          <span className="text-[11px] text-slate-400 mt-0.5 leading-normal">
            {description}
          </span>
        )}
      </div>
    </label>
  );
}
