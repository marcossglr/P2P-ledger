import unittest
from backend.app.services.parsers import normalize_number, parse_binance_csv


class TestParsers(unittest.TestCase):
    def test_normalize_number(self):
        """Prueba que el normalizador numérico maneje correctamente comas, puntos y formatos latinos/anglosajones."""
        self.assertEqual(normalize_number("1.250,50"), 1250.50)
        self.assertEqual(normalize_number("1,250.50"), 1250.50)
        self.assertEqual(normalize_number("450,00"), 450.0)
        self.assertEqual(normalize_number("450.00"), 450.0)
        self.assertEqual(normalize_number("-1.500,25"), -1500.25)
        self.assertEqual(normalize_number(100.5), 100.5)
        self.assertEqual(normalize_number(None), 0.0)
        self.assertEqual(normalize_number(""), 0.0)
        self.assertEqual(normalize_number("Bs. 2.400,00"), 2400.0)

    def test_parse_binance_csv_english(self):
        """Prueba el parseo de CSV de Binance con cabeceras en inglés."""
        csv_content = (
            "Order Number,Order Type,Asset Type,Fiat Type,Total Price,Unit Price,Quantity,Commission,Status,Created Time,Counterparty\n"
            "2026103001,Buy,USDT,VES,4000.00,40.00,100.00,0.1,Completed,2026-10-30 10:00:00,TraderJuan\n"
            "2026103002,Sell,USDT,VES,4200.00,42.00,100.00,0.1,Completed,2026-10-30 11:00:00,TraderMaria\n"
            "2026103003,Buy,USDT,VES,2000.00,40.00,50.00,0.05,Cancelled,2026-10-30 12:00:00,TraderPedro\n"
        ).encode("utf-8")

        result = parse_binance_csv(csv_content, "test_orders_en.csv")

        self.assertEqual(result["total_rows_raw"], 3)
        self.assertEqual(result["valid_rows"], 3)
        self.assertEqual(len(result["records"]), 3)

        first = result["records"][0]
        self.assertEqual(first["order_number"], "2026103001")
        self.assertEqual(first["order_type"], "COMPRA")
        self.assertEqual(first["asset"], "USDT")
        self.assertEqual(first["fiat_currency"], "VES")
        self.assertEqual(first["fiat_amount"], 4000.0)
        self.assertEqual(first["unit_price"], 40.0)
        self.assertEqual(first["crypto_amount"], 100.0)
        self.assertEqual(first["order_status"], "COMPLETED")
        self.assertEqual(first["counterparty"], "TraderJuan")

        # Verificar orden cancelada
        cancelled = result["records"][2]
        self.assertEqual(cancelled["order_number"], "2026103003")
        self.assertEqual(cancelled["order_status"], "CANCELLED")

    def test_parse_binance_csv_spanish(self):
        """Prueba el parseo de CSV de Binance con cabeceras en español."""
        csv_content = (
            "Número de orden,Tipo de orden,Tipo de activo,Moneda Fiat,Precio total,Precio,Cantidad,Comisión,Estado,Fecha de creación,Contraparte\n"
            "2026103004,Compra,USDT,VES,5000,50,100,0.1,Completado,2026-10-30 15:00:00,ComerciantePepe\n"
        ).encode("utf-8")

        result = parse_binance_csv(csv_content, "test_orders_es.csv")

        self.assertEqual(result["valid_rows"], 1)
        record = result["records"][0]
        self.assertEqual(record["order_number"], "2026103004")
        self.assertEqual(record["order_type"], "COMPRA")
        self.assertEqual(record["order_status"], "COMPLETED")
        self.assertEqual(record["counterparty"], "ComerciantePepe")


if __name__ == "__main__":
    unittest.main()
