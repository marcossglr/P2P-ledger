import { describe, it, expect } from 'vitest';
import {
  fmtFiat,
  fmtUsdt,
  fmtRate,
  computeOperationsMetrics,
  buildDailySummaryText,
} from '../utils/operationsMetrics';

describe('operationsMetrics utilities', () => {
  describe('formatting helpers', () => {
    it('formats fiat with es-ES 2 decimal places', () => {
      expect(fmtFiat(1234.5)).toMatch(/1.*234,50/);
      expect(fmtFiat(0)).toBe('0,00');
      expect(fmtFiat(null)).toBe('0,00');
    });

    it('formats USDT with 2 decimals', () => {
      expect(fmtUsdt(9876.543)).toMatch(/9.*876,54/);
      expect(fmtUsdt(undefined)).toBe('0,00');
    });

    it('formats rates with minimum 2 and up to 4 decimals', () => {
      expect(fmtRate(45.6)).toBe('45,60');
      expect(fmtRate(45.6789)).toBe('45,6789');
      expect(fmtRate(45.67891)).toBe('45,6789');
    });
  });

  describe('computeOperationsMetrics', () => {
    it('computes metrics properly with full operational stats', () => {
      const stats = {
        wac_buy_price: 50.0,
        wap_sell_price: 52.0,
        gross_profit_fiat: 1000.0,
        estimated_bank_fees_fiat: 50.0,
        total_commission_usdt: 2.0,
        commission_fiat_cost: 100.0,
        matched_usdt_volume: 500.0,
        net_profit_usdt: 18.0,
        completed_orders: 10,
        total_usdt_volume: 1000.0,
      };

      const bankInventory = {
        consolidated: {
          total_calculated_balance_bs: 25000.0,
          equivalent_usdt: 500.0,
          ref_wac_rate: 50.0,
        },
      };

      const fundingWallet = {
        free: 1200.0,
        locked: 300.0,
        total: 1500.0,
      };

      const metrics = computeOperationsMetrics({
        stats,
        bankInventory,
        fundingWallet,
        ordersCount: 10,
      });

      expect(metrics.refRate).toBe(50.0);
      expect(metrics.grossProfitUsdt).toBe(20.0); // 1000 / 50
      expect(metrics.bankFeesUsdt).toBe(1.0); // 50 / 50
      expect(metrics.totalCommissionsAllUsdt).toBe(3.0); // 2 + 1
      expect(metrics.totalCommissionsAllFiat).toBe(150.0); // 100 + 50
      expect(metrics.matchedUsdt).toBe(500.0);
      expect(metrics.netMarginPct).toBeCloseTo(3.6, 5); // (18 / 500) * 100
      expect(metrics.completedCount).toBe(10);
      expect(metrics.avgTicketUsdt).toBe(100.0); // 1000 / 10
      expect(metrics.totalBankBs).toBe(25000.0);
      expect(metrics.totalBankUsdt).toBe(500.0);
      expect(metrics.binanceFundingTotal).toBe(1500.0);
      expect(metrics.totalCapitalConsolidatedUsdt).toBe(2000.0); // 1500 + 500
      expect(metrics.totalCapitalConsolidatedBs).toBe(100000.0); // 2000 * 50
    });

    it('falls back gracefully on empty or default stats', () => {
      const metrics = computeOperationsMetrics({});

      expect(metrics.refRate).toBe(1);
      expect(metrics.grossProfitUsdt).toBe(0);
      expect(metrics.bankFeesUsdt).toBe(0);
      expect(metrics.totalCommissionsAllUsdt).toBe(0);
      expect(metrics.matchedUsdt).toBe(0);
      expect(metrics.netMarginPct).toBe(0);
      expect(metrics.completedCount).toBe(0);
      expect(metrics.avgTicketUsdt).toBe(0);
      expect(metrics.totalBankBs).toBe(0);
      expect(metrics.binanceFundingTotal).toBe(0);
      expect(metrics.totalCapitalConsolidatedUsdt).toBe(0);
    });

    it('falls back to ref_wac_rate or wap_sell_price if wac_buy_price is zero', () => {
      const metricsWap = computeOperationsMetrics({
        stats: { wac_buy_price: 0, wap_sell_price: 60 },
      });
      expect(metricsWap.refRate).toBe(60);

      const metricsBankRef = computeOperationsMetrics({
        stats: { wac_buy_price: 0, wap_sell_price: 0 },
        bankInventory: { consolidated: { ref_wac_rate: 55 } },
      });
      expect(metricsBankRef.refRate).toBe(55);
    });
  });

  describe('buildDailySummaryText', () => {
    it('constructs formatted summary report text correctly', () => {
      const stats = {
        net_profit_usdt: 25.5,
        net_profit_fiat: 1275.0,
        total_usdt_volume: 2000.0,
        buy_usdt_total: 1000.0,
        sell_usdt_total: 1000.0,
        wac_buy_price: 50.0,
        wap_sell_price: 51.275,
        spread_pct: 2.55,
      };

      const metrics = {
        matchedUsdt: 1000.0,
        netMarginPct: 2.55,
        completedCount: 8,
        totalCapitalConsolidatedUsdt: 3500.0,
        totalBankBs: 50000.0,
      };

      const summary = buildDailySummaryText({
        stats,
        metrics,
        serverToday: '2026-11-13',
        fiat: 'VES',
      });

      expect(summary).toContain('📊 Resumen de Jornada P2P (2026-11-13)');
      expect(summary).toContain('Ganancia Neta: +25,50 USDT');
      expect(summary).toContain('[+2.55% margen]');
      expect(summary).toMatch(/Volumen Operado: .*2.*000,00 USDT \(8 órdenes\)/);
      expect(summary).toContain('Spread: +2.55%');
      expect(summary).toMatch(/Posición Consolidada: .*3.*500,00 USDT/);
    });
  });
});
