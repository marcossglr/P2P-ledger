#!/usr/bin/env bash

# ==============================================================================
# Script de sincronización y release de versiones para P2P Ledger
# Uso:
#   ./scripts/bump_version.sh 0.3.8
#   ./scripts/bump_version.sh 0.3.8 --push
# ==============================================================================

set -eo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NEW_VERSION="$1"
FLAG_PUSH="$2"

if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Debes especificar el número de versión.${NC}"
    echo "Uso:"
    echo "  ./scripts/bump_version.sh <version> [--push]"
    echo "Ejemplo:"
    echo "  ./scripts/bump_version.sh 0.3.8"
    exit 1
fi

# Limpiar posible prefijo 'v' si el usuario lo incluye por error
NEW_VERSION="${NEW_VERSION#v}"

# Validar formato semántico básico (X.Y.Z)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo -e "${RED}Error: El formato de versión '$NEW_VERSION' no es SemVer válido (ej. 0.3.8 o 0.4.0).${NC}"
    exit 1
fi

echo -e "${BLUE}==> Sincronizando versión a ${GREEN}${NEW_VERSION}${NC}..."

# 1. frontend/src-tauri/tauri.conf.json
TAURI_CONF="$PROJECT_ROOT/frontend/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF" ]; then
    sed -i -E "s/(\"version\":\s*\")[^\"]+(\")/\1$NEW_VERSION\2/" "$TAURI_CONF"
    echo -e "  ${GREEN}✓${NC} Actualizado: frontend/src-tauri/tauri.conf.json"
fi

# 2. frontend/src-tauri/Cargo.toml (solo el version del paquete raíz)
CARGO_TOML="$PROJECT_ROOT/frontend/src-tauri/Cargo.toml"
if [ -f "$CARGO_TOML" ]; then
    sed -i -E "0,/^version\s*=\s*\"[^\"]+\"/s//version = \"$NEW_VERSION\"/" "$CARGO_TOML"
    echo -e "  ${GREEN}✓${NC} Actualizado: frontend/src-tauri/Cargo.toml"
fi

# 3. frontend/package.json
PACKAGE_JSON="$PROJECT_ROOT/frontend/package.json"
if [ -f "$PACKAGE_JSON" ]; then
    sed -i -E "0,/\"version\":\s*\"[^\"]+\"/s//\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
    echo -e "  ${GREEN}✓${NC} Actualizado: frontend/package.json"
fi

echo ""
echo -e "${BLUE}==> Creando commit y tag git...${NC}"
cd "$PROJECT_ROOT"

git add "$TAURI_CONF" "$CARGO_TOML" "$PACKAGE_JSON"
git commit -m "chore(release): bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo -e "${GREEN}✓ Commit y tag v$NEW_VERSION creados localmente con éxito.${NC}"

if [ "$FLAG_PUSH" == "--push" ]; then
    echo -e "${BLUE}==> Subiendo commit y tag a GitHub para disparar el release CI/CD...${NC}"
    git push origin main
    git push origin "v$NEW_VERSION"
    echo -e "${GREEN}✓ Release v$NEW_VERSION subido a GitHub exitosamente.${NC}"
else
    echo ""
    echo -e "${YELLOW}Para publicar el release en GitHub ejecuta:${NC}"
    echo "  git push origin main && git push origin v$NEW_VERSION"
fi
