import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    children,
    className = '',
    containerClassName = '',
    size = 'sm',
    icon: Icon,
    disabled = false,
    ...props
  },
  ref
) {
  const sizeClasses = {
    xs: 'h-7 text-xs pl-2.5 pr-7',
    sm: 'h-8 text-xs pl-3 pr-8',
    md: 'h-9 text-sm pl-3.5 pr-9',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={`relative flex items-center w-full ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${containerClassName}`}
    >
      {Icon && (
        <div className="absolute left-2.5 pointer-events-none text-amber-400 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </div>
      )}
      <select
        ref={ref}
        disabled={disabled}
        className={`w-full appearance-none rounded-xl border border-slate-800/80 bg-slate-900/80 text-slate-200 font-medium cursor-pointer transition-colors hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/60 disabled:cursor-not-allowed ${
          Icon ? 'pl-8' : ''
        } ${selectedSize} ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-2.5 pointer-events-none text-slate-400 flex items-center">
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </div>
    </div>
  );
});

export default Select;
