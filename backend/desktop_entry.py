import os
import sys
import multiprocessing
from pathlib import Path

# Configurar bundle de certificados SSL si corre empaquetado con PyInstaller
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    cacert_path = os.path.join(sys._MEIPASS, "certifi", "cacert.pem")
    if os.path.exists(cacert_path):
        os.environ["SSL_CERT_FILE"] = cacert_path
        os.environ["REQUESTS_CA_BUNDLE"] = cacert_path
else:
    try:
        import certifi
        os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    except Exception:
        pass

import uvicorn
from app.main import app
from app.config import settings

def start_server():
    # En Windows, freeze_support es requerido para multiprocessing al compilar
    multiprocessing.freeze_support()
    
    port = int(settings.PORT) if hasattr(settings, "PORT") else 8000
    host = "127.0.0.1"
    
    print(f"Iniciando P2P Ledger Backend en {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info", access_log=False)

if __name__ == "__main__":
    start_server()
