/**
 * Utilidades compartidas para parseo, formateo y cálculo numérico, de fechas y horas.
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

/**
 * Obtiene las preferencias actuales del usuario para fecha y hora desde localStorage.
 */
export function getTimePreferences() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { timeFormat: '24H', showSeconds: false };
  }
  const timeFormat = localStorage.getItem('p2p_time_format') === '12H' ? '12H' : '24H';
  const showSeconds = localStorage.getItem('p2p_time_show_seconds') === 'true';
  return { timeFormat, showSeconds };
}

/**
 * Convierte un input de fecha/hora (string "YYYY-MM-DD HH:MM:SS", timestamp en ms, Date object) en componentes numéricos.
 * Retorna null si no se puede parsear.
 */
function parseDateTimeComponents(val) {
  if (!val && val !== 0) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return {
      year: val.getFullYear(),
      month: val.getMonth() + 1,
      day: val.getDate(),
      hour: val.getHours(),
      minute: val.getMinutes(),
      second: val.getSeconds(),
    };
  }

  if (typeof val === 'number') {
    // Si viene como epoch ms
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      second: d.getSeconds(),
    };
  }

  const str = String(val).trim();
  if (!str || str === '—' || str === '-') return null;

  // Formato común SQLite o Binance: "YYYY-MM-DD HH:MM:SS" o "YYYY-MM-DDTHH:MM:SS"
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
      hour: isoMatch[4] != null ? parseInt(isoMatch[4], 10) : 0,
      minute: isoMatch[5] != null ? parseInt(isoMatch[5], 10) : 0,
      second: isoMatch[6] != null ? parseInt(isoMatch[6], 10) : 0,
      hasTime: isoMatch[4] != null,
    };
  }

  // Formato "DD/MM/YYYY HH:MM:SS" o "DD-MM-YYYY"
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    return {
      year: parseInt(dmyMatch[3], 10),
      month: parseInt(dmyMatch[2], 10),
      day: parseInt(dmyMatch[1], 10),
      hour: dmyMatch[4] != null ? parseInt(dmyMatch[4], 10) : 0,
      minute: dmyMatch[5] != null ? parseInt(dmyMatch[5], 10) : 0,
      second: dmyMatch[6] != null ? parseInt(dmyMatch[6], 10) : 0,
      hasTime: dmyMatch[4] != null,
    };
  }

  // Solo hora "HH:MM:SS" o "HH:MM"
  const timeOnlyMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (timeOnlyMatch) {
    return {
      year: null,
      month: null,
      day: null,
      hour: parseInt(timeOnlyMatch[1], 10),
      minute: parseInt(timeOnlyMatch[2], 10),
      second: timeOnlyMatch[3] != null ? parseInt(timeOnlyMatch[3], 10) : 0,
      hasTime: true,
    };
  }

  // Fallback nativo Date
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
      hour: fallback.getHours(),
      minute: fallback.getMinutes(),
      second: fallback.getSeconds(),
      hasTime: true,
    };
  }

  return null;
}

/**
 * Formatea únicamente la hora según las preferencias de 24H/12H y segundos.
 * @param {string|number|Date} val
 * @param {Object} [overrides] - { timeFormat: '24H'|'12H', showSeconds: boolean }
 */
export function fmtTime(val, overrides = {}) {
  const comp = parseDateTimeComponents(val);
  if (!comp || !comp.hasTime && comp.hour == null) return typeof val === 'string' && val ? val : '—';

  const prefs = getTimePreferences();
  const timeFormat = overrides.timeFormat || prefs.timeFormat;
  const showSeconds = overrides.showSeconds !== undefined ? overrides.showSeconds : prefs.showSeconds;

  let h = comp.hour;
  const m = String(comp.minute).padStart(2, '0');
  const s = String(comp.second).padStart(2, '0');

  if (timeFormat === '12H') {
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const h12Str = String(h12).padStart(2, '0');
    return showSeconds ? `${h12Str}:${m}:${s} ${period}` : `${h12Str}:${m} ${period}`;
  }

  const h24Str = String(h).padStart(2, '0');
  return showSeconds ? `${h24Str}:${m}:${s}` : `${h24Str}:${m}`;
}

/**
 * Formatea una fecha a formato estándar compacto "DD/MM/YYYY".
 * @param {string|number|Date} val
 */
export function fmtDate(val) {
  const comp = parseDateTimeComponents(val);
  if (!comp || comp.year == null) return typeof val === 'string' && val ? val : '—';

  const d = String(comp.day).padStart(2, '0');
  const m = String(comp.month).padStart(2, '0');
  const y = comp.year;
  return `${d}/${m}/${y}`;
}

/**
 * Formatea fecha y hora combinada respetando las preferencias del usuario:
 * "DD/MM/YYYY HH:MM" o "DD/MM/YYYY hh:mm AM/PM" (o con segundos si está activado).
 * @param {string|number|Date} val
 * @param {Object} [overrides]
 */
export function fmtDateTime(val, overrides = {}) {
  const comp = parseDateTimeComponents(val);
  if (!comp) return typeof val === 'string' && val ? val : '—';

  const datePart = comp.year != null ? fmtDate(val) : '';
  const timePart = fmtTime(val, overrides);

  if (datePart && timePart && timePart !== '—') {
    return `${datePart} ${timePart}`;
  }
  return datePart || timePart || '—';
}
