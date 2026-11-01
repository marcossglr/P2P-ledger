#!/usr/bin/env bash

set -e

# Directorio base del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

MODE="${1:-app}"

if [ "$MODE" == "--dev" ] || [ "$MODE" == "dev" ]; then
    echo "=================================================="
    echo "   Modo DESARROLLO (Backend con reload + Vite HMR)"
    echo "=================================================="
    
    # 1. Iniciar Backend
    echo "🚀 Levantando Backend en http://127.0.0.1:8000 ..."
    cd "$PROJECT_ROOT/backend"
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
    BACKEND_PID=$!
    
    sleep 1
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "❌ Error al iniciar el Backend."
        exit 1
    fi
    
    # 2. Iniciar Frontend dev server
    echo "🚀 Levantando Frontend Vite en http://127.0.0.1:5173 ..."
    cd "$PROJECT_ROOT/frontend"
    npm run dev &
    FRONTEND_PID=$!
    
    echo ""
    echo "=================================================="
    echo "   - Frontend (Vite Dev): http://localhost:5173   "
    echo "   - Backend API Docs:    http://127.0.0.1:8000/docs"
    echo "   (Presiona Ctrl + C para detener todo)          "
    echo "=================================================="
    echo ""
    wait "$FRONTEND_PID" "$BACKEND_PID"

else
    echo "=================================================="
    echo "   Modo STANDALONE / PRODUCCIÓN LOCAL             "
    echo "=================================================="
    
    # Verificar si el build de frontend existe, si no, compilarlo
    if [ ! -d "$PROJECT_ROOT/frontend/dist" ]; then
        echo "📦 Compilando assets del Frontend por primera vez..."
        cd "$PROJECT_ROOT/frontend"
        npm run build
    fi
    
    # Iniciar FastAPI que sirve tanto la API como la UI en el puerto 8000
    echo "🚀 Iniciando P2P Ledger en http://127.0.0.1:8000 ..."
    cd "$PROJECT_ROOT/backend"
    uvicorn app.main:app --host 127.0.0.1 --port 8000 &
    BACKEND_PID=$!
    
    sleep 1
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "❌ Error al iniciar el servidor."
        exit 1
    fi
    
    echo ""
    echo "=================================================="
    echo "   ✅ Aplicación activa y lista para usar        "
    echo "   👉 Abre en tu navegador: http://localhost:8000"
    echo "   (Presiona Ctrl + C para detener)              "
    echo "=================================================="
    echo ""
    wait "$BACKEND_PID"
fi

