import React from 'react';

const BADGE_VARIANTS = {
  default: 'border-slate-800 bg-slate-800/60 text-slate-300',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  info: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  purple: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
};

const BADGE_SIZES = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-0.5 text-xs gap-1.5',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  icon: Icon,
  dot = false,
  ...props
}) {
  const variantClass = BADGE_VARIANTS[variant] || BADGE_VARIANTS.default;
  const sizeClass = BADGE_SIZES[size] || BADGE_SIZES.sm;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border select-none tabular-nums ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variant === 'success'
              ? 'bg-emerald-400'
              : variant === 'danger'
              ? 'bg-rose-400'
              : variant === 'warning'
              ? 'bg-amber-400'
              : 'bg-slate-400'
          }`}
        />
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}
