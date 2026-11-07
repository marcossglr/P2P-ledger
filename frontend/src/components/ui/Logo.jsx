import React, { useId } from 'react';

/**
 * Marca centralizada de P2P Ledger.
 * Punto único del isotipo de la app (cabecera, "Acerca de", pantallas de carga...).
 * Isotipo: dos cuentas (cuadros) superpuestas; la intersección resaltada representa la conciliación.
 * Fuente vectorial maestra de los iconos nativos: frontend/src-tauri/icons/logo.svg
 */
const LOGO_SIZES = {
  sm: { box: 'h-7 w-7', text: 'text-sm' },
  md: { box: 'h-10 w-10', text: 'text-base' },
  lg: { box: 'h-14 w-14', text: 'text-xl' },
};

export const APP_NAME = 'P2P Ledger';
export const APP_TAGLINE = 'Terminal de Conciliación P2P';

export function LogoMark({ className = '', title }) {
  // IDs únicos para que varios logos en pantalla no compartan gradientes/clipPaths
  const uid = useId().replace(/:/g, '');
  const bg = `lg-bg-${uid}`;
  const a = `lg-a-${uid}`;
  const b = `lg-b-${uid}`;
  const clip = `lg-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={b} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <clipPath id={clip}>
          <rect x="96" y="96" width="224" height="224" rx="48" />
        </clipPath>
      </defs>
      <rect x="8" y="8" width="496" height="496" rx="112" fill={`url(#${bg})`} />
      <rect
        x="9.5"
        y="9.5"
        width="493"
        height="493"
        rx="110.5"
        fill="none"
        stroke="#334155"
        strokeOpacity="0.6"
        strokeWidth="3"
      />
      <rect x="96" y="96" width="224" height="224" rx="48" fill={`url(#${a})`} />
      <rect x="192" y="192" width="224" height="224" rx="48" fill={`url(#${b})`} />
      <rect
        x="192"
        y="192"
        width="224"
        height="224"
        rx="48"
        fill="#fef3c7"
        clipPath={`url(#${clip})`}
      />
    </svg>
  );
}

export default function Logo({ size = 'sm', withText = false, className = '', textClassName = '' }) {
  const s = LOGO_SIZES[size] || LOGO_SIZES.sm;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark
        title={withText ? undefined : APP_NAME}
        className={`shrink-0 drop-shadow-md transition-all group-hover:brightness-110 ${s.box}`}
      />
      {withText && (
        <span
          className={`font-bold tracking-tight text-white whitespace-nowrap leading-none ${s.text} ${textClassName}`}
        >
          {APP_NAME}
        </span>
      )}
    </div>
  );
}
