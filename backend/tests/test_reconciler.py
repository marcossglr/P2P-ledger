import unittest
from backend.app.models import BinanceOrder, BankTransaction
from backend.app.services.reconciler import run_reconciliation


class TestReconciler(unittest.TestCase):
    def test_reconciliation_exact_and_fuzzy(self):
        # Orden 1: Compra por 5000 VES el 2026-10-30
        order_exact = BinanceOrder(
            id=1,
            order_number="ORD-EXACT-001",
            order_type="COMPRA",
            order_status="COMPLETED",
            fiat_amount=5000.0,
            crypto_amount=120.0,
            order_date="2026-10-30 10:00:00",
            reference_note="Ref 12345678",
            status="UNMATCHED",
        )
        # Transacción bancaria 1: Débito de 5000 con ref 12345678 el 2026-10-30
        tx_exact = BankTransaction(
            id=101,
            description="Pago Movil recibido",
            tx_date="2026-10-30",
            reference="12345678",
            debit=5000.0,
            credit=0.0,
            status="UNMATCHED",
        )

        # Orden 2: Venta por 3200 VES el 2026-10-28
        order_fuzzy = BinanceOrder(
            id=2,
            order_number="ORD-FUZZY-002",
            order_type="VENTA",
            order_status="COMPLETED",
            fiat_amount=3200.0,
            crypto_amount=75.0,
            order_date="2026-10-28 14:00:00",
            reference_note="Pago móvil sin ref",
            status="UNMATCHED",
        )
        # Transacción bancaria 2: Crédito de 3200 con fecha 2026-10-29 (1 día de desfase)
        tx_fuzzy = BankTransaction(
            id=102,
            description="Transferencia terceros",
            tx_date="2026-10-29",
            reference="999999",
            debit=0.0,
            credit=3200.0,
            status="UNMATCHED",
        )

        res = run_reconciliation(
            [order_exact, order_fuzzy],
            [tx_exact, tx_fuzzy],
            tolerance_days=2,
        )

        self.assertEqual(res["matched_count"], 2)
        self.assertEqual(res["unmatched_orders_count"], 0)
        self.assertEqual(res["unmatched_bank_count"], 0)
        self.assertEqual(order_exact.status, "MATCHED_EXACT")
        self.assertEqual(order_fuzzy.status, "MATCHED_FUZZY")


if __name__ == "__main__":
    unittest.main()
