#!/usr/bin/env bash

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_PATH="$BACKEND_DIR/.venv"

HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

BACKEND_PID=""
FRONTEND_PID=""

# Colores para salida de terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
Uso: ./run.sh [COMANDO]

Comandos:
  dev (por defecto)   Inicia Backend con autoreload y Frontend Vite dev server (HMR)
  test, --test        Ejecuta la suite de pruebas del backend y frontend
  -h, --help          Muestra esta ayuda

Variables de entorno opcionales:
  HOST                Host de bind (por defecto: 127.0.0.1)
  PORT                Puerto backend (por defecto: 8000)
  FRONTEND_PORT       Puerto frontend Vite (por defecto: 5173)
EOF
    exit 0
}

cleanup() {
    local exit_code=$?
    trap - SIGINT SIGTERM EXIT
    echo -e "\n${YELLOW}Deteniendo servicios...${NC}"

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    wait "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null || true
    echo -e "${GREEN}Servicios detenidos correctamente.${NC}"
    exit "$exit_code"
}

trap cleanup SIGINT SIGTERM

check_prerequisites() {
    # 1. Entorno virtual Python
    if [ ! -d "$VENV_PATH" ]; then
        echo -e "${RED}❌ Error: No se encontró el entorno virtual en $VENV_PATH${NC}"
        echo "Créalo con: python3 -m venv $VENV_PATH && source $VENV_PATH/bin/activate && pip install -r $BACKEND_DIR/requirements.txt"
        exit 1
    fi

    # Activar venv y priorizar binarios
    source "$VENV_PATH/bin/activate"
    export PATH="$VENV_PATH/bin:$PATH"

    # 2. Verificar uvicorn
    if ! command -v uvicorn &>/dev/null; then
        echo -e "${RED}❌ Error: 'uvicorn' no está instalado en el entorno virtual.${NC}"
        echo "Ejecuta: pip install -r $BACKEND_DIR/requirements.txt"
        exit 1
    fi

    # 3. Verificar node y npm
    if ! command -v npm &>/dev/null; then
        echo -e "${RED}❌ Error: 'npm' no está disponible en el PATH ni en el entorno virtual.${NC}"
        exit 1
    fi

    # 4. Verificar node_modules
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}⚠️ 'node_modules' no encontrado. Instalando dependencias del Frontend...${NC}"
        (cd "$FRONTEND_DIR" && npm install)
    fi
}

check_port() {
    local port=$1
    if command -v lsof &>/dev/null; then
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${RED}❌ Error: El puerto $port ya está en uso.${NC}"
            exit 1
        fi
    fi
}

start_dev() {
    check_prerequisites
    check_port "$BACKEND_PORT"
    check_port "$FRONTEND_PORT"

    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}   Entorno de Desarrollo (FastAPI Reload + Vite HMR)  ${NC}"
    echo -e "${BLUE}==================================================${NC}"

    # 1. Iniciar Backend
    echo -e "🚀 Iniciando Backend en http://$HOST:$BACKEND_PORT ..."
    (cd "$BACKEND_DIR" && uvicorn app.main:app --host "$HOST" --port "$BACKEND_PORT" --reload) &
    BACKEND_PID=$!

    sleep 1
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}❌ Error al iniciar el Backend.${NC}"
        exit 1
    fi

    # 2. Iniciar Frontend
    echo -e "🚀 Iniciando Frontend Vite en http://$HOST:$FRONTEND_PORT ..."
    (cd "$FRONTEND_DIR" && npm run dev) &
    FRONTEND_PID=$!

    echo ""
    echo -e "${GREEN}==================================================${NC}"
    echo -e "${GREEN}   - Frontend (Vite):  http://localhost:$FRONTEND_PORT ${NC}"
    echo -e "${GREEN}   - Backend Docs:     http://$HOST:$BACKEND_PORT/docs ${NC}"
    echo -e "${GREEN}   (Presiona Ctrl + C para detener todo)          ${NC}"
    echo -e "${GREEN}==================================================${NC}"
    echo ""

    wait
}

run_tests() {
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}   Ejecutando suite de pruebas                    ${NC}"
    echo -e "${BLUE}==================================================${NC}"
    check_prerequisites

    echo -e "\n${YELLOW}🧪 Corriendo pruebas de Backend (Python unittest)...${NC}"
    (cd "$PROJECT_ROOT" && PYTHONPATH=. "$VENV_PATH/bin/python" -m unittest discover backend/tests)

    echo -e "\n${YELLOW}🧪 Corriendo pruebas de Frontend (Vitest)...${NC}"
    (cd "$FRONTEND_DIR" && npm test -- --run)

    echo -e "\n${GREEN}✅ Todas las pruebas pasaron satisfactoriamente.${NC}"
}

MODE="${1:-dev}"

case "$MODE" in
    dev|--dev)
        start_dev
        ;;

    test|--test)
        run_tests
        ;;

    -h|--help|help)
        show_help
        ;;

    *)
        echo -e "${RED}Opción desconocida: $MODE${NC}"
        echo ""
        show_help
        ;;
esac
