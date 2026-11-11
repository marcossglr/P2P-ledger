#!/usr/bin/env python3
"""
Exporta la especificación OpenAPI de FastAPI en formato JSON.
Permite validar contratos de la API y alimentar generadores de tipos de cliente sin levantar el servidor.
"""

import sys
import json
from pathlib import Path

# Agregar backend al sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.main import app
except ImportError as err:
    print(f"Error importando la aplicación FastAPI: {err}")
    sys.exit(1)


def export_openapi(output_path: Path):
    schema = app.openapi()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(schema, indent=2), encoding="utf-8")
    print(f"✓ OpenAPI schema exportado en: {output_path}")


if __name__ == "__main__":
    out = BACKEND_DIR / "openapi.json"
    if len(sys.argv) > 1:
        out = Path(sys.argv[1])
    export_openapi(out)
