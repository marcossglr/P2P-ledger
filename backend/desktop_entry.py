import sys
import multiprocessing
from pathlib import Path
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
