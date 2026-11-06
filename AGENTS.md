# P2P Reconciliation Ledger - Estándares y Reglas de Desarrollo

Este documento establece las directrices permanentes de arquitectura, UX y diseño para todos los agentes y desarrolladores que interactúen con el proyecto.

---

## 1. Filosofía de Interfaz: Desktop-First (Terminal Financiero)

- **Propósito:** Esta aplicación es un terminal operativo y de conciliación financiera de escritorio.
- **Prohibición de barras de scroll forzadas:**
  - **NUNCA** añadir `overflow-x-auto` en barras de herramientas, grupos de filtros, toolbars o cabeceras que generen scrollbars horizontales nativas en navegadores de escritorio (Linux / Windows).
  - La maquetación debe ser limpia, horizontal y compacta (`flex items-center gap-2.5`), apoyándose en el salto natural de línea (`flex-wrap`) solo en caso de redimensión estrecha de la ventana.
- **Densidad de datos:** Mantener la estética sobria, compacta y de alta densidad para análisis contable y de mercado P2P.

---

## 2. Sistema Centralizado de Diseño (`frontend/src/components/ui/`)

Cualquier componente nuevo o modificado debe consumir exclusivamente los componentes primitivos centralizados exportados desde [`frontend/src/components/ui/index.js`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/index.js):

### A. Controles de Formulario e Inputs
- **Componentes:** [`Input.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Input.jsx), [`Select.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Select.jsx)
- **Altura estándar:** `h-8` (vía `size="sm"`).
- **Radio de curvatura:** `rounded-xl` (12px).
- **Estilos:** Fondo `bg-slate-900/80`, borde `border-slate-800/80`, focus ring en ámbar (`focus:ring-amber-500/50`).

### B. Botones y Acciones
- **Componente:** [`Button.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Button.jsx)
- **Tamaño estándar:** `size="sm"` (`h-8`, `rounded-xl`).
- **Tamaño compacto / chips:** `size="xs"` (`h-7`, `rounded-lg`).
- **Variantes semánticas:**
  - `primary`: Ámbar translúcido para la acción principal.
  - `secondary`: Slate oscuro para botones secundarios estándar.
  - `emerald`: Operaciones de compra o conciliaciones exitosas.
  - `danger`: Operaciones de venta, cancelaciones o acciones destructivas.
  - `ghost`: Acciones discretas o botones de limpiar/cerrar.

### C. Cápsulas Contenedoras y Toolbars (Regla de Radios Concéntricos)
- **Cápsula exterior contenedora:**
  - Altura: `h-8`.
  - Radio: `rounded-xl` (12px).
  - Fondo y borde: `bg-slate-950/70 border border-slate-800/80 p-1`.
- **Botones/Pestañas internas (Chips hijos):**
  - Altura: `h-6`.
  - Radio: `rounded-lg` (8px).
  - Regla: El radio del hijo debe ser menor al del contenedor padre para mantener balance concéntrico visual.

### D. Badges e Indicadores de Estado
- **Componente:** [`Badge.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Badge.jsx)
- **Radio:** `rounded-md`.
- **Variantes:** `success` (verde), `warning` (ámbar), `danger` (rojo), `info` (azul cielo), `neutral` (slate).

### E. Modales y Tarjetas
- **Componentes:** [`Modal.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Modal.jsx), [`Card.jsx`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/components/ui/Card.jsx)
- **Radio exterior:** `rounded-2xl` (16px) con `border-slate-800`.
- **Fondos:** Soporte para desenfoque y capas oscuras (`bg-slate-900/95 backdrop-blur-xs`).

### F. Temas Globales (`frontend/src/index.css`)
- Respetar compatibilidad con los temas definidos en [`frontend/src/index.css`](file:///home/marcossglr/Antigravity/Projects/John/frontend/src/index.css):
  - Tema por defecto (Dark Slate)
  - `LIGHT_ELEGANT`
  - `NAVY_MIDNIGHT`
- Mantener tipografía numérica y financiera monoespaciada para montos, precios y tasas (`tabular-nums` / `font-mono`).
