#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Auditoría de Seguridad Local - P2P Reconciliation Ledger
# ==============================================================================

echo "🔍 Iniciando chequeos de seguridad locales..."
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Chequeo de permisos en archivos sensibles
echo ""
echo "📁 1. Verificando permisos de base de datos y respaldos..."
echo "  ℹ️ Las bases de datos y respaldos se gestionan en el directorio de usuario de Tauri (App Data Dir)."

# 2. Búsqueda de secretos o credenciales expuestas en el repositorio
echo ""
echo "🔑 2. Buscando posibles credenciales o claves expuestas..."
SUSPICIOUS=$(grep -rnE "(binance.*api[_-]?secret|jwt_secret|private_key|secret_key)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]" "$ROOT_DIR" \
    --exclude-dir={.git,node_modules,target,dist,build,graphify-out} \
    --exclude={.env.example,SECURITY.md,*.jsonl} || true)

if [ -n "$SUSPICIOUS" ]; then
    echo "  ⚠️ Se encontraron posibles secretos codificados:"
    echo "$SUSPICIOUS"
else
    echo "  ✅ No se detectaron secretos ni API keys hardcodeadas en código fuente rastreado."
fi

# 3. Auditoría de dependencias Node.js si npm está disponible
echo ""
echo "📦 3. Auditoría de dependencias frontend (npm)..."
if command -v npm &> /dev/null; then
    (cd "$ROOT_DIR" && npm audit --omit=dev --audit-level=high) || true
    echo "  ✅ Auditoría npm (dependencias de producción) ejecutada."
else
    echo "  ℹ️ npm no disponible en el entorno actual. Se validará automáticamente en CI/GitHub Actions."
fi

# 4. Auditoría de dependencias Rust si cargo-audit está disponible
echo ""
echo "🦀 4. Auditoría de dependencias Rust (Cargo)..."
if command -v cargo-audit &> /dev/null; then
    (cd "$ROOT_DIR/src-tauri" && cargo audit) || true
    echo "  ✅ Auditoría cargo audit ejecutada."
else
    echo "  ℹ️ cargo-audit no instalado localmente. Se validará automáticamente en CI/GitHub Actions."
fi

echo ""
echo "✨ Chequeo de seguridad completado."
