import os
import sys
import json
import time
import tempfile
import threading
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

def get_runtime_filepath() -> Path:
    """
    Retorna la ruta absoluta del archivo descriptor de runtime.
    Se usa el directorio temporal con sufijo de UID (en Unix) para evitar colisiones multi-usuario.
    """
    uid = getattr(os, "getuid", lambda: "")()
    filename = f"p2p-ledger-runtime-{uid}.json" if uid != "" else "p2p-ledger-runtime.json"
    return Path(tempfile.gettempdir()) / filename

def _parent_watchdog(parent_pid: int, runtime_file: Path | None = None):
    """
    Hilo centinela que supervisa al proceso padre (aplicación Tauri).
    Si la aplicación Tauri se cierra, muere o se bloquea, el proceso del backend
    detecta la orfandad y se auto-termina inmediatamente para liberar puertos y recursos.
    """
    while True:
        time.sleep(1.5)
        if sys.platform == "win32":
            try:
                import ctypes
                SYNCHRONIZE = 0x00100000
                process = ctypes.windll.kernel32.OpenProcess(SYNCHRONIZE, False, parent_pid)
                if not process:
                    break
                # Esperar 0ms para testear si el proceso aún existe
                wait_result = ctypes.windll.kernel32.WaitForSingleObject(process, 0)
                ctypes.windll.kernel32.CloseHandle(process)
                if wait_result != 0x00000102: # 0x102 = WAIT_TIMEOUT (sigue corriendo)
                    break
            except Exception:
                break
        else:
            # En Linux / macOS: si el proceso padre original muere, el proceso es reparentado
            # a PID 1 o a systemd --user (distinto de parent_pid).
            if os.getppid() != parent_pid:
                break

    print(f"[P2P Ledger Backend] Proceso padre (PID {parent_pid}) finalizó. Cerrando backend...")
    if runtime_file and runtime_file.exists():
        try:
            runtime_file.unlink()
        except Exception:
            pass
    os._exit(0)

def start_server():
    # En Windows, freeze_support es requerido para multiprocessing al compilar
    multiprocessing.freeze_support()

    runtime_file = get_runtime_filepath()

    # Si se ejecuta como binario standalone empaquetado (sidecar de Tauri) o con un padre asignado
    parent_pid = os.getppid()
    if parent_pid > 1:
        watchdog_thread = threading.Thread(
            target=_parent_watchdog,
            args=(parent_pid, runtime_file),
            daemon=True,
            name="ParentWatchdog",
        )
        watchdog_thread.start()
    
    # En producción / Desktop: usar puerto dinámico efímero (0) a menos que se fuerce PORT explícitamente en el entorno.
    # Si PORT está configurado explícitamente, se respeta ese valor.
    env_port = os.environ.get("PORT")
    requested_port = int(env_port) if env_port else (int(settings.PORT) if hasattr(settings, "PORT") else 0)
    host = "127.0.0.1"

    config = uvicorn.Config(app, host=host, port=requested_port, log_level="info", access_log=False)
    server = uvicorn.Server(config)

    # Enlazar el socket para conocer de inmediato el puerto efímero asignado por el sistema operativo
    sock = config.bind_socket()
    actual_port = sock.getsockname()[1]
    
    print(f"Iniciando P2P Ledger Backend en {host}:{actual_port} (PID {os.getpid()})")
    
    # Escribir descriptor de runtime para que Tauri / Frontend conozcan el puerto activo
    try:
        runtime_data = {
            "port": actual_port,
            "host": host,
            "pid": os.getpid(),
            "started_at": time.time(),
        }
        runtime_file.write_text(json.dumps(runtime_data), encoding="utf-8")
    except Exception as err:
        print(f"[P2P Ledger Backend] Advertencia al escribir runtime file: {err}")

    try:
        server.run(sockets=[sock])
    finally:
        if runtime_file.exists():
            try:
                runtime_file.unlink()
            except Exception:
                pass

if __name__ == "__main__":
    start_server()
