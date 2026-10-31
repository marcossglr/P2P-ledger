import unittest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings


class TestSecurityAndAuth(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check_always_accessible(self):
        """El health check debe responder 200 sin autenticación requerida."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ok")

    def test_security_headers_present(self):
        """Verificar presencia de cabeceras de seguridad HTTP básicas."""
        response = self.client.get("/api/health")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")

    def test_backup_path_traversal_prevention(self):
        """Verificar que solicitudes con Path Traversal sean rechazadas con 400 Bad Request."""
        # Intento de descarga maliciosa fuera del directorio
        res_download = self.client.get("/api/backups/download/../../etc/passwd")
        self.assertIn(res_download.status_code, [400, 404])

        # Intento de restauración maliciosa
        res_restore = self.client.post("/api/backups/restore", json={"filename": "../../etc/passwd"})
        self.assertEqual(res_restore.status_code, 422)  # Validación Pydantic o 400

    def test_auth_enforcement_when_enabled(self):
        """Verificar que si REQUIRE_AUTH se activa, se exija X-API-Key."""
        original_auth = settings.REQUIRE_AUTH
        original_key = settings.API_SECRET_KEY
        try:
            settings.REQUIRE_AUTH = True
            settings.API_SECRET_KEY = "test-secret-token"

            # 1. Petición sin token -> 401
            res_no_token = self.client.get("/api/bank-inventory")
            self.assertEqual(res_no_token.status_code, 401)

            # 2. Petición con token inválido -> 403
            res_bad_token = self.client.get("/api/bank-inventory", headers={"X-API-Key": "wrong-token"})
            self.assertEqual(res_bad_token.status_code, 403)

            # 3. Petición con token correcto -> 200
            res_valid_token = self.client.get("/api/bank-inventory", headers={"X-API-Key": "test-secret-token"})
            self.assertEqual(res_valid_token.status_code, 200)
        finally:
            settings.REQUIRE_AUTH = original_auth
            settings.API_SECRET_KEY = original_key


if __name__ == "__main__":
    unittest.main()
