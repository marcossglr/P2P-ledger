import { describe, it, expect } from 'vitest';
import { parseSmartAmount, fmtRate, fmtAmount } from '../utils/formatters';

describe('formatters and smart parsers', () => {
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
});
