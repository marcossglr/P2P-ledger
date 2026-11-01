/**
 * Utilidades compartidas para parseo, formateo y cálculo numérico.
 */

/**
 * Normaliza cualquier entrada de texto de monto (ej: "100k", "100K", "100.000", "50,000", "1.5m") a un número float válido.
 */
export function parseSmartAmount(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().toLowerCase().replace(/\s+/g, '');
  if (!clean) return null;

  if (clean.endsWith('k')) {
    const num = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return Number.isFinite(num) && num > 0 ? num * 1000 : null;
  }
  if (clean.endsWith('m')) {
    const num = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return Number.isFinite(num) && num > 0 ? num * 1000000 : null;
  }

  // Quitar separadores de miles habituales (ej: 100.000 -> 100000 o 100,000 -> 100000)
  const normalized = clean.includes('.') && clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.includes('.') && clean.split('.')[1]?.length === 3
    ? clean.replace(/\./g, '')
    : clean.replace(/,/g, '');

  const num = parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Formatea una tasa o precio numérico en formato regional español con decimales configurables.
 */
export function fmtRate(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Formatea una cantidad fiat o cripto.
 */
export function fmtAmount(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '0,00';
  return Number(n).toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
