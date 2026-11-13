import { describe, it, expect, beforeEach } from 'vitest';
import { parseSmartAmount, fmtRate, fmtAmount, fmtTime, fmtDate, fmtDateTime } from '../utils/formatters';

describe('formatters and smart parsers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parses amounts with k and m suffixes', () => {
    expect(parseSmartAmount('10k')).toBe(10000);
    expect(parseSmartAmount('2.5k')).toBe(2500);
    expect(parseSmartAmount('1m')).toBe(1000000);
    expect(parseSmartAmount('1.5M')).toBe(1500000);
  });

  it('parses formatted amounts with dots or commas', () => {
    expect(parseSmartAmount('100.000')).toBe(100000);
    expect(parseSmartAmount('50,000')).toBe(50000);
    expect(parseSmartAmount('123.456,78')).toBe(123456.78);
  });

  it('handles invalid or empty inputs gracefully', () => {
    expect(parseSmartAmount('')).toBeNull();
    expect(parseSmartAmount('abc')).toBeNull();
    expect(parseSmartAmount(null)).toBeNull();
    expect(parseSmartAmount(undefined)).toBeNull();
  });

  it('formats rates with correct decimals', () => {
    expect(fmtRate(null)).toBe('—');
    expect(fmtRate(undefined)).toBe('—');
    expect(fmtRate(1234.56, 2)).toMatch(/1.*234,56/);
  });

  it('formats date and time in default 24H without seconds', () => {
    const raw = '2026-11-03 14:42:05';
    expect(fmtDate(raw)).toBe('03/11/2026');
    expect(fmtTime(raw)).toBe('14:42');
    expect(fmtDateTime(raw)).toBe('03/11/2026 14:42');
  });

  it('respects 12H format and seconds options', () => {
    const raw = '2026-11-03 14:42:05';
    expect(fmtTime(raw, { timeFormat: '12H', showSeconds: false })).toBe('02:42 PM');
    expect(fmtTime(raw, { timeFormat: '12H', showSeconds: true })).toBe('02:42:05 PM');
    expect(fmtTime(raw, { timeFormat: '24H', showSeconds: true })).toBe('14:42:05');
    expect(fmtDateTime(raw, { timeFormat: '12H', showSeconds: true })).toBe('03/11/2026 02:42:05 PM');
  });

  it('respects user preferences from localStorage', () => {
    localStorage.setItem('p2p_time_format', '12H');
    localStorage.setItem('p2p_time_show_seconds', 'true');
    const raw = '2026-11-03 09:05:08';
    expect(fmtTime(raw)).toBe('09:05:08 AM');
    expect(fmtDateTime(raw)).toBe('03/11/2026 09:05:08 AM');
  });
});
