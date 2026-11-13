import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xs backdrop-blur-xs transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-800/80 px-4 py-3 sm:px-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`text-sm font-semibold text-slate-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-xs text-slate-400 mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
