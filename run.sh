#!/usr/bin/env bash

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
TAURI_DIR="$FRONTEND_DIR/src-tauri"

# Colores para salida de terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
P2P Ledger - Terminal Financiero (Tauri v2 + Rust + React)

Uso: ./run.sh [COMANDO]

Comandos:
  dev (por defecto)   Inicia la aplicación de escritorio en modo desarrollo (Tauri + Vite HMR)
  build               Compila los instaladores nativos para producción (.rpm, .deb, binario)
  test                Ejecuta la suite de pruebas (Cargo tests en Rust y Vitest en Frontend)
  check               Verifica dependencias del sistema y herramientas de compilación
  -h, --help          Muestra esta ayuda

EOF
    exit 0
}

check_prerequisites() {
    local missing=0

    # 1. Node & npm
    if ! command -v npm &>/dev/null; then
        echo -e "${RED}❌ Error: 'npm' no está instalado o no se encuentra en el PATH.${NC}"
        missing=1
    fi

    # 2. Rust & Cargo
    if ! command -v cargo &>/dev/null; then
        echo -e "${RED}❌ Error: 'cargo' no está instalado. Instala Rust (vía dnf o rustup).${NC}"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi

    # 3. Node modules
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}⚠️ 'node_modules' no encontrado. Instalando dependencias del Frontend...${NC}"
        (cd "$FRONTEND_DIR" && npm install)
    fi
}

start_dev() {
    check_prerequisites

    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}   Iniciando P2P Ledger en Modo Desarrollo       ${NC}"
    echo -e "${BLUE}   (Tauri 2.0 Rust Core + Vite HMR React)         ${NC}"
    echo -e "${BLUE}==================================================${NC}"

    (cd "$FRONTEND_DIR" && npm run tauri dev)
}

run_build() {
    check_prerequisites

    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}   Compilando Aplicación Nativa para Producción   ${NC}"
    echo -e "${BLUE}==================================================${NC}"

    (cd "$FRONTEND_DIR" && npm run tauri build)
    echo -e "${GREEN}✅ Compilación finalizada. Paquetes generados en frontend/src-tauri/target/release/bundle/${NC}"
}

run_tests() {
    check_prerequisites

    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}   Ejecutando Suite de Pruebas                    ${NC}"
    echo -e "${BLUE}==================================================${NC}"

    echo -e "\n${YELLOW}🧪 Corriendo pruebas de Backend Rust (cargo test)...${NC}"
    (cd "$TAURI_DIR" && cargo test)

    echo -e "\n${YELLOW}🧪 Corriendo pruebas de Frontend React (Vitest)...${NC}"
    (cd "$FRONTEND_DIR" && npm test -- --run)

    echo -e "\n${GREEN}✅ Pruebas ejecutadas satisfactoriamente.${NC}"
}

MODE="${1:-dev}"

case "$MODE" in
    dev|--dev)
        start_dev
        ;;

    build|--build)
        run_build
        ;;

    test|--test)
        run_tests
        ;;

    check|--check)
        check_prerequisites
        echo -e "${GREEN}✅ Todas las herramientas necesarias (Node, npm, Cargo, Rust) están instaladas.${NC}"
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
