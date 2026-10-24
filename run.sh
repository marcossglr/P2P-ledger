#!/usr/bin/env bash

set -e

# Directorio base del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "   Iniciando P2P Ledger (Backend + Frontend)     "
echo "=================================================="

# Verificar entorno virtual de Python
VENV_PATH="$PROJECT_ROOT/backend/.venv"
if [ ! -d "$VENV_PATH" ]; then
    echo "❌ Error: No se encontró el entorno virtual en $VENV_PATH"
    echo "Por favor créalo con: python -m venv $VENV_PATH"
    exit 1
fi

# Activar el entorno virtual (contiene python, uvicorn, node y npm)
source "$VENV_PATH/bin/activate"

# Asegurar que los binarios del venv (node, npm, uvicorn) tengan prioridad en PATH
export PATH="$VENV_PATH/bin:$PATH"

# Verificar dependencias necesarias
for cmd in uvicorn node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ Error: Comando '$cmd' no encontrado en el entorno virtual o en PATH."
        exit 1
    fi
done

# Manejo de cierre limpio con Ctrl+C
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo "Servicios detenidos correctamente."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Iniciar Backend (FastAPI / Uvicorn)
echo "🚀 Levantando Backend en http://127.0.0.1:8000 ..."
cd "$PROJECT_ROOT/backend"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Esperar 1 segundo para verificar que el backend haya levantado
sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Error al iniciar el Backend."
    exit 1
fi

# 2. Iniciar Frontend (Vite / React)
echo "🚀 Levantando Frontend en http://127.0.0.1:5173 ..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "   Aplicación en funcionamiento                   "
echo "   - Frontend: http://localhost:5173              "
echo "   - Backend API Docs: http://127.0.0.1:8000/docs "
echo "   (Presiona Ctrl + C para detener todo)          "
echo "=================================================="
echo ""

# Esperar a que los procesos finalicen
wait "$FRONTEND_PID" "$BACKEND_PID"
