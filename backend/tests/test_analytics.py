import unittest
from backend.app.models import BinanceOrder, BankAccount
from backend.app.services.analytics import compute_operations_analytics


class TestAnalyticsFinancialFormulas(unittest.TestCase):
    """
    Verifica las fórmulas financieras especificadas en docs/formulas.md:
    1. WAC (Costo Promedio Ponderado de Compra) = Total Fiat Comprado / Total USDT Comprado
    2. WAP (Precio Promedio Ponderado de Venta) = Total Fiat Vendido / Total USDT Vendido
    3. Spread Absoluto = WAP - WAC
    4. Spread Porcentual = ((WAP - WAC) / WAC) * 100
    5. Ganancia Bruta (Fiat) = Volumen Arbitrado * Spread Absoluto
    6. Comisiones (Binance + Bancaria)
    7. Ganancia Neta
    """

    def test_wac_wap_and_spread_calculation(self):
        # 100 USDT comprados a tasa 40.00 VES -> 4000 VES
        # 100 USDT comprados a tasa 42.00 VES -> 4200 VES
        # Total Compras: 200 USDT por 8200 VES => WAC = 8200 / 200 = 41.00 VES/USDT
        order_buy_1 = BinanceOrder(
            order_number="BUY-001",
            order_type="COMPRA",
            order_status="COMPLETED",
            fiat_amount=4000.0,
            crypto_amount=100.0,
            unit_price=40.0,
            asset="USDT",
            fiat_currency="VES",
            commission_usdt=0.0,
            order_date="2026-10-30 10:00:00",
        )
        order_buy_2 = BinanceOrder(
            order_number="BUY-002",
            order_type="COMPRA",
            order_status="COMPLETED",
            fiat_amount=4200.0,
            crypto_amount=100.0,
            unit_price=42.0,
            asset="USDT",
            fiat_currency="VES",
            commission_usdt=0.0,
            order_date="2026-10-30 11:00:00",
        )

        # 150 USDT vendidos a tasa 43.05 VES -> 6457.50 VES => WAP = 43.05 VES/USDT
        order_sell_1 = BinanceOrder(
            order_number="SELL-001",
            order_type="VENTA",
            order_status="COMPLETED",
            fiat_amount=6457.5,
            crypto_amount=150.0,
            unit_price=43.05,
            asset="USDT",
            fiat_currency="VES",
            commission_usdt=0.0,
            order_date="2026-10-30 12:00:00",
        )

        result = compute_operations_analytics(
            [order_buy_1, order_buy_2, order_sell_1],
            bank_fee_rate_pct=0.0,
            target_asset="USDT",
        )

        # WAC esperado = 41.00
        self.assertAlmostEqual(result["wac_buy_price"], 41.00, places=2)
        # WAP esperado = 43.05
        self.assertAlmostEqual(result["wap_sell_price"], 43.05, places=2)
        # Spread Absoluto = 43.05 - 41.00 = 2.05
        self.assertAlmostEqual(result["spread_abs"], 2.05, places=2)
        # Spread Pct = (2.05 / 41.00) * 100 = 5.0%
        self.assertAlmostEqual(result["spread_pct"], 5.0, places=2)
        # Volumen arbitrado (ciclo cerrado) = min(200, 150) = 150 USDT
        self.assertAlmostEqual(result["matched_usdt_volume"], 150.0, places=2)
        # Ganancia Bruta Fiat = 150 * 2.05 = 307.50 VES
        self.assertAlmostEqual(result["gross_profit_fiat"], 307.50, places=2)
        # Ganancia Neta Fiat (sin comisiones) = 307.50 VES
        self.assertAlmostEqual(result["net_profit_fiat"], 307.50, places=2)
        # Ganancia Neta USDT = 307.50 / 41.00 = 7.50 USDT
        self.assertAlmostEqual(result["net_profit_usdt"], 7.50, places=2)

    def test_commissions_and_bank_fees(self):
        # Compra de 100 USDT por 4000 VES vía Pago Móvil con 0.1 USDT comisión Binance
        order_buy = BinanceOrder(
            order_number="BUY-PM",
            order_type="COMPRA",
            order_status="COMPLETED",
            fiat_amount=4000.0,
            crypto_amount=100.0,
            unit_price=40.0,
            asset="USDT",
            fiat_currency="VES",
            commission_usdt=0.1,
            payment_channel="PAGO_MOVIL",
            order_date="2026-10-30 10:00:00",
        )
        # Venta de 100 USDT por 4200 VES con 0.1 USDT comisión Binance
        order_sell = BinanceOrder(
            order_number="SELL-TF",
            order_type="VENTA",
            order_status="COMPLETED",
            fiat_amount=4200.0,
            crypto_amount=100.0,
            unit_price=42.0,
            asset="USDT",
            fiat_currency="VES",
            commission_usdt=0.1,
            payment_channel="TRANSFERENCIA",
            order_date="2026-10-30 11:00:00",
        )

        # bank_fee_rate_pct = 0.3% aplicado al Pago Móvil (0.3% de 4000 = 12 VES, pero con piso mínimo SUDEBAN = 14 VES)
        result = compute_operations_analytics(
            [order_buy, order_sell],
            bank_fee_rate_pct=0.3,
            target_asset="USDT",
        )

        # Ganancia bruta = 100 * (42 - 40) = 200 VES
        self.assertAlmostEqual(result["gross_profit_fiat"], 200.0, places=2)
        # Total comisión Binance = 0.2 USDT. A tasa WAC (40) = 8 VES
        self.assertAlmostEqual(result["commission_fiat_cost"], 8.0, places=2)
        # Comisión bancaria (0.3% sobre 4000 VES Pago Móvil = 12, piso mínimo = 14 VES)
        self.assertAlmostEqual(result["estimated_bank_fees_fiat"], 14.0, places=2)
        # Ganancia neta Fiat = 200 - 8 - 14 = 178 VES
        self.assertAlmostEqual(result["net_profit_fiat"], 178.0, places=2)
        # Ganancia neta USDT = 178 / 40 = 4.45 USDT
        self.assertAlmostEqual(result["net_profit_usdt"], 4.45, places=2)


if __name__ == "__main__":
    unittest.main()
