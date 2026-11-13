import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 font-semibold shadow-xs active:scale-[0.98]',
  solid:
    'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-xs hover:shadow-amber-500/10 active:scale-[0.98]',
  secondary:
    'border border-slate-800/80 bg-slate-900/80 text-slate-200 hover:border-slate-700 hover:text-white hover:bg-slate-800/60 active:scale-[0.98]',
  emerald:
    'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 active:scale-[0.98]',
  danger:
    'border border-rose-500/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 active:scale-[0.98]',
  ghost:
    'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-[0.98]',
  subtle:
    'border border-slate-800/60 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80 hover:text-white',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-base gap-2.5 rounded-xl',
  icon: 'h-8 w-8 p-0 rounded-xl justify-center',
  'icon-xs': 'h-6 w-6 p-0 rounded-lg justify-center',
};

export default function Button({
  children,
  variant = 'secondary',
  size = 'sm',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  type = 'button',
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.secondary;
  const sizeClass = SIZES[size] || SIZES.sm;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 select-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
