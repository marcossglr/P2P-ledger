import React, { forwardRef } from 'react';

const Input = forwardRef(function Input(
  {
    type = 'text',
    className = '',
    containerClassName = '',
    size = 'sm',
    error = false,
    icon: Icon,
    rightElement,
    disabled = false,
    ...props
  },
  ref
) {
  const sizeClasses = {
    xs: 'h-7 text-xs px-2.5',
    sm: 'h-8 text-xs px-3',
    md: 'h-9 text-sm px-3.5',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={`relative flex items-center w-full ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${containerClassName}`}
    >
      {Icon && (
        <div className="absolute left-2.5 pointer-events-none text-slate-400 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </div>
      )}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={`w-full rounded-xl border bg-slate-900/80 text-slate-100 placeholder:text-slate-500 font-sans transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/60 disabled:cursor-not-allowed ${
          error
            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/40'
            : 'border-slate-800/80 hover:border-slate-700'
        } ${Icon ? 'pl-8' : ''} ${rightElement ? 'pr-11' : ''} ${selectedSize} ${className}`}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-2.5 flex items-center">
          {rightElement}
        </div>
      )}
    </div>
  );
});

export default Input;
